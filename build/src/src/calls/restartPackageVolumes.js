const fs = require("fs");
const getPath = require("utils/getPath");
const params = require("params");
const docker = require("modules/docker");
const dockerList = require("modules/dockerList");
const { eventBus, eventBusTag } = require("eventBus");
const { stringIncludes } = require("utils/strings");

/**
 * Removes a package volumes. The re-ups the package
 *
 * @param {string} id DNP .eth name
 */
async function restartPackageVolumes({ id }) {
  if (!id) throw Error("kwarg id must be defined");

  const dnpList = await dockerList.listContainers();
  const dnp = dnpList.find(_dnp => stringIncludes(_dnp.name, id));
  if (!dnp) {
    throw Error(`Could not find an container with the name: ${id}`);
  }
  const dockerComposePath = getPath.dockerComposeSmart(id, params);
  if (!fs.existsSync(dockerComposePath)) {
    throw Error(`No docker-compose found: ${dockerComposePath}`);
  }
  if (id.includes("dappmanager.dnp.dappnode.eth")) {
    throw Error("The installer cannot be restarted");
  }

  /**
   * The volumes object of the docker API will is
   * {
   *   type: Type,
   *   name: Name, // Will be null if it's not a named volumed
   *   path: Source,
   *   dest: Destination
   * }
   */
  const namedVolumes = (dnp.volumes || [])
    .map(v => v.name)
    .filter(name => name);

  // If there are no volumes don't do anything
  if (!namedVolumes.length) {
    return {
      message: id + " has no named volumes "
    };
  }

  try {
    if (dnp.isCore) {
      // docker-compose down can't be called because of the shared network
      await docker.compose.rm(dockerComposePath);
      await docker.volume.rm(namedVolumes.join(" "));
    } else {
      await docker.compose.down(dockerComposePath, { volumes: true });
    }
  } catch (e) {
    // In case of error: FIRST up the dnp, THEN throw the error
    await docker.safe.compose.up(dockerComposePath);
    throw e;
  }

  // Restart docker to apply changes
  await docker.safe.compose.up(dockerComposePath);

  // Emit packages update
  eventBus.emit(eventBusTag.emitPackages);

  return {
    message: `Restarted ${id} volumes`,
    logMessage: true,
    userAction: true
  };
}

module.exports = restartPackageVolumes;
