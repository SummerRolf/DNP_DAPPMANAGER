const semver = require("semver");
const { listContainers } = require("modules/dockerList");
const { getCoreVersionId } = require("utils/coreVersionId");
const autoUpdateHelper = require("utils/autoUpdateHelper");
const { shortNameCapitalized } = require("utils/format");

const { MY_PACKAGES, SYSTEM_PACKAGES } = autoUpdateHelper;

/**
 * Returns a auto-update data:
 * - settings: If auto-updates are enabled for a specific DNP or DNPs
 * - registry: List of executed auto-updates
 * - pending: Pending auto-update per DNP, can be already executed
 *
 * @returns {object} result = {
 *   settings: {
 *     "system-packages": { enabled: true }
 *     "my-packages": { enabled: true }
 *     "bitcoin.dnp.dappnode.eth": { enabled: false }
 *   },
 *   registry: {
 *     "core.dnp.dappnode.eth": {
 *       "0.2.4": { updated: 1563304834738, successful: true },
 *       "0.2.5": { updated: 1563304834738, successful: false }
 *     },
 *     "bitcoin.dnp.dappnode.eth": {
 *       "0.1.1": { updated: 1563304834738, successful: true },
 *       "0.1.2": { updated: 1563304834738, successful: true }
 *     }
 *   },
 *   pending: {
 *     "core.dnp.dappnode.eth": {
 *       version: "0.2.4",
 *       firstSeen: 1563218436285,
 *       scheduledUpdate: 1563304834738,
 *       completedDelay: true
 *     },
 *     "bitcoin.dnp.dappnode.eth": {
 *       version: "0.1.2",
 *       firstSeen: 1563218436285,
 *       scheduledUpdate: 1563304834738,
 *       completedDelay: false,
 *     }
 *   },
 *   dnpsToShow: [
 *     {
 *       id: "system-packages",
 *       displayName: "System packages",
 *       enabled: true,
 *       feedback: "Today, 0 min ago"
 *     },
 *     {
 *       id: "my-packages",
 *       displayName: "My packages",
 *       enabled: true,
 *       feedback: "-"
 *     },
 *     {
 *       id: "bitcoin.dnp.dappnode.eth",
 *       displayName: "Bitcoin",
 *       enabled: true,
 *       feedback: "Scheduled, in 23 hours"
 *     }
 *   ]
 * }
 */
async function autoUpdateDataGet() {
  const settings = await autoUpdateHelper.getSettings();
  const registry = await autoUpdateHelper.getRegistry();
  const pending = await autoUpdateHelper.getPending();

  const dnpList = await listContainers();

  const dnpsToShow = [
    {
      id: SYSTEM_PACKAGES,
      displayName: "System packages",
      enabled: await autoUpdateHelper.isCoreUpdateEnabled(),
      feedback: await autoUpdateHelper.getCoreFeedbackMessage({
        currentVersionId: getCoreVersionId(
          dnpList.filter(({ isCore }) => isCore)
        )
      })
    },
    {
      id: MY_PACKAGES,
      displayName: "My packages",
      enabled: await autoUpdateHelper.isDnpUpdateEnabled(),
      feedback: "-"
    }
  ];

  if (await autoUpdateHelper.isDnpUpdateEnabled()) {
    const singleDnpsToShow = dnpList.filter(
      dnp =>
        dnp.name &&
        // Ignore core DNPs
        dnp.isDnp &&
        // Ignore wierd versions
        semver.valid(dnp.version) &&
        // MUST come from the APM
        !dnp.origin
    );

    for (const dnp of singleDnpsToShow) {
      const enabled = await autoUpdateHelper.isDnpUpdateEnabled(dnp.name);
      dnpsToShow.push({
        id: dnp.name,
        displayName: shortNameCapitalized(dnp.name),
        enabled,
        feedback: enabled
          ? await autoUpdateHelper.getDnpFeedbackMessage({
              id: dnp.name,
              currentVersion: dnp.version
            })
          : "-"
      });
    }
  }

  return {
    message: `Got auto update data`,
    result: {
      settings,
      registry,
      pending,
      dnpsToShow
    }
  };
}

module.exports = autoUpdateDataGet;
