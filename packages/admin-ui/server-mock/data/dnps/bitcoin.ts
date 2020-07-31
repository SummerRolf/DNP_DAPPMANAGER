import { MockDnp } from "./types";

export const bitcoin: MockDnp = {
  avatar: "https://en.bitcoin.it/w/images/en/2/29/BC_Logo_.png",

  metadata: {
    name: "bitcoin.dnp.dappnode.eth",
    version: "0.1.3",
    description:
      "The Bitcoin Core daemon (0.18.0). Bitcoind is a program that implements the Bitcoin protocol for remote procedure call (RPC) use.",
    type: "service",
    style: {
      featuredBackground: "linear-gradient(to right, #4b3317, #cb6e00)",
      featuredColor: "white"
    },
    author:
      "DAppNode Association <admin@dappnode.io> (https://github.com/dappnode)",
    contributors: [
      "Abel Boldú (@vdo)",
      "Eduardo Antuña <eduadiez@gmail.com> (https://github.com/eduadiez)",
      "Loco del Bitcoin <ellocodelbitcoin@gmail.com>"
    ],
    keywords: ["bitcoin", "btc"],
    // @ts-ignore
    homepage: {
      homepage: "https://github.com/dappnode/DAppNodePackage-bitcoin#readme"
    },
    repository: {
      type: "git",
      url: "git+https://github.com/dappnode/DAppNodePackage-bitcoin.git"
    },
    bugs: {
      url: "https://github.com/dappnode/DAppNodePackage-bitcoin/issues"
    },
    license: "GPL-3.0"
  },

  userSettings: {
    portMappings: { "8333": "8333" },
    namedVolumeMountpoints: {
      bitcoin_data: "",
      bitcoin_data_old: "/dev0/data",
      bitcoin_data_old_legacy: "legacy:/dev1/data"
    },
    environment: {
      BTC_RPCUSER: "dappnode",
      BTC_RPCPASSWORD: "dappnode",
      BTC_TXINDEX: "1",
      BTC_PRUNE: "0"
    }
  },

  setupWizard: {
    version: "2",
    fields: [
      {
        id: "bitcoinData",
        title: "Custom volume data path",
        description:
          "If you want to store the Bitcoin blockchain is a separate drive, enter the absolute path of the location of an external drive.",
        target: {
          type: "namedVolumeMountpoint",
          volumeName: "bitcoin_data"
        }
      },
      {
        id: "bitcoinDataOld",
        title: "Custom volume data old path",
        description:
          "Already set path to test that it's not editable. If you want to store the Bitcoin blockchain is a separate drive, enter the absolute path of the location of an external drive.",
        target: {
          type: "namedVolumeMountpoint",
          volumeName: "bitcoin_data_old"
        }
      },
      {
        id: "bitcoinDataOldLegacy",
        title: "Custom volume data old legacy path",
        description:
          "Already set path to test that it's not editable, with legacy setting. If you want to store the Bitcoin blockchain is a separate drive, enter the absolute path of the location of an external drive.",
        target: {
          type: "namedVolumeMountpoint",
          volumeName: "bitcoin_data_old_legacy"
        }
      },
      {
        id: "bitcoinAllVolumes",
        title: "All volumes",
        description: "This mountpoint selector should affect all named volumes",
        target: {
          type: "allNamedVolumesMountpoint"
        }
      },
      {
        id: "bitcoinName",
        title: "Bitcoin name",
        description: "Useless parameter to test performance",
        target: {
          type: "environment",
          name: "BITCOIN_NAME"
        }
      }
    ]
  }
};
