const Daemon = require("monero-rpc").Daemon;

// Monero's average block time is 2 minutes

const MIN_BLOCK_DIFF_SYNC = 15;

/**
 * Returns a chain data object for an [monero] API
 * @param {string} name = "Monero"
 * @param {string} api = "http://my.monero.dnp.dappnode.eth:18081"
 * @returns {object}
 * - On success: {
 *   syncing: true, {bool}
 *   message: "Blocks synced: 543000 / 654000", {string}
 *   progress: 0.83027522935,
 * }
 * - On error: {
 *   message: "Could not connect to RPC", {string}
 *   error: true {bool},
 * }
 */
async function monero({ name, api }) {
  const res = { name };
  try {
    const daemon = new Daemon(api);
    // Promisify the callback style daemon.getInfo. One-liner ugly syntax
    const info = await new Promise((res, rej) =>
      daemon.getInfo((e, r) => (e ? rej(e) : res(r)))
    );
    const highestBlock = info.target_height;
    const currentBlock = info.height;
    if (highestBlock - currentBlock > MIN_BLOCK_DIFF_SYNC) {
      res.syncing = true;
      res.message = `Blocks synced: ${currentBlock} / ${highestBlock}`;
      res.progress = currentBlock / highestBlock;
    } else {
      res.syncing = false;
      res.message = `Synced #${currentBlock}`;
    }
  } catch (e) {
    res.message = e.message;
    res.error = true;
  }
  return res;
}

module.exports = monero;
