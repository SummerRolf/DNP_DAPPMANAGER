const { promisify } = require("util");
const getPath = require("utils/getPath");
const generate = require("utils/generate");
const fs = require("fs");
const validate = require("utils/validate");
const restartPatch = require("modules/restartPatch");
const logUi = require("utils/logUi");
const params = require("params");
const docker = require("modules/docker");
const ipfs = require("modules/ipfs");
const semver = require("semver");

// Promisify fs methods
const removeFile = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);

/**
 * Handles the download of a package.
 * @param {object} kwargs which should contain at least
 * - pkg: packageReq + its manifest. It is expected that in the previous step of the
 *        installation the manifest is attached to this object.
 * - id: task id to allow progress updates
 * @returns {*}
 */
async function download({ pkg, id }) {
  // call IPFS, store the file in the repo's folder
  // load the image to docker
  const { manifest } = pkg;
  const { name, version, isCore, fromIpfs } = manifest;
  const imageName = manifest.image.path;
  const imageHash = manifest.image.hash;
  const imageSize = manifest.image.size;

  // Write manifest and docker-compose
  await writeFile(
    validate.path(getPath.manifest(name, params, isCore)),
    generate.manifest(manifest)
  );
  await writeFile(
    validate.path(getPath.dockerCompose(name, params, isCore)),
    generate.dockerCompose(manifest, params, isCore, fromIpfs)
  );

  // Define the logging function
  const log = percent => {
    if (percent > 99) percent = 99;
    logUi({ id, name, message: `Downloading ${percent}%` });
  };
  // Define the rounding function to not spam updates
  const displayRes = 2;
  const round = x => displayRes * Math.ceil((100 * x) / imageSize / displayRes);
  // Keep track of the bytes downloaded
  let bytes = 0;
  let prev = 0;
  const logChunk = chunk => {
    if (round((bytes += chunk.length)) > prev) {
      log((prev = round(bytes)));
    }
  };

  logUi({ id, name, message: "Starting download..." });
  const imagePath = validate.path(
    getPath.image(name, imageName, params, isCore)
  );
  await ipfs.download(imageHash, imagePath, logChunk);

  logUi({ id, name, message: "Loading image..." });
  await docker.load(imagePath);

  // For IPFS downloads, retag image
  // 0.1.11 => 0.1.11-ipfs-QmSaHiGWDStTZg6G3YQi5herfaNYoonPihjFzCcQoJy8Wc
  if (fromIpfs) {
    const fromTag = name + ":" + version;
    const toTag = name + ":" + fromIpfs;
    await docker.tag(fromTag, toTag);
  }

  logUi({ id, name, message: "Cleaning files..." });
  await removeFile(imagePath);

  // Final log
  logUi({ id, name, message: "Package downloaded" });
}

/**
 * Handles the execution of a package.
 * @param {object} kwargs which should contain at least
 * - pkg: packageReq + its manifest. It is expected that in the previous step of the
 *        installation the manifest is attached to this object.
 * - id: task id to allow progress updates
 * @returns {*}
 */
async function run({ pkg, id }) {
  const { name, manifest } = pkg;
  const { isCore, version } = manifest;
  const dockerComposePath = getPath.dockerCompose(name, params, isCore);

  logUi({ id, name, message: "starting package... " });
  // patch to prevent installer from crashing
  if (name == "dappmanager.dnp.dappnode.eth") {
    await restartPatch(name + ":" + version);
  } else {
    await docker.compose.up(dockerComposePath);
  }

  // Clean old images. This command can throw errors.
  // If the images were removed successfuly the dappmanger will print logs:
  // Untagged: package.dnp.dappnode.eth:0.1.6
  logUi({ id, name, message: "cleaning old images" });
  const currentImgs = await docker.images().catch(() => "");
  await docker
    .rmi(
      (currentImgs || "").split(/\r|\n/).filter(p => {
        const [pName, pVer] = p.split(":");
        return pName === name && semver.valid(pVer) && pVer !== version;
      })
    )
    .catch(() => {});

  // Final log
  logUi({ id, name, message: "package started" });
}

module.exports = {
  download,
  run
};
