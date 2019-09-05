import "mocha";
import { expect } from "chai";
import { mockDnp, mockVolume } from "../testUtils";

import parseDockerSystemDf from "../../src/utils/parseDockerSystemDf";

describe("Util: parseDockerSystemDf", function() {
  it("should extend the dnpList", () => {
    const volumeName = "dncore_vpndnpdappnodeeth_data";
    const volumeSize = 666836;
    const volumeSizePretty = "667 kB";
    const volumeLinks = 2;

    const dockerSystemDfDataSample = {
      LayersSize: 1092588,
      Images: [
        {
          Id:
            "sha256:2b8fd9751c4c0f5dd266fcae00707e67a2545ef34f9a29354585f93dac906749",
          ParentId: "",
          RepoTags: ["busybox:latest"],
          RepoDigests: [
            "busybox@sha256:a59906e33509d14c036c8678d687bd4eec81ed7c4b8ce907b888c607f6a1e0e6"
          ],
          Created: 1466724217,
          Size: 1092588,
          SharedSize: 0,
          VirtualSize: 1092588,
          Labels: {},
          Containers: 1
        }
      ],
      Containers: [
        {
          Id:
            "e575172ed11dc01bfce087fb27bee502db149e1a0fad7c296ad300bbff178148",
          Names: ["/top"],
          Image: "busybox",
          ImageID:
            "sha256:2b8fd9751c4c0f5dd266fcae00707e67a2545ef34f9a29354585f93dac906749",
          Command: "top",
          Created: 1472592424,
          Ports: [],
          SizeRootFs: 1092588,
          Labels: {},
          State: "exited",
          Status: "Exited (0) 56 minutes ago",
          HostConfig: {
            NetworkMode: "default"
          },
          NetworkSettings: {
            Networks: {
              bridge: {
                IPAMConfig: null,
                Links: null,
                Aliases: null,
                NetworkID:
                  "d687bc59335f0e5c9ee8193e5612e8aee000c8c62ea170cfb99c098f95899d92",
                EndpointID:
                  "8ed5115aeaad9abb174f68dcf135b49f11daf597678315231a32ca28441dec6a",
                Gateway: "172.18.0.1",
                IPAddress: "172.18.0.2",
                IPPrefixLen: 16,
                IPv6Gateway: "",
                GlobalIPv6Address: "",
                GlobalIPv6PrefixLen: 0,
                MacAddress: "02:42:ac:12:00:02"
              }
            }
          },
          Mounts: []
        }
      ],
      Volumes: [
        {
          Name: volumeName,
          Driver: "local",
          Mountpoint: "/var/lib/docker/volumes/my-volume/_data",
          Labels: null,
          Scope: "local",
          Options: null,
          UsageData: {
            Size: volumeSize,
            RefCount: volumeLinks
          }
        }
      ]
    };

    const dockerListOutput = [
      {
        ...mockDnp,
        volumes: [
          {
            ...mockVolume,
            name: undefined,
            type: "bind",
            path: "/etc/hostname"
          },
          {
            ...mockVolume,
            type: "volume",
            name: "dncore_vpndnpdappnodeeth_data",
            path: "/var/lib/docker/volumes/dncore_vpndnpdappnodeeth_data/_data"
          }
        ]
      }
    ];

    const res = parseDockerSystemDf({
      dockerSystemDfData: dockerSystemDfDataSample,
      dnpList: dockerListOutput
    });
    expect(res).to.deep.equal([
      {
        ...mockDnp,
        volumes: [
          {
            ...mockVolume,
            name: undefined,
            type: "bind",
            path: "/etc/hostname"
          },
          {
            ...mockVolume,
            type: "volume",
            name: "dncore_vpndnpdappnodeeth_data",
            path: "/var/lib/docker/volumes/dncore_vpndnpdappnodeeth_data/_data",
            links: volumeLinks,
            size: volumeSizePretty
          }
        ]
      }
    ]);
  });
});
