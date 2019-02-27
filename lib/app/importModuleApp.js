const fs = require('fs')
const fileUtil = require('../utils/file')

module.exports = ({ module, moduleName, config, importName = 'ModuleApp' }) => {
  if (module) {
    const { BUILD_KEBAB_CASE_PATH } = config
    const moduleFile = fileUtil.isAbsolute(module) ? module : fileUtil.resolvePath(module)
    if (fs.existsSync(moduleFile)) {
      moduleName = moduleName.replace(/'/g, "\\'")
      let modulePath = moduleName
      if (BUILD_KEBAB_CASE_PATH) {
        modulePath = modulePath.replace(/[A-Z]+/g, (t, index) =>
          (!index ? t : `-${t}`).toLowerCase()
        )
      }
      return [
        `import ${importName}, {
  title as moduleTitle 
} from '${moduleFile.replace(/([\\'])/g, '\\$1')}'`,
        `const moduleRouterPath = '/${modulePath}'`,
        `const moduleRouterName = '${moduleName}'`,
      ].join('\n')
    }
  }
  //
  return [
    `const ${importName} = null`,
    `const moduleTitle = ''`,
    `const moduleRouterPath = ''`,
    `const moduleRouterName = ''`,
  ].join('\n')
}
