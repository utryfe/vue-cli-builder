const lodash = require('lodash')

module.exports = ({ config, bundles, bundle, importName = 'moduleStores' }) => {
  //
  const { BUILD_MODULE_STORE_NAME } = config
  const importModules = {}
  let modules = bundles[bundle || BUILD_MODULE_STORE_NAME]
  if (!Array.isArray(modules)) {
    modules = []
  }
  //
  modules.forEach((module) => {
    const { name, bundle } = module
    const identifierName = lodash.camelCase(name).replace(/\W/g, '')
    const imports = importModules[identifierName] || []
    importModules[identifierName] = imports
    imports.push({ name, bundle })
  })
  //
  const importBundles = []
  const importStores = []
  //
  Object.keys(importModules).forEach((moduleName) => {
    importModules[moduleName].forEach((module, index) => {
      const { name, bundle } = module
      const identifier = `Bundle${lodash.capitalize(moduleName)}${index || ''}`
      const storeIdentifier = `store${identifier}`
      //
      importBundles.push(`import ${storeIdentifier} from '${bundle}'`)
      //
      importStores.push(`  { module: '${name}', store: ${storeIdentifier} }`)
    })
  })
  //
  return importBundles
    .concat(
      `const ${importName} = [${
        importStores.length ? `\n${importStores.join(',\n')}\n` : ''
      }]`
    )
    .join('\n')
}
