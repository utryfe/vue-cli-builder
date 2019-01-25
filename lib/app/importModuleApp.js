const fs = require('fs')
const fileUtil = require('../utils/file')

module.exports = ({ module, moduleName, importName = 'ModuleApp' }) => {
  if (module) {
    const moduleFile = fileUtil.isAbsolute(module)
      ? module
      : fileUtil.resolvePath(module)
    if (fs.existsSync(moduleFile)) {
      return [
        `import ${importName}, {
  title as moduleTitle 
} from '${moduleFile.replace(/([\\'])/g, '\\$1')}'`,
        `const moduleRouterPath = '${moduleName.replace(/'/g, "\\'")}'`,
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
