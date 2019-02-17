const fs = require('fs')
const fileUtil = require('../utils/file')

module.exports = ({ config, importName = 'globalRoutes' }) => {
  //
  const globalRouterEntry = config.BUILD_GLOBAL_ROUTER_PATH
  const globalRouterFile = fileUtil.isAbsolute(globalRouterEntry)
    ? globalRouterEntry
    : fileUtil.resolvePath(globalRouterEntry)
  //
  if (fs.existsSync(globalRouterFile)) {
    return `import ${importName} from '${globalRouterFile.replace(/([\\'])/g, '\\$1')}'`
  } else {
    return `const ${importName} = []`
  }
}
