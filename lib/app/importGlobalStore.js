const fs = require('fs')
const fileUtil = require('../utils/file')

module.exports = ({ config, importName = 'globalStore' }) => {
  //
  const globalStoreEntry = config.BUILD_GLOBAL_STORE_PATH
  const globalStoreFile = fileUtil.isAbsolute(globalStoreEntry)
    ? globalStoreEntry
    : fileUtil.resolvePath(globalStoreEntry)
  //
  if (fs.existsSync(globalStoreFile)) {
    return `import ${importName} from '${globalStoreFile.replace(
      /([\\'])/g,
      '\\$1'
    )}'`
  } else {
    return `const ${importName} = {}`
  }
}
