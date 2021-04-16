import * as dashboard from "./dashboard";
import * as VPN from "./devices";
import * as installer from "./installer";
import * as packages from "./packages";
import * as sdk from "./sdk";
import * as support from "./support";
import * as system from "./system";
import * as wireguard from "./wireguard";
import * as wifi from "./wifi";

export default {
  dashboard,
  wifi,
  VPN,
  installer,
  packages,
  sdk,
  support,
  system,
  wireguard
};

export const defaultPage = dashboard;
