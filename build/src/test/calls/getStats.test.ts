import "mocha";
import { expect } from "chai";
const proxyquire = require("proxyquire").noCallThru();

const testedCmdResponses: { [cmd: string]: string } = {
  // "grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}'":
  //   "46.3738",
  "free / | awk 'NR==2 { print $2}'": "7903472",
  "free / | awk 'NR==3 { print $3}'": "1203200",
  "df / | awk 'NR>1 { print $5}'": "39%"
};

describe("Calls > getStats", function() {
  async function shellExec(cmd: string): Promise<string> {
    if (!testedCmdResponses[cmd]) throw Error(`Unknown cmd: ${cmd}`);
    return testedCmdResponses[cmd];
  }

  const os = {
    cpus: (): { cpu: string }[] => [{ cpu: "info" }],
    loadavg: (): number[] => [0.5]
  };

  const { default: getStats } = proxyquire("../../src/calls/getStats", {
    "../utils/shell": shellExec,
    os: os
  });

  it("should return the expected result", async () => {
    const res = await getStats();
    expect(res).to.be.ok;
    expect(res).to.have.property("message");
    expect(res.result).to.deep.equal({
      cpu: "50%",
      disk: "39%",
      memory: "15%"
    });
  });
});
