import { expect } from "chai";
import fs from "fs";
import { PackageContainer } from "@dappnode/common";
import { migrateCoreNetworkAndAliasInCompose } from "../../../src/modules/migrations/addAliasToRunningContainers.js";
import { getDnCoreNetworkContainerConfig } from "../../../src/modules/docker/index.js";
import params from "../../../src/params.js";
import { mockContainer, shellSafe } from "../../testUtils.js";

describe("Migration", () => {
  const container: PackageContainer = {
    ...mockContainer,
    containerName: "DAppNodeCore-dappmanager.dnp.dappnode.eth",
    dnpName: "test-migration",
    serviceName: "dappmanager.dnp.dappnode.eth",
    networks: [
      { name: "random", ip: "10.0.1.1" },
      { name: "dncore_network", ip: "172.33.1.7" }
    ]
  };

  const composeAlreadyMigrated = `
version: '3.4'
networks:
  dncore_network:
    name: dncore_network
    external: true
services:
  dappmanager.dnp.dappnode.eth:
    image: "chentex/random-logger"
    container_name: DAppNodeCore-dappmanager.dnp.dappnode.eth
    restart: always
    dns: 172.33.1.2
    networks:
      dncore_network:
        ipv4_address: 172.33.1.7`;

  const composeToBeMigratedBefore = `
version: '3.4'
networks:
  network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.33.0.0/16
services:
  dappmanager.dnp.dappnode.eth:
    image: "chentex/random-logger"
    container_name: DAppNodeCore-dappmanager.dnp.dappnode.eth
    restart: always
    dns: 172.33.1.2
    networks:
      network:
        ipv4_address: 172.33.1.7`;

  const dncoreNetwork = params.DNP_PRIVATE_NETWORK_NAME;
  const containerName = "DAppNodeCore-dappmanager.dnp.dappnode.eth";
  const randomImage = "chentex/random-logger";
  const testMigrationPath =
    process.cwd() + "/test/integration/migrationCompose";

  before("Run random container", async () => {
    // Create compose
    await shellSafe(`mkdir ${testMigrationPath}/test-migration`);
    // Compose to be migrated
    fs.writeFileSync(
      `${testMigrationPath}/test-migration/docker-compose.yml`,
      composeToBeMigratedBefore
    );
    // Compose already migrated
    fs.writeFileSync(
      `${testMigrationPath}/test-migration/docker-compose-migrated.yml`,
      composeAlreadyMigrated
    );
    // Redeclare global variables
    params.DNCORE_DIR = testMigrationPath;
    params.REPO_DIR = testMigrationPath;
    // Startup container
    await shellSafe(
      `docker-compose -f ${testMigrationPath}/test-migration/docker-compose.yml -p DNCORE up -d`
    );
    const containerkExists = await shellSafe(
      `docker container ls --filter name=${containerName}`
    );

    const networkExists = await shellSafe(
      `docker network ls --filter name=${dncoreNetwork}`
    );

    if (!containerkExists || !networkExists)
      throw Error("Error creating container or/and dncore_network");
  });

  it("Should do network and alias migration", async () => {
    const composeMigratedExpected = `
version: '3.5'
networks:
  dncore_network:
    external: true
    name: dncore_network
services:
  dappmanager.dnp.dappnode.eth:
    image: chentex/random-logger
    container_name: DAppNodeCore-dappmanager.dnp.dappnode.eth
    restart: always
    dns: 172.33.1.2
    networks:
      dncore_network:
        ipv4_address: 172.33.1.7
        aliases:
          - dappmanager.dnp.dappnode.eth.test-migration.dappnode`;

    migrateCoreNetworkAndAliasInCompose(
      container,
      "dappmanager.dnp.dappnode.eth.test-migration.dappnode"
    );
    const composeAfter = fs.readFileSync(
      `${testMigrationPath}/test-migration/docker-compose.yml`,
      { encoding: "utf8" }
    );
    expect(composeAfter.trim()).to.equal(composeMigratedExpected.trim());
  });

  it("Should do not do migration", async () => {
    migrateCoreNetworkAndAliasInCompose(
      container,
      "dappmanager.dnp.dappnode.eth.test-migration.dappnode"
    );
    const composeAfter = fs.readFileSync(
      `${testMigrationPath}/test-migration/docker-compose-migrated.yml`,
      { encoding: "utf8" }
    );
    expect(composeAfter.trim()).to.equal(composeAlreadyMigrated.trim());
  });

  after("Remove test setup", async () => {
    // Disconnect from network
    await shellSafe(
      `docker network disconnect ${dncoreNetwork} ${containerName} --force`
    );
    // Remove network
    await shellSafe(`docker network rm dncore_network`);
    // Remove container
    await shellSafe(`docker rm ${containerName} --force`);
    // Remove image
    await shellSafe(`docker image rm ${randomImage}`);
    // Remove dir
    await shellSafe(`rm -rf ${testMigrationPath}/test-migration`);

    // Return global vars to tests normal values
    params.DNCORE_DIR = "./DNCORE";
    params.REPO_DIR = "./dnp_repo";
  });
});

// TODO: find better ways to test getting the DN_CORE network config by mocking a new docker container
describe("get DN_CORE network config", () => {
  // Test case: Should return the correct alias information when the network exists
  it("should return a 'not null' docker network when calling dappmanager container", async () => {
    // Set dappmanager container name
    const containerName = "DAppNodeCore-dappmanager.dnp.dappnode.eth";
    
    // Mock the dockerContainerInspect function
    const result = await getDnCoreNetworkContainerConfig(containerName);
    expect(result).to.not.be.null;

    // "result" looks like:
    // const mockNetwork = {
    //   IPAMConfig: { IPv4Address: '172.33.1.7' },
    //   Links: null,
    //   Aliases: [
    //     'DAppNodeCore-dappmanager.dnp.dappnode.eth',
    //     'dappmanager.dnp.dappnode.eth',
    //     'dappmanager.dappnode',
    //     'd6a8fb11b1a4'
    //   ],
    //   NetworkID: '8997fa230b182a0f75d331acf04dca440eb948af8d39966baab02f5ae0a3f566',
    //   EndpointID: '2b3728a7d08b5e41da432bcac054e366d6c88def3bfac12749b87c37eae98836',
    //   Gateway: '172.33.0.1',
    //   IPAddress: '172.33.1.7',
    //   IPPrefixLen: 16,
    //   IPv6Gateway: '',
    //   GlobalIPv6Address: '',
    //   GlobalIPv6PrefixLen: 0,
    //   MacAddress: '02:42:ac:21:01:07',
    //   DriverOpts: null
    // };
    
  });
});

