import { isEqual } from "lodash";
import {
  ConsensusClientMainnet,
  Eth2ClientTarget,
  EthClientRemote,
  ExecutionClientMainnet
} from "../../common";
import * as db from "../../db";
import { eventBus } from "../../eventBus";
import { logs } from "../../logs";
import { getConsensusUserSettings } from "../stakerConfig/setStakerConfig";
import {
  getBeaconServiceName,
  getValidatorServiceName
} from "../stakerConfig/utils";
import { packageGet } from "../../calls/packageGet";
import { packageInstall } from "../../calls/packageInstall";
import { packageRemove } from "../../calls/packageRemove";
import { ComposeFileEditor } from "../compose/editor";
import { parseServiceNetworks } from "../compose/networks";
import params from "../../params";
import { dockerNetworkConnect, dockerNetworkDisconnect } from "../docker";
import { getEndpointConfig } from "../https-portal/migration";
import Dockerode from "dockerode";

export class EthereumClient {
  executionClient = db.executionClientMainnet.get();
  consensusClient = db.consensusClientMainnet.get();
  remote = db.ethClientRemote.get();
  currentTarget: Eth2ClientTarget;

  constructor() {
    this.currentTarget = this.computeEthereumTarget();
  }

  /**
   * Changes the ethereum client used to fetch package data
   * @param nextTarget Ethereum client to change to
   * @param wait If set to true, the function will wait until the client is changed
   * @param deletePrevExecClient If set delete previous exec client
   * @param deletePrevConsClient If set delete previous cons client
   */
  async changeEthClient(
    nextTarget: Eth2ClientTarget,
    sync: boolean,
    deletePrevExecClient?: boolean,
    deletePrevConsClient?: boolean
  ): Promise<void> {
    // Return if the target is the same
    if (isEqual(nextTarget, this.currentTarget)) return;
    // Remove clients if currentTarge is !== remote
    if (this.currentTarget !== "remote") {
      // Remove Execution client
      if (deletePrevExecClient)
        await packageRemove({ dnpName: this.currentTarget.execClient }).catch(
          e => logs.error(`Error removing prev exec client: ${e}`)
        );
      // Remove Consensus client
      if (deletePrevConsClient)
        await packageRemove({ dnpName: this.currentTarget.consClient }).catch(
          e => logs.error(`Error removing prev cons client: ${e}`)
        );
    }

    if (nextTarget === "remote") {
      db.ethClientRemote.set(EthClientRemote.on);
      // Remove alias fullnode.dappnode from the eth client if not removed by the user
      if (!deletePrevExecClient && this.currentTarget !== "remote")
        await this.setDefaultEthClientFullNode({
          dnpName: this.currentTarget.execClient,
          removeAlias: true
        }).catch(e =>
          logs.error(
            "Error removing fullnode.dappnode alias from previous ETH exec client",
            e
          )
        );
    } else {
      const { execClient, consClient } = nextTarget;
      db.ethClientRemote.set(EthClientRemote.off);
      db.executionClientMainnet.set(execClient);
      db.consensusClientMainnet.set(consClient);
      if (sync) await this.changeEthClientSync(execClient, consClient);
      else await this.changeEthClientNotAsync(execClient, consClient);
    }
  }

  /**
   * Handles the Ethereum client fullnode.dappnode alias for the execution client
   * @param dnpName dnp name of the execution client to add/remove the alias from
   * @param removeAlias if true, removes the alias, if false, adds it
   */
  async setDefaultEthClientFullNode({
    dnpName,
    removeAlias
  }: {
    dnpName: ExecutionClientMainnet;
    removeAlias: boolean;
  }): Promise<void> {
    const previousEthClientPackage = await packageGet({
      dnpName
    });

    // Check if ETH client is multiservice, if so get the mainContainer
    const mainService = previousEthClientPackage.manifest?.mainService;
    const serviceName =
      mainService || previousEthClientPackage.containers[0].serviceName;
    // The container selected will be:
    // - Container owner of the main service (if exists)
    // - First container otherwhise
    const previousEthClientContainerName =
      previousEthClientPackage.containers.find(
        container => container.serviceName === serviceName
      )?.containerName || previousEthClientPackage.containers[0].containerName;

    // Remove fullnode alias from endpoint config
    const currentEndpointConfig = await getEndpointConfig(
      previousEthClientContainerName
    );
    const endpointConfig: Partial<Dockerode.NetworkInfo> = {
      ...currentEndpointConfig,
      Aliases: [
        ...currentEndpointConfig?.Aliases.filter(
          // according to docs for compose file v3, aliases are declared as strings https://docs.docker.com/compose/compose-file/compose-file-v3/#aliases
          (item: string) => item !== params.FULLNODE_ALIAS
        )
      ]
    };

    if (removeAlias) this.removeFullnodeAliasFromCompose(dnpName, serviceName);
    else this.addFullnodeAliasToCompose(dnpName, serviceName);

    await dockerNetworkDisconnect(
      params.DNP_PRIVATE_NETWORK_NAME,
      previousEthClientContainerName
    );
    await dockerNetworkConnect(
      params.DNP_PRIVATE_NETWORK_NAME,
      previousEthClientContainerName,
      endpointConfig
    );
  }

