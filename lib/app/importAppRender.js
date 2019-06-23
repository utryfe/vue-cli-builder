const endOfLine = require('os').EOL
const { getAbsPath, existsSync, ensurePathQuote } = require('../utils/file')

module.exports = ({ config, importName = 'appRender' }) => {
  const { build_root_app_path, build_app_use_router } = config
  const codeFragment = [`// app root${endOfLine}`]

  const globalAppFile = getAbsPath(build_root_app_path)

  if (existsSync(globalAppFile)) {
    codeFragment.push(`import App from '${ensurePathQuote(globalAppFile)}'${endOfLine}`)
  } else if (build_app_use_router) {
    codeFragment.push(
      `const App={name:'App',functional:true,render:(h)=>h('router-view')}${endOfLine}`
    )
  }

  if (codeFragment.length) {
    codeFragment.push(`const ${importName}=(h)=>h(App)${endOfLine}`)
  } else {
    codeFragment.push(`const ${importName}=undefined${endOfLine}`)
  }

  return codeFragment.join(endOfLine)
}
