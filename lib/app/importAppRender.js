const { getAbsPath, existsSync, ensurePathQuote } = require('../utils/file')

module.exports = ({ config, importName = 'appRender' }) => {
  const { build_root_app_path, build_app_use_router } = config
  const codeFragment = ['// app layout\n']

  const globalAppFile = getAbsPath(build_root_app_path)

  if (existsSync(globalAppFile)) {
    codeFragment.push(`import App from '${ensurePathQuote(globalAppFile)}'\n`)
  } else if (build_app_use_router) {
    codeFragment.push(`const App={name:'App',render:(h)=>h('router-view')}\n`)
  }

  if (codeFragment.length) {
    codeFragment.push(`const ${importName}=(h)=>h(App)\n`)
  } else {
    codeFragment.push(`const ${importName}=undefined\n`)
  }

  return codeFragment.join('\n')
}
