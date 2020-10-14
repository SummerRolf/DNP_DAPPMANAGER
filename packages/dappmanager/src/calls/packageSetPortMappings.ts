import * as eventBus from "../eventBus";
import params from "../params";
import { listPackage } from "../modules/docker/listContainers";
import { ComposeFileEditor } from "../modules/compose/editor";
import { PortMapping } from "../types";
import { restartPackage } from "../modules/docker/restartPackage";
import { mapValues } from "lodash";

/**
 * Updates the .env file of a package. If requested, also re-ups it
 *
 * @param id DNP .eth name
 * @param portMappings [
 *   { host: 30444, container: 30303, protocol: "UDP" },
 *   { host: 4000, container: 4000, protocol: "TCP" }
 * ]
 */
export async function packageSetPortMappings({
  dnpName,
  portMappingsByService,
  options
}: {
  dnpName: string;
  portMappingsByService: { [serviceName: string]: PortMapping[] };
  options?: { merge: boolean };
}): Promise<void> {
  if (!dnpName) throw Error("kwarg id must be defined");
  if (!portMappingsByService)
    throw Error("kwarg portMappingsByService must be defined");

  const dnp = await listPackage({ dnpName });

  if (dnp.dnpName === params.dappmanagerDnpName)
    throw Error("Can not edit DAPPAMANAGER ports");

  const compose = new ComposeFileEditor(dnp.dnpName, dnp.isCore);
  const services = compose.services();
  const previousPortMappings = mapValues(services, service =>
    service.getPortMappings()
  );

  for (const [serviceName, portMappings] of Object.entries(
    portMappingsByService
  )) {
    const service = services[serviceName];
    if (!service) throw Error(`No service ${serviceName} in dnp ${dnpName}`);
    if (options && options.merge) service.mergePortMapping(portMappings);
    else service.setPortMapping(portMappings);
  }

  compose.write();

  try {
    // packageRestart triggers > eventBus emitPackages
    await restartPackage({ dnpName, forceRecreate: false });
  } catch (e) {
    if (e.message.toLowerCase().includes("port is already allocated")) {
      // Rollback port mappings are re-up
      for (const [serviceName, portMappings] of Object.entries(
        previousPortMappings
      ))
        if (services[serviceName])
          services[serviceName].setPortMapping(portMappings);
      compose.write();

      await restartPackage({ dnpName, forceRecreate: false });

      // Try to get the port colliding from the error
      const ipAndPort = (e.message.match(
        /(?:Bind for)(.+)(?:failed: port is already allocated)/
      ) || [])[1];
      const collidingPortNumber = (ipAndPort || "").split(":")[1] || "";

      // Throw error
      throw Error(
        `${
          collidingPortNumber
            ? `Port ${collidingPortNumber} is already mapped`
            : "Port collision"
        }. Reverted port mapping update`
      );
    }
  }

  // Emit packages update
  eventBus.requestPackages.emit();
  eventBus.packagesModified.emit({ dnpNames: [dnpName] });

  // Trigger a natRenewal update to open ports if necessary
  eventBus.runNatRenewal.emit();
}