  /**
   * Changes the ethereum client synchronously
   */
  private async changeEthClientSync(
    execClient: ExecutionClientMainnet,
    consClient: ConsensusClientMainnet
  ): Promise<void> {
    try {
      // Install exec client and set default fullnode alias
      await packageInstall({ name: execClient }).then(
        async () =>
          await this.setDefaultEthClientFullNode({
            dnpName: execClient,
            removeAlias: false
          })
      );
      // Get default cons client user settings and install cons client
      const userSettings = getConsensusUserSettings(
        consClient,
        {},
        getValidatorServiceName(consClient),
        getBeaconServiceName(consClient)
      );
      await packageInstall({ name: consClient, userSettings });
    } catch (e) {
      throw Error(`Error changing eth client: ${e}`);
    }
  }

  /**
   * Changes the ethereum client asynchronosly by triggering an event
   */
  private async changeEthClientNotAsync(
    execClient: ExecutionClientMainnet,
    consClient: ConsensusClientMainnet
  ): Promise<void> {
    db.ethExecClientInstallStatus.set(execClient, {
      status: "TO_INSTALL"
    });
    db.ethConsClientInstallStatus.set(consClient, {
      status: "TO_INSTALL"
    });
    eventBus.runEthClientInstaller.emit();
  }

  /**
   * Computes the current eth2ClientTarget based on:
   * - remote
   * - executionClient
   * - consensusClient
   */
  private computeEthereumTarget(): Eth2ClientTarget {
    switch (this.remote) {
      case null:
      case EthClientRemote.on:
        return "remote";

      case EthClientRemote.off:
        if (!this.executionClient || !this.consensusClient) return "remote";

        return {
          execClient: this.executionClient,
          consClient: this.consensusClient
        };
    }
  }

  // Utils
  // TODO: put private in the methods and find a way to test them

  removeFullnodeAliasFromCompose(
    ethClientDnpName: string,
    ethClientServiceName: string
  ): void {
    this.editComposeFullnodeAliasEthClient(
      true,
      ethClientDnpName,
      ethClientServiceName
    );
  }

  addFullnodeAliasToCompose(
    ethClientDnpName: string,
    ethClientServiceName: string
  ): void {
    this.editComposeFullnodeAliasEthClient(
      false,
      ethClientDnpName,
      ethClientServiceName
    );
  }

  editComposeFullnodeAliasEthClient(
    removeAlias: boolean,
    ethClientDnpName: string,
    ethClientServiceName: string
  ): void {
    const compose = new ComposeFileEditor(ethClientDnpName, false);

    const composeService = compose.services()[ethClientServiceName];
    const serviceNetworks = parseServiceNetworks(
      composeService.get().networks || {}
    );
    const serviceNetwork =
      serviceNetworks[params.DNP_PRIVATE_NETWORK_NAME] ?? null;

    if (removeAlias)
      composeService.removeNetworkAliases(
        params.DNP_PRIVATE_NETWORK_NAME,
        [params.FULLNODE_ALIAS],
        serviceNetwork
      );
    else
      composeService.addNetworkAliases(
        params.DNP_PRIVATE_NETWORK_NAME,
        [params.FULLNODE_ALIAS],
        serviceNetwork
      );

    compose.write();
  }
}
