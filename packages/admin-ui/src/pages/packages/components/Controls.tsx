import React from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { api } from "api";
// Components
import CardList from "components/CardList";
import Button from "components/Button";
import { confirm } from "components/ConfirmDialog";
import { withToastNoThrow } from "components/toast/Toast";
// Utils
import { shortNameCapitalized as sn } from "utils/format";
import { wifiName, ipfsName, corePackages } from "params";
import { packageRestart } from "pages/packages/actions";
import { InstalledPackageDetailData } from "common";
import { systemPackagesPath, rootPath as packagesRootPath } from "../data";

interface WarningItem {
  title: string;
  body: string;
}

function getRootPath(dnpName: string) {
  return corePackages.includes(dnpName) ? systemPackagesPath : packagesRootPath;
}

export function Controls({
  id,
  dnp
}: {
  id: string;
  dnp: InstalledPackageDetailData;
}) {
  const {
    state,
    isCore,
    areThereVolumesToRemove,
    volumeUsersToRemove,
    dependantsOf,
    namedExternalVols
  } = dnp;

  const dispatch = useDispatch();

  async function packageStartStop() {
    withToastNoThrow(() => api.packageStartStop({ id }), {
      message: `Toggling ${sn(id)}...`,
      onSuccess: `Toggled ${sn(id)}`
    });
  }

  async function packageRestartVolumes() {
    const warningsList: WarningItem[] = [];

    /**
     * If there are volumes which this DNP is the owner and some other
     * DNPs are users, they will be removed by the DAPPMANAGER.
     * Alert the user about this fact
     */
    if (volumeUsersToRemove.length > 0) {
      const dnpsToRemoveList = volumeUsersToRemove
        .map(name => `- ${name}`)
        .join("\n");
      warningsList.push({
        title: "Warning! DAppNode Packages to be removed",
        body: `Some other DAppNode Packages will be reseted in order to remove ${id} volumes. \n\n ${dnpsToRemoveList}`
      });
    }

    // If there are NOT conflicting volumes,
    // Display a dialog to confirm volumes reset
    await new Promise(resolve =>
      confirm({
        title: `Removing ${sn(id)} data`,
        text: `This action cannot be undone. If this DAppNode Package is a blockchain node, it will lose all the chain data and start syncing from scratch.`,
        list: warningsList,
        label: "Remove volumes",
        onClick: resolve
      })
    );

    await withToastNoThrow(() => api.packageRestartVolumes({ id }), {
      message: `Removing volumes of ${sn(id)}...`,
      onSuccess: `Removed volumes of ${sn(id)}`
    });
  }

  async function packageRemove() {
    // Dialog to confirm remove + USER INPUT for delete volumes
    const deleteVolumes = await new Promise(
      (resolve: (_deleteVolumes: boolean) => void) => {
        const title = `Removing ${sn(id)}`;
        let text = `This action cannot be undone.`;
        const buttons = [{ label: "Remove", onClick: () => resolve(false) }];
        if (areThereVolumesToRemove) {
          // Only show the remove data related text if necessary
          text += ` If you do NOT want to keep ${id}'s data, remove it permanently clicking the "Remove and delete data" option.`;
          // Only display the "Remove and delete data" button if necessary
          buttons.push({
            label: "Remove and delete data",
            onClick: () => resolve(true)
          });
        }
        confirm({ title, text, buttons });
      }
    );

    const dnpsToRemoveWarningsList: WarningItem[] = [];
    // Don't show the same DNP in both dnpsToRemove and dependantsOf
    // dependantsOf = ["raiden.dnp.dappnode.eth", "another.dnp.dappnode.eth"]
    if (dependantsOf.length > 0) {
      const dependantsOfList = dependantsOf.map(name => `- ${name}`).join("\n");
      dnpsToRemoveWarningsList.push({
        title: "Warning! There are package dependants",
        body: `Some DAppNode Packages depend on ${id} and may stop working if you continue. \n\n ${dependantsOfList}`
      });
    }

    // dnpsToRemove = "raiden.dnp.dappnode.eth, another.dnp.dappnode.eth"
    if (volumeUsersToRemove.length > 0) {
      const dnpsToRemoveList = volumeUsersToRemove
        .map(name => `- ${name}`)
        .join("\n");
      dnpsToRemoveWarningsList.push({
        title: "Warning! Other packages to be removed",
        body: `Some other DAppNode Packages will be removed as well because they are dependent on ${id} volumes. \n\n ${dnpsToRemoveList}`
      });
    }

    if (dnpsToRemoveWarningsList.length > 0)
      await new Promise(resolve =>
        confirm({
          title: `Removing ${sn(id)}`,
          text: `This action cannot be undone.`,
          list: dnpsToRemoveWarningsList,
          label: "Continue",
          onClick: resolve
        })
      );

    await withToastNoThrow(() => api.packageRemove({ id, deleteVolumes }), {
      message: `Removing ${sn(id)} ${deleteVolumes ? " and volumes" : ""}...`,
      onSuccess: `Removed ${sn(id)}`
    });
  }

  const actions = [
    {
      name:
        state === "running" ? "Stop" : state === "exited" ? "Start" : "Toggle",
      text: "Toggle the state of the package from running to paused",
      action: packageStartStop,
      availableForCore: false,
      whitelist: [wifiName, ipfsName],
      type: "secondary"
    },
    {
      name: "Restart",
      text:
        "Restarting a package will interrupt the service during 1-10s but preserve its data",
      action: () => dispatch(packageRestart(id)),
      availableForCore: true,
      type: "secondary"
    },
    {
      name: "Remove volumes",
      text: (
        <div>
          {areThereVolumesToRemove
            ? `Deleting the volumes is a permanent action and all data will be lost.`
            : "This DAppNode Package is not the owner of any named volumes."}
          {namedExternalVols.map(vol => (
            <div key={vol.name} style={{ opacity: 0.6 }}>
              Go to{" "}
              <Link to={`${getRootPath(vol.owner || "")}/${vol.owner}`}>
                {vol.owner}
              </Link>{" "}
              to remove the volume {vol.name}
            </div>
          ))}
        </div>
      ),
      action: packageRestartVolumes,
      availableForCore: true,
      disabled: !areThereVolumesToRemove,
      type: "danger"
    },
    {
      name: "Remove ",
      text: "Deletes a package permanently.",
      action: packageRemove,
      availableForCore: false,
      type: "danger"
    }
  ];

  // Table style -> Removes the space below the table, only for tables in cards
  return (
    <CardList>
      {actions
        .filter(
          action =>
            action.availableForCore ||
            !isCore ||
            (action.whitelist || []).includes(id)
        )
        .map(({ name, text, type, action, disabled }) => (
          <div key={name} className="control-item">
            <div>
              <strong>{name}</strong>
              <div>{text}</div>
            </div>
            <Button
              variant={`outline-${type}`}
              onClick={action}
              style={{ whiteSpace: "normal" }}
              disabled={disabled}
            >
              {name}
            </Button>
          </div>
        ))}
    </CardList>
  );
}
