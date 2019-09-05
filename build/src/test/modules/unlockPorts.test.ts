import "mocha";
import { expect } from "chai";
import fs from "fs";
import * as getPath from "../../src/utils/getPath";
import * as validate from "../../src/utils/validate";
const proxyquire = require("proxyquire").noCallThru();

describe("Module: unlockPorts", function() {
  const params = {
    DNCORE_DIR: "DNCORE",
    REPO_DIR: "test_files/"
  };

  const pkg = {
    name: "kovan.dnp.dappnode.eth",
    ver: "0.1.0",
    manifest: {
      image: {
        ports: ["30303", "30303/udp"]
      },
      isCore: false
    }
  };

  const dockerComposePath = getPath.dockerCompose(pkg.name, params, false);

  const { default: unlockPorts } = proxyquire("../../src/modules/unlockPorts", {
    "../params": params
  });

  before(() => {
    validate.path(dockerComposePath);
    const dockerComposeString = `
version: '3.4'
services:
  ${pkg.name}:
    ports:
      - '32768:30303/udp'
      - '32768:30303'
      - '5001:5001'
`;
    fs.writeFileSync(dockerComposePath, dockerComposeString);
  });

  it("should have modified the docker-compose (NON core)", async () => {
    await unlockPorts(dockerComposePath);
    const dc = fs.readFileSync(dockerComposePath, "utf8");
    expect(dc).to.equal(`version: '3.4'
services:
  ${pkg.name}:
    ports:
      - 30303/udp
      - '30303'
      - '5001:5001'
`);
  });

  after(() => {
    fs.unlinkSync(dockerComposePath);
  });
});
