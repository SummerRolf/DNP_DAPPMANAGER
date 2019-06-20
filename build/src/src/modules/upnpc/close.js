const upnpcCommand = require("./upnpcCommand");
const validateKwargs = require("./validateKwargs");
const parseCloseOutput = require("./parseCloseOutput");

/**
 * Close port = deletes the map requested port to host
 * Actual command example:
 *   docker run --rm --net=host ${IMAGE} upnpc -e DAppNode -d 500 UDP
 *
 * @param {object} kwargs: {
 *   portNumber: '3000',
 *   protocol: 'TCP',
 * }
 * @returns {*}
 */
async function close({ portNumber, protocol }) {
  validateKwargs({ portNumber, protocol });
  try {
    const res = await upnpcCommand(`-e DAppNode -d ${portNumber} ${protocol}`);
    return parseCloseOutput(res);
  } catch (e) {
    parseCloseOutput(e.message);
    throw e;
  }
}

module.exports = close;
