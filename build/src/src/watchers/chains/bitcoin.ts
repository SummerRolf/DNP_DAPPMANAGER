const Client = require("bitcoin-core");
import shell from "../../utils/shell";
import { ChainDataInterface } from "../../types";

const MIN_BLOCK_DIFF_SYNC = 3;

// After revising 'bitcoin-core' source code,
// there is no problem in creating a new instance of Client on each request

// Cache the blockIndex to prevent unnecessary calls
const cache: {
  [api: string]: {
    block: number;
    blockIndex: number;
  };
} = {};

/**
 * Returns a chain data object for a [bitcoin] API
 * @param {string} name = "Bitcoin"
 * @param {string} api = "my.bitcoin.dnp.dappnode.eth"
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
export default async function bitcoin(
  name: string,
  api: string
): Promise<ChainDataInterface> {
  try {
    // To initialize the bitcoin client, the RPC user and password are necessary
    // They are stored in the package envs
    const cmd = `docker inspect --format='{{.Config.Env}}' DAppNodePackage-bitcoin.dnp.dappnode.eth`;
    let envsString = await shell(cmd);
    if (typeof envsString !== "string") throw Error("Can't read bitcoin ENVs");
    // envsString = '[BTC_RPCUSER=dappnode BTC_RPCPASSWORD=dappnode BTC_TXINDEX=1 PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin]';
    if (envsString.startsWith("[")) envsString = envsString.substring(1);
    if (envsString.endsWith("]"))
      envsString = envsString.substring(0, envsString.length - 1);
    let rpcUser;
    let rpcPassword;
    envsString.split(" ").forEach(envPair => {
      if (envPair.startsWith("BTC_RPCUSER")) rpcUser = envPair.split("=")[1];
      if (envPair.startsWith("BTC_RPCPASSWORD"))
        rpcPassword = envPair.split("=")[1];
    });
    if (typeof rpcUser !== "string") throw Error("Couldn't get rpcUser");
    if (typeof rpcPassword !== "string")
      throw Error("Couldn't get rpcPassword");

    const client = new Client({
      host: api,
      password: rpcUser,
      username: rpcPassword
    });
    const blockIndex = await client.getBlockCount();
    // If the cached blockIndex is the same, return cached block
    const block =
      (cache[api] || {}).blockIndex === blockIndex
        ? cache[api].block
        : await client.getBlockHash(blockIndex).then(client.getBlock);
    // Update cached values
    cache[api] = { blockIndex, block };
    const secondsDiff = Math.floor(Date.now() / 1000) - block.time;
    const blockDiffAprox = Math.floor(secondsDiff / (60 * 10));

    if (blockDiffAprox > MIN_BLOCK_DIFF_SYNC)
      return {
        name,
        syncing: true,
        error: false,
        message: `Blocks synced: ${blockIndex} / ${blockDiffAprox +
          blockIndex}`,
        progress: blockIndex / (blockDiffAprox + blockIndex)
      };
    else
      return {
        name,
        syncing: false,
        error: false,
        message: `Synced #${blockIndex}`
      };
  } catch (e) {
    return {
      name,
      syncing: false,
      error: true,
      message: e.message
    };
  }
}
