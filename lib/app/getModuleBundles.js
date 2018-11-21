const fs = require('fs')
const fileUtil = require('../utils/file')

function ensureQuote(str) {
  return str.replace(/([\\'])/g, '\\$1')
}

module.exports = ({ bundles, modules, config }) => {
  //
  const { BUILD_MODULE_ROUTER_NAME, BUILD_MODULE_STORE_NAME } = config
  const importModules = {}
  if (!Array.isArray(bundles)) {
    bundles = [BUILD_MODULE_ROUTER_NAME, BUILD_MODULE_STORE_NAME]
  }
  if (!Array.isArray(modules)) {
    modules = []
  }
  //
  modules.forEach((module) => {
    const moduleFile = fileUtil.isAbsolute(module)
      ? module
      : fileUtil.resolvePath(module)
    //
    if (fs.existsSync(moduleFile)) {
      //
      const dirName = fileUtil.getDirName(moduleFile)
      const originalModuleName = fileUtil.getFileBaseName(dirName, true)
      //
      bundles.forEach((bundle) => {
        const file = fileUtil.joinPath(dirName, bundle)
        const importBundles = importModules[bundle] || []
        importModules[bundle] = importBundles
        //
        if (fs.existsSync(file)) {
          importBundles.push({
            name: ensureQuote(originalModuleName),
            component: ensureQuote(moduleFile),
            bundle: ensureQuote(file),
          })
        } else if (bundle === BUILD_MODULE_ROUTER_NAME) {
          importBundles.push({
            name: ensureQuote(originalModuleName),
            component: ensureQuote(moduleFile),
          })
        }
      })
    }
  })

  //
  return importModules
}
