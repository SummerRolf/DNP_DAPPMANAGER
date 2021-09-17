import "mocha";
import { expect } from "chai";
import { mockManifestWithImage } from "../../testUtils";
import { ManifestWithImage } from "../../../src/types";
import { uploadManifestRelease } from "../../integrationSpecs/buildReleaseManifest";
import { catCarReaderToMemory } from "../../../src/modules/ipfs/car";
import { localIpfsGateway } from "../../testIpfsUtils";

describe("IPFS remote", function () {
  this.timeout(100000 * 5);
  const testMockPrefix = "testmock-";
  const dnpName = testMockPrefix + "remote-gateway.dnp.dappnode.eth";
  const manifest: ManifestWithImage = {
    ...mockManifestWithImage,
    name: dnpName
  };
  let releaseHash: string;

  before(async () => {
    releaseHash = await uploadManifestRelease(manifest);
  });

  it("Should get content from IPFS gateway", async function () {
    // If the content hashed does not match the CID there is thrown an error
    const buff = await catCarReaderToMemory(localIpfsGateway, releaseHash);
    const contentParsed = JSON.parse(buff.toString());
    const expectedContent = {
      name: "testmock-remote-gateway.dnp.dappnode.eth",
      version: "0.0.0",
      description: "Mock description",
      type: "service",
      avatar: "/ipfs/QmWkAVYJhpwqApRfK4SZ6e2Xt2Daamc8uBpM1oMLmQ6fw4",
      dependencies: {},
      license: "Mock-license",
      image: {
        hash: "QmS56YysKP8aBLUh3rEm2iwqivdBdfbTF5fDUAwWNMhJQA",
        path: "mock/mock/mock.mock",
        size: 642158
      }
    };
    expect(contentParsed).to.deep.equal(expectedContent);
  });
});
