const lodash = require('lodash')

module.exports = ({ config, bundles, bundle, importName = 'moduleRoutes' }) => {
  //
  const { BUILD_MODULE_ROUTER_NAME, BUILD_CODE_SPLITTING } = config
  const importModules = {}
  const modules = bundles[bundle || BUILD_MODULE_ROUTER_NAME]
  //
  modules.forEach((module) => {
    const { name, component, bundle } = module
    const identifierName = lodash.camelCase(name).replace(/\W/g, '')
    const imports = importModules[identifierName] || []
    importModules[identifierName] = imports
    imports.push({ name, bundle, component })
  })
  //
  const importBundles = []
  const importComponents = []
  const importRoutes = []
  //
  Object.keys(importModules).forEach((moduleName) => {
    importModules[moduleName].forEach((module, index) => {
      const { name, bundle, component } = module
      const identifier = `Bundle${lodash.capitalize(moduleName)}${index || ''}`
      const routerIdentifier = `router${identifier}`
      const componentIdentifier = `routerComponent${identifier}`
      let componentLoader = ''
      //
      if (bundle) {
        importBundles.push(`import ${routerIdentifier} from '${bundle}'`)
      } else {
        importBundles.push(`const ${routerIdentifier} = []`)
      }
      if (!BUILD_CODE_SPLITTING) {
        // 不使用懒加载
        importComponents.push(`import ${componentIdentifier} from '${component}'`)
        componentLoader = componentIdentifier
      } else {
        // 使用懒加载
        componentLoader = `() => import('${component}')`
      }
      //
      importRoutes.push(
        `  { module: '${name}', routes: ${routerIdentifier}, component: ${componentLoader} }`
      )
    })
  })
  //
  return importBundles
    .concat(importComponents)
    .concat(
      `const ${importName} = [${
        importRoutes.length ? `\n${importRoutes.join(',\n')}\n` : ''
      }]`
    )
    .join('\n')
}
