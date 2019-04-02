const { getAbsPath, existsSync, ensurePathQuote } = require('../utils/file')

module.exports = ({ config, importName = 'appRender' }) => {
  const { BUILD_ROOT_APP_PATH, BUILD_APP_USE_ROUTER } = config
  const codeFragment = []

  const globalAppFile = getAbsPath(BUILD_ROOT_APP_PATH)

  if (existsSync(globalAppFile)) {
    codeFragment.push(`import App from '${ensurePathQuote(globalAppFile)}'\n`)
  } else if (BUILD_APP_USE_ROUTER) {
    codeFragment.push(`const App = {name:'App',render:(h)=>h('router-view')}\n`)
  }

  if (codeFragment.length) {
    codeFragment.push(`const ${importName} = (h)=>h(App)\n`)
  } else {
    codeFragment.push(`const ${importName} = undefined\n`)
  }

  return codeFragment.join('\n')
}
