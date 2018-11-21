const fs = require('fs')
const fileUtil = require('../utils/file')

module.exports = ({ config, importName = 'GlobalApp' }) => {
  const { BUILD_ROOT_APP_PATH, BUILD_APP_USE_VUEX, BUILD_APP_USE_ROUTER } = config
  const globalAppEntry = BUILD_ROOT_APP_PATH
  const globalAppFile = fileUtil.isAbsolute(globalAppEntry)
    ? globalAppEntry
    : fileUtil.resolvePath(globalAppEntry)
  //
  if (fs.existsSync(globalAppFile)) {
    return `import ${importName}, {
  ${BUILD_APP_USE_ROUTER ? 'router as routerOptions,' : ''}
  ${BUILD_APP_USE_VUEX ? 'store as storeOptions,' : ''}
  title as globalTitle,
} from '${globalAppFile.replace(/([\\'])/g, '\\$1')}'`
  }
  //
  return [
    `const ${importName} = null`,
    `const routerOptions = null`,
    `const storeOptions = null`,
    `const globalTitle = ''`,
  ].join('\n')
}
