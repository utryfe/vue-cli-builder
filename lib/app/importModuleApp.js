const fs = require('fs')
const fileUtil = require('../utils/file')

module.exports = ({ module, importName = 'ModuleApp' }) => {
  if (module) {
    const moduleFile = fileUtil.isAbsolute(module)
      ? module
      : fileUtil.resolvePath(module)
    if (fs.existsSync(moduleFile)) {
      return `import ${importName}, {
  title as moduleTitle 
} from '${moduleFile.replace(/([\\'])/g, '\\$1')}'`
    }
  }
  //
  return [`const ${importName} = null`, `const moduleTitle = ''`].join('\n')
}
