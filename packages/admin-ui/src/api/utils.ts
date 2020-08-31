import { dappmanagerName, coreName } from "params";

/**
 * Restarting the DAPPMANAGER will cause this error
 * ```bash
 * Error: wamp.error.canceled - callee disconnected from in-flight request
 * ```
 * Expose this function as a utility of the API to easily modified if autobahn
 * is changed for a regular HTTP RPC
 * @param e
 */
function isCallDisconnectedError(e: Error): boolean {
  return e.message.includes("wamp.error.canceled");
}

/**
 * Wrapper to convert API calls that may throw a callee disconnected error
 * into successful resolved calls
 * @param fn
 */
export function continueIfCalleDisconnected(
  fn: () => Promise<void>,
  dnpName: string
): () => Promise<void> {
  return async function(...args) {
    try {
      await fn(...args);
    } catch (e) {
      if (
        isCallDisconnectedError(e) &&
        (!dnpName || dnpName === dappmanagerName || dnpName === coreName)
      )
        return;
      else throw e;
    }
  };
}
