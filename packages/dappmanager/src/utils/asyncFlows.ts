import async from "async";
import memoize from "memoizee";
import { logs } from "../logs";

/**
 * Makes sure the target async function is running only once at every instant.
 * It's similar to throttle, but instead of waiting an interval it waits for
 * completition. It uses the async.cargo function to achieve this behaviour.
 *
 *  Requests:       || | | ||| |                              |
 *  Function runs:  |--------------->|------------->|         |---------->|
 *
 *                  Multiple rapid calls are queued           Then it will wait
 *                  but the function will run one             for future calls
 *                  last time since there has been            and run when
 *                  a call after it started running           requested
 *
 * [NOTE]: The target function should NEVER be called with different arguments
 * since the arguments of non-first callers will be ignored.
 * [ONLY] use this function in recurring state checks, i.e. `natRenewal/index.ts`
 *
 * @param fn Target function
 */
export function runOnlyOneSequentially<A, R>(
  fn: (arg?: A) => Promise<R>
): (arg?: A) => void {
  // create a cargo object with an infinite payload
  const cargo = async.cargo(function(
    tasks: { arg: A }[],
    callback: () => void
  ) {
    fn(tasks[0]?.arg)
      .then(() => {
        callback();
      })
      .catch(e => {
        logs.error(
          `WARNING! functions in runOnlyOneSequentially MUST not throw, wrap them in try/catch blocks`,
          e
        );
      });
  },
  1e9);

  return function(arg?: A): void {
    cargo.push({ arg });
  };
}

/**
 * Makes sure the target function is running only once at every instant.
 * When it's called multiple times it will only run once and return the
 * SAME result to all calls that happened within that run.
 *
 * Requests:       | ||| | || |                      |
 * Function runs:  |--------------->|                |------------>|
 *
 * [NOTE]: The target function should NEVER be called with different arguments
 * since the arguments of non-first callers will be ignored.
 * [ONLY] use this function to query a state that changes with a low frequency.
 *
 * @param fn Target function (Callback style)
 */
export function runOnlyOneReturnToAll<F extends (...args: any[]) => any>(
  f: F
): F {
  return memoize(f, {
    // Wait for Promises to resolve. Do not cache rejections
    promise: true,
    // Return the computed cached result to only waiting calls while the
    // result if being computed. Right as it is resolved, compute it again
    maxAge: 1
  });
}

/**
 * Waits `ms` miliseconds
 *
 * @param ms Pause time (ms)
 */
export function pause(ms: number): Promise<void> {
  return new Promise(
    (resolve): void => {
      setTimeout(resolve, ms);
    }
  );
}

/**
 * Like setInterval but you can pass a list ms values
 *
 * **Example**
 * ```js
 * setIntervalDynamic(callback, [1000, 2000, 3000])
 * ```
 * - First interval will take 1000 ms
 * - Second interval will take 2000 ms
 * - Third and all subsequent will take 3000 ms
 *
 * @param fn callback
 * @param msArray [1000, 2000, 3000]
 */
export function setIntervalDynamic(
  fn: () => void | Promise<void>,
  msArray: number[]
): void {
  const msFinal = msArray[msArray.length - 1];
  if (typeof msFinal !== "number")
    throw Error(`msArray must have at least one element`);

  function run(): void {
    setTimeout(() => {
      fn();
      run();
    }, msArray.shift() || msFinal);
  }

  run();
}
