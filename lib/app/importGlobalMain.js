const { existsSync, getAbsPath, ensurePathQuote } = require('../utils/file')

module.exports = ({ importName = 'globalMain' }) => {
  const globalMainFile = getAbsPath('src/main.js')
  const codeFragment = ['// main.js\n']
  if (existsSync(globalMainFile)) {
    codeFragment.push(`import ${importName} from '${ensurePathQuote(globalMainFile)}'\n`)
  } else {
    codeFragment.push(`const ${importName}=undefined\n`)
  }
  return codeFragment.join('\n')
}
