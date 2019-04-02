const { isDirectory, joinPath, existsSync, ensurePathQuote } = require('../utils/file')

module.exports = ({ module, importName = 'moduleMain' }) => {
  const mainFile = module
    ? joinPath(module, isDirectory(module) ? '.' : '..', 'main.js')
    : ''
  if (existsSync(mainFile)) {
    return `import ${importName} from '${ensurePathQuote(mainFile)}'\n`
  }
  return `const ${importName} = undefined\n`
}
