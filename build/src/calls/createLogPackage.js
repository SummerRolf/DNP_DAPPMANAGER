const fs = require('fs')
const DockerCompose = require('../utils/DockerCompose')
const getPath =       require('../utils/getPath')
const res =           require('../utils/res')

// CALL DOCUMENTATION:
// > result = logs = <String with escape codes> (string)

function createLogPackage(params,
  // default option passed to allow testing
  dockerCompose) {

  return async function logPackage(req) {

    const PACKAGE_NAME = req[0]
    const DOCKERCOMPOSE_PATH = getPath.DOCKERCOMPOSE(PACKAGE_NAME, params)

    let logs
    if (fs.existsSync(DOCKERCOMPOSE_PATH)) {
      logs = await dockerCompose.logs(DOCKERCOMPOSE_PATH)
    } else {
      // If there is no dockerCompose try to log the container directly
      logs = await dockerCompose.log(PACKAGE_NAME)
      // throw Error('No docker-compose found with at: ' + DOCKERCOMPOSE_PATH)
    }

    return res.success('Got logs of package: ' + PACKAGE_NAME, {
      name: PACKAGE_NAME,
      logs
    })

  }
}


module.exports = createLogPackage