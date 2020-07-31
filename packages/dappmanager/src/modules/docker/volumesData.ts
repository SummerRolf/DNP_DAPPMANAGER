import { dockerDf, dockerVolumesList } from "./dockerApi";
import { listContainers } from "./listContainers";
import { parseDevicePath } from "../compose";
import { VolumeData, VolumeOwnershipData, PackageContainer } from "../../types";
import { detectMountpoints } from "../hostScripts";

/**
 * Normalizes a docker-compose project name 
 * ```python
 * def normalize_name(name):
    return re.sub(r'[^-_a-z0-9]', '', name.lower())
 * ```
 * https://github.com/docker/compose/blob/854c14a5bcf566792ee8a972325c37590521656b/compose/cli/command.py#L178
 */
export const normalizeProjectName = (name: string): string =>
  name.replace(/[^-_a-z0-9]/gi, "").toLowerCase();

/**
 * Returns only ownership data of each volume against all installed packages
 */
export async function getVolumesOwnershipData(): Promise<
  VolumeOwnershipData[]
> {
  const volumes = await dockerVolumesList();
  const dnpList = await listContainers();

  return volumes.map(vol => parseVolumeOwnershipData(vol, dnpList));
}

/**
 * Returns volume data. Expensive function
 * - ownership data of each volume against all installed packages
 * - volume system usage data from docker system df
 * - mountpoint data if any
 */
export async function getVolumeSystemData(): Promise<VolumeData[]> {
  const volumes = await dockerVolumesList();
  const { Volumes: volumesDf } = await dockerDf();
  const dnpList = await listContainers();

  // This expensive function won't be called on empty volDevicePaths
  const callDetectMountpoints = volumes.some(vol => (vol.Options || {}).device);
  const mountpoints = callDetectMountpoints ? await detectMountpoints() : [];

  // TODO: Calling getHostVolumeSizes() is deactivated until UX is sorted out
  //       calling du on massive dirs can take +30min (i.e. Storj data));
  // const hostVolumeSizes = mapValues(
  //   await getHostVolumeSizes(volDevicePaths),
  //   volSize => parseInt(volSize)
  // );

  // Append sizes after to optimize the number of calls to dockerDf and host
  return volumes.map(
    (vol): VolumeData => {
      const ownershipData = parseVolumeOwnershipData(vol, dnpList);

      // Get the size of the volume via docker system df -v
      const volDfData = volumesDf.find(v => v.Name === vol.Name);
      const size = volDfData ? volDfData.UsageData.Size : undefined;
      const refCount = volDfData ? volDfData.UsageData.RefCount : undefined;
      // Check users for custom bind volumes
      const isOrphan = !refCount && ownershipData.users.length === 0;

      // Custom mountpoint data
      const pathParts =
        vol.Options && vol.Options.device
          ? parseDevicePath(vol.Options.device)
          : undefined;

      return {
        // Real volume and owner name to call delete on
        name: vol.Name,
        owner: ownershipData.owner,
        users: ownershipData.users,
        internalName: parseVolumeLabels(vol.Labels).internalName,
        createdAt: new Date(vol.CreatedAt).getTime(),
        size,
        refCount,
        isOrphan,
        mountpoint: pathParts ? pathParts.mountpoint : "",
        fileSystem: pathParts
          ? mountpoints.find(fs => fs.mountpoint === pathParts.mountpoint)
          : undefined
      };
    }
  );
}

export function parseVolumeOwnershipData(
  vol: { Name: string; Labels: { [key: string]: string } },
  dnpList: PackageContainer[]
): VolumeOwnershipData {
  // Get user names
  const users = Array.from(
    dnpList.reduce((_users, dnp) => {
      if (dnp.volumes.some(v => v.name === vol.Name)) _users.add(dnp.name);
      return _users;
    }, new Set<string>())
  );

  // Get the volume owner
  // TODO: Weak, derived from project name, may be exploited
  const { normalizedOwnerName } = parseVolumeLabels(vol.Labels || {});
  const ownerContainer = dnpList.find(
    dnp => normalizeProjectName(dnp.name) === normalizedOwnerName
  );

  return {
    // Real volume and owner name to call delete on
    name: vol.Name,
    // Do not assign to a fallback user, if the container has no owner it can be deleted by any user
    owner: ownerContainer?.name,
    users
  };
}

/**
 * [HELPER] Parses the labels figuring out the owner and actual volume name
 * @param labels "Labels": {
 *   "com.docker.compose.project": "lightning-networkdnpdappnodeeth",
 *   "com.docker.compose.version": "1.24.1",
 *   "com.docker.compose.volume": "lndconfig_backup"
 * },
 */
function parseVolumeLabels(labels?: {
  [labelName: string]: string;
}): { normalizedOwnerName: string; internalName?: string } {
  const project = (labels || {})["com.docker.compose.project"];
  const volume = (labels || {})["com.docker.compose.volume"];
  // Core: ".project": "dncore",
  //        ".volume": "binddnpdappnodeeth_data"
  // Dnp:  ".project": "lightning-networkdnpdappnodeeth",
  //        ".volume": "lndconfig_backup"
  if (project === "dncore") {
    const [normalizedOwnerName, internalName] = volume.split("_");
    return { normalizedOwnerName, internalName: internalName || volume };
  } else {
    return { normalizedOwnerName: project, internalName: volume };
  }
}
