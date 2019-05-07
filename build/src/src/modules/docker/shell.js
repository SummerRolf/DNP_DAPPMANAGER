const shell = require("utils/shell");
const logs = require("logs")(module);
const { stringIncludes } = require("utils/strings");

/*
 * Wrapper for shell.js, adding a protection against missing env files.
 * If a docker-compose references a .env file and it's missing,
 * all commands (docker-compose up, stop, down) will fail, blocking the package.
 * This solution allows the user to be able to reset or reinstall a broken package.
 */

async function shellWrap(cmd, options) {
  try {
    return await shell(cmd, options);
  } catch (e) {
    if (stringIncludes((e || {}).message, "Couldn't find env file:")) {
      const envPath = (
        e.message.split("Couldn't find env file:")[1] || ""
      ).trim();
      logs.warn(`RETRY SHELL JS command, creating envFile: ${envPath}`);
      await shell(`touch ${envPath}`);
      return await shell(cmd);
    } else {
      throw e;
    }
  }
}

module.exports = shellWrap;
