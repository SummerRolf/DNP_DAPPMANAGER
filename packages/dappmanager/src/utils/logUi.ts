import * as eventBus from "../eventBus";
import { ProgressLog } from "../types";
import { logs } from "../logs";

export type Log = (name: string, message: string) => void;

/**
 * Some remote procedure calls (RPC) need a continuous update.
 * This function call be called at any point of the app and it
 * will emit and event received by the autobahn session in index.js
 * which will be broadcasted to clients.
 *
 * [NOTE]: Params are de-structured to expose them
 * @param {string} id, overall log id (to bundle multiple logs)
 * id = "ln.dnp.dappnode.eth@/ipfs/Qmabcdf"
 * @param {Sting} name, dnpName the log is referring to
 * name = "bitcoin.dnp.dappnode.eth"
 * @param {string} message, log message
 * message = "Downloading 75%"
 */
function logUi(progressLog: ProgressLog): void {
  const { name, message } = progressLog;
  // Log them internally. But skip download progress logs, too spam-y
  if (message && !message.includes("%"))
    logs.info("Progress log", name, message);

  eventBus.logUi.emit(progressLog);
}

export function logUiClear({ id }: { id: string }): void {
  eventBus.logUi.emit({ id, name: "", message: "", clear: true });
}

/**
 * Curried version of logUi to simplify code
 * @param {string} id, overall log id (to bundle multiple logs)
 */
export const getLogUi = (id: string): Log => (
  name: string,
  message: string
): void => logUi({ id, name, message });
