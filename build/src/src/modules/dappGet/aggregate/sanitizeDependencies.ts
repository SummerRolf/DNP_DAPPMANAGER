import { Dependencies } from "../../../types";
import { mapValues } from "lodash";
// WARNING: manifest's dependencies is an external uncontrolled input, verify

export default function sanitizeDependencies(
  dependencies: Dependencies
): Dependencies {
  if (!dependencies) {
    throw Error("SANITIZE-ERROR: Dependencies is not defined");
  }
  if (typeof dependencies !== "object") {
    throw Error(
      `SANITIZE-ERROR: Dependencies is not an object, dependencies: ${JSON.stringify(
        dependencies
      )}`
    );
  }

  return mapValues(dependencies, version =>
    version === "latest" ? "*" : version
  );
}
