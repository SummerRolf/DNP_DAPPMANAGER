const logs = require("logs.js")(module);
const { eventBus, eventBusTag } = require("eventBus");
const fetchCoreUpdateData = require("calls/fetchCoreUpdateData");
// Utils
const {
  isUpdateDelayCompleted,
  flagCompletedUpdate
} = require("utils/autoUpdateHelper");
// External calls
const installPackage = require("calls/installPackage");

const coreDnpName = "core.dnp.dappnode.eth";

async function updateSystemPackages() {
  const { available, type, versionId } = await fetchCoreUpdateData();

  // If there is not update available or the type is not patch, return early
  if (!available || type !== "patch") return;

  // Enforce a 24h delay before performing an auto-update
  // Also records the remaining time in the db for the UI
  if (!(await isUpdateDelayCompleted(coreDnpName, versionId))) return;

  logs.info(`Auto-updating system packages...`);

  try {
    /**
     * If the DAPPMANAGER is updated the updateRegistry will never be executed.
     * Add it preventively, and then remove it if the update errors
     */
    await flagCompletedUpdate(coreDnpName, versionId, true);
    await installPackage({
      id: coreDnpName,
      options: { BYPASS_RESOLVER: true }
    });

    logs.info(`Successfully auto-updated system packages`);
    eventBus.emit(eventBusTag.emitPackages);
  } catch (e) {
    // Remove the log and throw
    await flagCompletedUpdate(coreDnpName, versionId, false);
    throw e;
  }
}

module.exports = updateSystemPackages;
