const { existsSync, getAbsPath, ensurePathQuote } = require('../utils/file')

module.exports = ({ importName = 'globalMain' }) => {
  const globalMainFile = getAbsPath('src/main.js')
  if (existsSync(globalMainFile)) {
    return `import ${importName} from '${ensurePathQuote(globalMainFile)}'\n`
  }
  return `const ${importName} = undefined\n`
}
