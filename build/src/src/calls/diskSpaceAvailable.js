const shellExec = require("utils/shell");
const fs = require("fs");

/**
 * Returns the current disk space available of a requested path
 *
 * [WARNING] Does not work as expected
 *
 * @param {string} path
 * @returns {object} status = {
 *   exists, {bool}
 *   totalSize, {string}
 *   availableSize, {string}
 * }
 */
const diskSpaceAvailable = async ({ path }) => {
  if (!path) throw Error("kwarg path must be defined");

  if (!fs.existsSync(path)) {
    return {
      exists: false,
      totalSize: 0,
      availableSize: 0
    };
  }
  const res = await shellExec(
    `df -h ${path} | awk 'NR>1 { print $2,$4}'`,
    true
  );
  const [totalSize, availableSize] = (res || "").split(/\s+/);
  //  df . -h --output='avail'
  //  Used Avail
  //  192G  9.9G

  return {
    message: `Checked space of ${path}`,
    result: {
      exists: true,
      totalSize,
      availableSize
    }
  };
};

module.exports = diskSpaceAvailable;
