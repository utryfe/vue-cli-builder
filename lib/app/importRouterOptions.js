const { ensurePathQuote } = require('../utils/file')
const { getIdentifierMaker, randomSequence } = require('../utils/common')

function escapeObjectString(str, tagObject, tagValue) {
  return `${tagObject}${str
    .replace(new RegExp(`(['"])(${tagValue}.*?${tagValue})\\1`, 'g'), '`$2`')
    .replace(/(['"])(.*?)\1/g, `'$2'`)}${tagObject}`
}

function getMapRouterParamsToPropsUtil(type) {
  if (type === 'none' || type === 'params') {
    return {}
  }
  const util = `mapRouterParamsToProps`
  const code =
    type === 'query'
      ? `const ${util} = ({query})=>({...query})\n`
      : `const ${util} = ({params,query})=>({...params,...query})\n`
  return {
    util,
    code,
  }
}

function getBundleImporter(importBundles, importNamesCount, tag, async, type = 'router') {
  const makeIdentifier = getIdentifierMaker(type, importNamesCount)
  return (module) => {
    const { bundle, namespace } = Object.assign({}, module)
    if (!bundle) {
      return null
    }
    const identifier = makeIdentifier(namespace)
    const bundlePath = ensurePathQuote(bundle)
    importBundles.push(
      async
        ? `const ${identifier} = ()=>import('${bundlePath}')\n`
        : `import ${identifier} from '${bundlePath}'\n`
    )
    return `${tag}${identifier}${tag}`
  }
}

module.exports = ({ bundles, config, importName = 'routerOptions' }) => {
  const {
    BUILD_APP_USE_ROUTER,
    BUILD_APP_ROUTER_MODE: routerMode,
    BUILD_CODE_SPLITTING: async,
    BUILD_ROUTER_MAP_PROPS: mapProps,
  } = config

  if (!bundles || !BUILD_APP_USE_ROUTER) {
    return `const ${importName} = undefined\n`
  }

  const routerImports = ['// router\n']
  const componentImports = ['// component\n']
  const routeProps = [
    'path',
    'name',
    'component',
    'components',
    'children',
    'props',
    'redirect',
    'alias',
  ]

  const tagRoutes = `<${randomSequence(10e8)}>`
  const tagComponent = `<${randomSequence(10e9)}>`
  const tagObject = `<${randomSequence(10e10)}>`
  const importNamesCount = {
    [importName]: 1,
  }

  const importUtility = []
  const importRoutes = getBundleImporter(routerImports, importNamesCount, tagRoutes)
  const importComponent = getBundleImporter(
    componentImports,
    importNamesCount,
    tagComponent,
    async,
    'comp'
  )

  const { util: mapPropsUtil, code: mapPropsCode } = getMapRouterParamsToPropsUtil(
    mapProps
  )
  if (mapPropsCode) {
    importUtility.push(mapPropsCode)
  }

  const rootRoute = JSON.stringify(bundles, (key, value) => {
    if (key === 'components') {
      return escapeObjectString(
        JSON.stringify(value, (k, v) => (k ? importComponent(v) : v)),
        tagObject,
        tagComponent
      )
    } else if (key === 'component') {
      return importComponent(value)
    } else if (key === 'props') {
      if (mapProps === 'none') {
        return
      }
      const code = `${tagComponent}${mapPropsUtil || true}${tagComponent}`
      if (value === true) {
        return code
      }
      return escapeObjectString(
        JSON.stringify(value, (k, v) => (k ? code : v)),
        tagObject,
        tagComponent
      )
    } else if (key === 'children') {
      if (!value.length) {
        return
      }
      for (const [index, child] of Object.entries(value)) {
        const symbol = importRoutes(child)
        if (symbol) {
          value[index] = symbol
        }
      }
    }

    //
    if (/^(?:\d+|)$/.test(key) || routeProps.includes(key)) {
      return value
    }
  })
    .replace(
      new RegExp(`(['"])${tagRoutes}(.*?)${tagRoutes}\\1`, 'g'),
      '...(Array.isArray($2)?$2:[])'
    )
    .replace(new RegExp(`(['"\`])${tagComponent}(.*?)${tagComponent}\\1`, 'g'), '$2')
    .replace(new RegExp(`(['"])${tagObject}(.*?)${tagObject}\\1`, 'g'), '$2')

  const routerOptions = `{mode:${JSON.stringify(routerMode)},routes:[${rootRoute}]}`

  return importUtility
    .concat(routerImports)
    .concat(componentImports)
    .concat(`const ${importName} = ${routerOptions}\n`)
    .join('\n')
}
