const fs = require('fs')
const fileUtil = require('../utils/file')

module.exports = ({ module, moduleName, config, importName = 'ModuleApp' }) => {
  if (module) {
    const { BUILD_USE_HYPHEN_NAME } = config
    const moduleFile = fileUtil.isAbsolute(module)
      ? module
      : fileUtil.resolvePath(module)
    if (fs.existsSync(moduleFile)) {
      moduleName = moduleName.replace(/'/g, "\\'")
      if (BUILD_USE_HYPHEN_NAME) {
        moduleName = moduleName.replace(/[A-Z]+/g, (t, index) =>
          (!index ? t : `-${t}`).toLowerCase()
        )
      }
      return [
        `import ${importName}, {
  title as moduleTitle 
} from '${moduleFile.replace(/([\\'])/g, '\\$1')}'`,
        `const moduleRouterPath = '${moduleName}'`,
      ].join('\n')
    }
  }
  //
  return [
    `const ${importName} = null`,
    `const moduleTitle = ''`,
    `const moduleRouterPath = ''`,
  ].join('\n')
}
