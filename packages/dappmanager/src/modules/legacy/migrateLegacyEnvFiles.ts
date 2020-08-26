import fs from "fs";
import { parseEnvironment } from "../compose";
import { ComposeFileEditor } from "../compose/editor";
import * as getPath from "../../utils/getPath";
import { logs } from "../../logs";
import { isNotFoundError } from "../../utils/node";
import { PackageContainer } from "../../types";

/**
 * [LEGACY] The previous method of injecting ENVs to a DNP was via .env files
 * This function will read the contents of .env files and add them in the
 * compose itself in the `environment` field in array format
 */
export async function migrateLegacyEnvFiles(
  dnpList: PackageContainer[]
): Promise<void> {
  try {
    for (const { dnpName, isCore } of dnpList)
      migrateLegacyEnvFile(dnpName, isCore);
    logs.info("Finished migrating legacy DNP .env files if any");
  } catch (e) {
    logs.error("Error migrating DNP .env files", e);
  }
}

export function migrateLegacyEnvFile(
  dnpName: string,
  isCore: boolean
): boolean {
  const envFilePath = getPath.envFile(dnpName, isCore);
  try {
    const envFileData = fs.readFileSync(envFilePath, "utf8");
    const envsArray = envFileData.trim().split("\n");

    const compose = new ComposeFileEditor(dnpName, isCore);
    const singleService = compose
      .services()
      .find(service => service.serviceName === dnpName);
    if (singleService) {
      singleService.mergeEnvs(parseEnvironment(envsArray));
      singleService.omitDnpEnvFile();
      compose.write();

      fs.unlinkSync(envFilePath);
      logs.info(`Converted ${dnpName} .env file to compose environment`);
      return true;
    } else {
      throw Error(
        `Can not migrate ENVs for multi-service packages: ${dnpName}`
      );
    }
  } catch (e) {
    if (!isNotFoundError(e))
      logs.error(`Error migrating ${dnpName} .env file`, e);
    return false;
  }
}
