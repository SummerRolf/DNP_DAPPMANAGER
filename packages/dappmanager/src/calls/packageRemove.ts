import fs from "fs";
import * as eventBus from "../eventBus";
import params from "../params";
import { dockerComposeDown } from "../modules/docker/compose";
import { dockerContainerRemove, dockerContainerStop } from "../modules/docker";
import * as getPath from "../utils/getPath";
import shell from "../utils/shell";
import { listPackage } from "../modules/docker/list";
import { logs } from "../logs";
import { getDockerTimeoutMax } from "../modules/docker/utils";

/**
 * Remove package data: docker down + disk files
 *
 * @param id DNP .eth name
 * @param deleteVolumes flag to also clear permanent package data
 */
export async function packageRemove({
  dnpName,
  deleteVolumes = false
}: {
  dnpName: string;
  deleteVolumes?: boolean;
}): Promise<void> {
  if (!dnpName) throw Error("kwarg dnpName must be defined");

  const dnp = await listPackage({ dnpName });
  const timeout = getDockerTimeoutMax(dnp.containers);

  if (dnp.isCore || dnp.dnpName === params.dappmanagerDnpName) {
    throw Error("Core packages cannot be removed");
  }

  // Only no-cores reach this block
  const composePath = getPath.dockerCompose(dnp.dnpName, false);
  const packageRepoDir = getPath.packageRepoDir(dnp.dnpName, false);

  // [NOTE] Not necessary to close the ports since they will just
  // not be renewed in the next interval

  // If there is no docker-compose, do a docker rm directly
  // Otherwise, try to do a docker-compose down and if it fails,
  // log to console and do docker-rm
  let hasRemoved = false;
  if (fs.existsSync(composePath)) {
    try {
      await dockerComposeDown(composePath, {
        volumes: deleteVolumes,
        // Ignore timeout is user doesn't want to keep any data
        timeout: deleteVolumes ? undefined : timeout
      });
      hasRemoved = true; // To mimic an early return
    } catch (e) {
      logs.error(`Error on dockerComposeDown of ${dnp.dnpName}`, e);
    }
  }

  if (!hasRemoved) {
    const containerNames = dnp.containers.map(c => c.containerName);
    await Promise.all(
      containerNames.map(async containerName => {
        await dockerContainerStop(containerName, { timeout });
        await dockerContainerRemove(containerName, { volumes: deleteVolumes });
      })
    );
  }

  // Remove DNP folder and files
  if (fs.existsSync(packageRepoDir)) await shell(`rm -r ${packageRepoDir}`);

  // Emit packages update
  eventBus.requestPackages.emit();
  eventBus.packagesModified.emit({ dnpNames: [dnp.dnpName], removed: true });
}
