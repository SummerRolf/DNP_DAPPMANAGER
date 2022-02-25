import { listPackageNoThrow } from "../docker/list/listPackages";
import { httpsPortal } from "../../calls/httpsPortal";
import { prettyDnpName } from "../../utils/format";
import params from "../../params";
import { InstallPackageData } from "../../types";
import { Log } from "../../utils/logUi";
import { HttpsPortalMapping } from "../../common";

/**
 * Expose default HTTPS ports on installation defined in the manifest - exposable
 */
export async function exposeByDefaultHttpsPorts(
  pkg: InstallPackageData,
  log: Log
): Promise<void> {
  if (pkg.metadata.exposable) {
    const portMappinRollback: HttpsPortalMapping[] = [];
    for (const exposable of pkg.metadata.exposable) {
      if (exposable.exposedByDefault) {
        // Check HTTPS package exists
        const httpsPackage = await listPackageNoThrow({
          dnpName: params.HTTPS_PORTAL_DNPNAME
        });
        if (!httpsPackage)
          throw Error(
            `HTTPS package not found but required to expose HTTPS ports by default. Install HTTPS package first.`
          );
        // Check HTTPS package running
        httpsPackage.containers.map(container => {
          if (!container.running)
            throw Error(
              `HTTPS package not running but required to expose HTTPS ports by default.`
            );
        });

        const portalMapping: HttpsPortalMapping = {
          fromSubdomain: exposable.fromSubdomain || prettyDnpName(pkg.dnpName), // get dnpName by default
          dnpName: pkg.dnpName,
          serviceName:
            exposable.serviceName || Object.keys(pkg.compose.services)[0], // get first service name by default (docs: https://docs.dappnode.io/es/developers/manifest-reference/#servicename)
          port: exposable.port
        };

        try {
          // Expose default HTTPS ports
          log(
            pkg.dnpName,
            `Exposing ${prettyDnpName(pkg.dnpName)}:${
              exposable.port
            } to the external internet`
          );
          await httpsPortal.addMapping(portalMapping);
          portMappinRollback.push(portalMapping);

          log(
            pkg.dnpName,
            `Exposed ${prettyDnpName(pkg.dnpName)}:${
              exposable.port
            } to the external internet`
          );
        } catch (e) {
          e.message = `${e.message} Error exposing default HTTPS ports, removing mappings`;
          for (const mappingRollback of portMappinRollback) {
            await httpsPortal.removeMapping(mappingRollback).catch(e => {
              log(
                pkg.dnpName,
                `Error removing mapping ${JSON.stringify(mappingRollback)}, ${
                  e.message
                }`
              );
            });
          }
          throw e;
        }
      }
    }
  }
}
