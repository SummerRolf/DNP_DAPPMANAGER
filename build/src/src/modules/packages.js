const {promisify} = require('util');
const getPath = require('utils/getPath');
const parse = require('utils/parse');
const generate = require('utils/generate');
const fs = require('fs');
const validate = require('utils/validate');
const restartPatch = require('modules/restartPatch');
const logUI = require('utils/logUI');
const params = require('params');
const docker = require('modules/docker');
const ipfs = require('modules/ipfs');

// packageList should be an array of package objects, i.e.
// [
//   {
//     name: 'packageA',
//     ver: 'latest',
//     dep: <dep object>,
//     manifest: <manifest object>
//   },
//   ...
// ]


// Promisify fs methods
const removeFile = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);

// Return main method
async function download({pkg, logId}) {
  // call IPFS, store the file in the repo's folder
  // load the image to docker
  const PACKAGE_NAME = pkg.name;
  const MANIFEST = pkg.manifest;
  const IMAGE_NAME = parse.manifest.imageName(MANIFEST);
  const IMAGE_HASH = parse.manifest.imageHash(MANIFEST);
  const IMAGE_SIZE = parse.manifest.imageSize(MANIFEST);

  // isCORE?
  const isCORE = (MANIFEST.type == 'dncore' && pkg.allowCORE);
  pkg.isCORE = isCORE;
  // inform the user of improper usage
  if (MANIFEST.type == 'dncore' && !pkg.allowCORE) {
    throw Error('Requesting to install an unverified dncore package');
  }

  // Generate paths
  const MANIFEST_PATH = getPath.manifest(PACKAGE_NAME, params, isCORE);
  const DOCKERCOMPOSE_PATH = getPath.dockerCompose(PACKAGE_NAME, params, isCORE);
  const IMAGE_PATH = getPath.image(PACKAGE_NAME, IMAGE_NAME, params, isCORE);
  // Validate paths
  validate.path(MANIFEST_PATH);
  validate.path(DOCKERCOMPOSE_PATH);
  validate.path(IMAGE_PATH);
  // Generate files
  const MANIFEST_DATA = generate.manifest(MANIFEST);
  const DOCKERCOMPOSE_DATA = generate.dockerCompose(MANIFEST, params, isCORE);

  // Write manifest and docker-compose
  await writeFile(MANIFEST_PATH, MANIFEST_DATA);
  await writeFile(DOCKERCOMPOSE_PATH, DOCKERCOMPOSE_DATA);

  // Define the logging function
  const log = (percent) =>
    logUI({logId, pkg: PACKAGE_NAME, msg: 'Downloading... '+percent+' %'});
  // Define the rounding function to not spam updates
  const displayRes = 2;
  const round = (x) => displayRes*Math.ceil(100*x/IMAGE_SIZE/displayRes);
  // Keep track of the bytes downloaded
  let bytes = 0; let prev = 0;
  const logChunk = (chunk) => {
    if (round(bytes += chunk.length) > prev) {
      log(prev = round(bytes));
    }
  };

  logUI({logId, pkg: PACKAGE_NAME, msg: 'starting download...'});
  await ipfs.download(
    IMAGE_HASH,
    IMAGE_PATH,
    logChunk,
  );

  logUI({logId, pkg: PACKAGE_NAME, msg: 'loading image...'});
  await docker.load(IMAGE_PATH);

  logUI({logId, pkg: PACKAGE_NAME, msg: 'cleaning files...'});
  await removeFile(IMAGE_PATH);
}


async function run({pkg, logId}) {
  const PACKAGE_NAME = pkg.name;
  const MANIFEST = pkg.manifest;
  const isCORE = pkg.isCORE;
  const VERSION = parse.manifest.version(MANIFEST);
  const DOCKERCOMPOSE_PATH = getPath.dockerCompose(PACKAGE_NAME, params, isCORE);

  logUI({logId, pkg: PACKAGE_NAME, msg: 'starting package... '});
  // patch to prevent installer from crashing
  if (PACKAGE_NAME == 'dappmanager.dnp.dappnode.eth') {
    await restartPatch(PACKAGE_NAME+':'+VERSION);
  } else {
    await docker.compose.up(DOCKERCOMPOSE_PATH);
  }
  logUI({logId, pkg: PACKAGE_NAME, msg: 'package started'});
}


module.exports = {
  download,
  run,
};
