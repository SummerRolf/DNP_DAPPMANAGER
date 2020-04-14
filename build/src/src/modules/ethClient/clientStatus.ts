import { ethers } from "ethers";
import * as db from "../../db";
import { ethClientData } from "../../params";
import { EthClientStatus, EthClientTargetPackage } from "../../types";
import { listContainerNoThrow } from "../../modules/docker/listContainers";
import { serializeError } from "./types";
import { parseEthersSyncing } from "../../watchers/chains/utils";
import { getEthClientApiUrl } from "./apiUrl";

/**
 * Minimum block difference to consider a local ethereum mainnet node synced
 * if  highestBlock = 1000005
 * and currentBlock = 1000000
 * and minDiff = 50
 * The node will be considered synced
 */
const MIN_ETH_BLOCK_DIFF_SYNC = 60;

/**
 * Goal:
 *  - Fastest possible success path, minimize number of call
 *  - Capture current state with a much details as possible
 *
 * All possible status
 * - Provider API works
 *   - Package is syncing
 *   - Package is synced
 *   - Test call fails
 *   - Test call succeeds
 * - Provider API does not work
 *   - DNP is installed
 *     - DNP is not running
 *     - DNP is running
 *   - DNP is not installed
 *     - DNP is installing
 *     - DNP is has not installed
 *     - DNP had install error
 *     - DNP was uninstalled
 *
 * Note: MUST NOT have undefined as a valid return type so typescript
 *       enforces that all possible states are covered
 */
export async function getClientStatus(
  target: EthClientTargetPackage
): Promise<EthClientStatus> {
  try {
    const clientData = ethClientData[target];
    if (!clientData) throw Error(`Unsupported target '${target}'`);
    const name = clientData.name;
    const url = clientData.url || getEthClientApiUrl(name);
    try {
      // Provider API works? Do a single test call to check state
      if (await isSyncing(url)) {
        return { ok: false, code: "IS_SYNCING" };
      } else {
        try {
          if (await isApmStateCorrect(url)) {
            // All okay!
            return { ok: true, url, name };
          } else {
            // State is not correct, node is not synced but eth_syncing did not picked it up
            return { ok: false, code: "STATE_NOT_SYNCED" };
          }
        } catch (eFromTestCall) {
          // APM state call failed, syncing call succeeded and is not working
          // = Likely an error related to fetching state content
          return {
            ok: false,
            code: "STATE_CALL_ERROR",
            error: serializeError(eFromTestCall)
          };
        }
      }
    } catch (eFromSyncing) {
      // syncing call failed, the node is not available, find out why
      const dnp = await listContainerNoThrow(name);
      if (dnp) {
        // DNP is installed
        if (dnp.running) {
          // syncing call failed, but the client is running
          // ???, a connection error?
          return {
            ok: false,
            code: "NOT_AVAILABLE",
            error: serializeError(eFromSyncing)
          };
        } else {
          return { ok: false, code: "NOT_RUNNING" };
        }
      } else {
        // DNP is not installed, figure out why
        const installStatus = db.ethClientInstallStatus.get(target);
        if (installStatus) {
          switch (installStatus.status) {
            case "TO_INSTALL":
            case "INSTALLING":
              return { ok: false, code: "INSTALLING" };
            case "INSTALLING_ERROR":
              return {
                ok: false,
                code: "INSTALLING_ERROR",
                error: installStatus.error
              };
            case "INSTALLED":
              return { ok: false, code: "UNINSTALLED" };
            case "UNINSTALLED":
              return { ok: false, code: "NOT_INSTALLED" };
          }
        } else {
          return { ok: false, code: "NOT_INSTALLED" };
        }
      }
    }
  } catch (eGeneric) {
    return { ok: false, code: "UNKNOWN_ERROR", error: eGeneric };
  }
}

/**
 * Test if a node is synced
 * @param url "http://geth.dappnode:8545"
 */
async function isSyncing(url: string): Promise<boolean> {
  const provider = new ethers.providers.JsonRpcProvider(url);
  const syncing = await provider
    .send("eth_syncing", [])
    .then(parseEthersSyncing);

  if (!syncing) return false;

  // The bigger the far from synced
  const currentBlockDiff = syncing.highestBlock - syncing.currentBlock;
  // If block diff is small, consider it already synced
  if (currentBlockDiff < MIN_ETH_BLOCK_DIFF_SYNC) return false;
  else return true;
}

/**
 * Test if contract data can be retrieved from an APM smart contract
 * This check asserts that:
 * - Node is available at provided URL
 * - State is queriable
 * - Node is almost fully synced
 * @param url
 */
async function isApmStateCorrect(url: string): Promise<boolean> {
  // Call to dappmanager.dnp.dappnode.eth, getByVersionId(35)
  // Returns (uint16[3] semanticVersion, address contractAddress, bytes contentURI)
  const testTxData = {
    to: "0x0c564ca7b948008fb324268d8baedaeb1bd47bce",
    data:
      "0x737e7d4f0000000000000000000000000000000000000000000000000000000000000023"
  };
  const result =
    "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000342f697066732f516d63516958454c42745363646278464357454a517a69664d54736b4e5870574a7a7a5556776d754e336d4d4361000000000000000000000000";

  const provider = new ethers.providers.JsonRpcProvider(url);

  const res = await provider.send("eth_call", [testTxData, "latest"]);
  return res === result;
}
