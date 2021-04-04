import path from "path";
import fs from "fs";
import params from "../../params";
import { shellHost } from "../../utils/shell";

/**
 * Service runners. Helps ensure no typos
 */
type ServiceName = "docker-update.service";

/**
 * Run a service for the hostService folder
 * @param serviceName "docker-update.service"
 * sytemd service info: https://www.freedesktop.org/software/systemd/man/systemd.service.html
 */
export async function runService(
  serviceName: ServiceName,
  args = ""
): Promise<string> {
  const servicePath = path.resolve(params.HOST_SERVICES_DIR, serviceName);
  if (!fs.existsSync(servicePath))
    throw Error(`Host service ${serviceName} not found`);

  const servicePathFromHost = path.resolve(
    params.HOST_SERVICES_SOURCE_DIR,
    serviceName
  );
  return await shellHost(`systemctl start ${servicePathFromHost} ${args}`);
}
