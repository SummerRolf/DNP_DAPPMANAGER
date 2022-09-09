import { eventBus } from "../eventBus";
import { listPackage } from "../modules/docker/list";
import { ComposeFileEditor } from "../modules/compose/editor";
import { getContainersStatus, dockerComposeUpPackage } from "../modules/docker";
import { packageInstalledHasPid } from "../utils/pid";
import { PackageEnvs } from "@dappnode/dappnodesdk";

/**
 * Updates the .env file of a package. If requested, also re-ups it
 */
export async function packageSetEnvironment({
  dnpName,
  environmentByService
}: {
  dnpName: string;
  environmentByService: { [serviceName: string]: PackageEnvs };
}): Promise<void> {
  if (!dnpName) throw Error("kwarg dnpName must be defined");
  if (!environmentByService) throw Error("kwarg environment must be defined");

  const dnp = await listPackage({ dnpName });
  const compose = new ComposeFileEditor(dnp.dnpName, dnp.isCore);
  const services = compose.services();

  for (const [serviceName, environment] of Object.entries(
    environmentByService
  )) {
    const service = services[serviceName];
    if (!service) throw Error(`No service ${serviceName} in dnp ${dnpName}`);
    service.mergeEnvs(environment);
  }

  compose.write();

  const containersStatus = await getContainersStatus({ dnpName });
  // Packages sharing PID or must be recreated:
  // - Packages sharing PID must be recreated to ensure startup order
  const forceRecreate = packageInstalledHasPid(compose.compose);
  await dockerComposeUpPackage({ dnpName }, containersStatus, {
    forceRecreate
  });

  // Emit packages update
  eventBus.requestPackages.emit();
  eventBus.packagesModified.emit({ dnpNames: [dnpName] });
}
