import "mocha";
import { expect } from "chai";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { Manifest, Compose } from "../../../src/types";

import {
  parseUnsafeCompose,
  validateCompose,
  verifyCompose
} from "../../../src/modules/compose";
import { isNotFoundError } from "../../../src/utils/node";

const specsDir = path.join(__dirname, "../releaseSpecs");

const paths = {
  manifest: "dappnode_package.json",
  compose: "docker-compose.yml",
  composeParsed: "docker-compose.parsed.yml"
};

describe("Compose specs, against real DNPs", () => {
  const files = fs.readdirSync(specsDir);
  for (const dirName of files) {
    describe(`${dirName}`, () => {
      function loadFile<T>(fileName: string): T {
        const filePath = path.join(specsDir, dirName, fileName);
        return yaml.safeLoad(fs.readFileSync(filePath, "utf8"));
      }
      function loadFileIfExists<T>(fileName: string): T | undefined {
        try {
          return loadFile<T>(fileName);
        } catch (e) {
          if (!isNotFoundError(e)) throw e;
        }
      }

      const manifest = loadFile<Manifest>(paths.manifest);
      const unsafeCompose = loadFile<Compose>(paths.compose);
      const composeParsed = loadFileIfExists<Compose>(paths.composeParsed);

      it("validateCompose", () => {
        validateCompose(unsafeCompose);
      });

      it("parseUnsafeCompose", () => {
        const safeCompose = parseUnsafeCompose(unsafeCompose, manifest);
        if (!composeParsed) {
          console.log(JSON.stringify(safeCompose, null, 2));
          fs.writeFileSync(
            path.join(specsDir, dirName, paths.composeParsed),
            yaml.safeDump(safeCompose)
          );
        } else {
          expect(safeCompose).to.deep.equal(composeParsed);
        }
      });

      it("verifyCompose", () => {
        verifyCompose(unsafeCompose);
      });
    });
  }
});