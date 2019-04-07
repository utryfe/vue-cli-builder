const { ensurePathQuote } = require('../utils/file')
const { getIdentifierMaker, randomSequence, transverseTree } = require('../utils/common')

function escapeObjectString(str, tagObject, tagValue) {
  return `${tagObject}${str
    .replace(new RegExp(`(['"])(${tagValue}.*?${tagValue})\\1`, 'g'), '`$2`')
    .replace(/(['"])(.*?)\1/g, `'$2'`)}${tagObject}`
}

function getMapRouteParamsToPropsUtil(type) {
  if (type === 'none' || type === 'params') {
    return {}
  }
  const util = `mapRouteParamsToProps`
  const code =
    type === 'query'
      ? `const ${util}=({query})=>({...query})\n`
      : `const ${util}=({params,query})=>({...params,...query})\n`
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
      return ''
    }
    const identifier = makeIdentifier(namespace)
    const bundlePath = ensurePathQuote(bundle)
    importBundles.push(
      async
        ? `const ${identifier}=()=>import('${bundlePath}')\n`
        : `import ${identifier} from '${bundlePath}'\n`
    )
    return `${tag}${identifier}${tag}`
  }
}

function flattenDeep(routes) {
  const list = []
  transverseTree(routes, 'children', (child) => {
    const { path, bundle } = child
    if (bundle) {
      list.push(child)
      return
    }

    child.nestedPath = path
    const paths = [path]
    let parent
    let cur = child
    while ((parent = cur.parent)) {
      const { nestedPath } = parent
      paths.unshift(nestedPath === '/' ? '' : nestedPath)
      cur = parent
    }

    child.path = paths.join('/')
    list.push(child)
    return 'flat'
  })

  return list
}

module.exports = ({ bundles, config, importName = 'routerOptions' }) => {
  const {
    build_app_use_router,
    build_app_nested_routes: nestedRoutes,
    build_app_router_mode: routerMode,
    build_code_splitting: async,
    build_router_map_props: mapProps,
  } = config

  if (!bundles || !build_app_use_router) {
    return `const ${importName}=undefined\n`
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

  if (process.env.NODE_ENV !== 'production') {
    routeProps.push('filePath')
  }

  const tagRoutes = `<${randomSequence(10e8)}>`
  const tagComponent = `<${randomSequence(10e9)}>`
  const tagObject = `<${randomSequence(10e10)}>`
  const importNamesCount = {
    [importName]: 1,
  }

  const utilityImports = []

  const importRoutes = getBundleImporter(routerImports, importNamesCount, tagRoutes)

  const importComponent = getBundleImporter(
    componentImports,
    importNamesCount,
    tagComponent,
    async,
    'comp'
  )

  const { util: mapPropsUtil, code: mapPropsCode } = getMapRouteParamsToPropsUtil(
    mapProps
  )
  if (mapPropsCode) {
    utilityImports.push(mapPropsCode)
  }

  let toArrayUtil = ''

  if (!nestedRoutes) {
    // 使用非嵌套的路由
    const { children } = bundles
    if (children) {
      delete bundles.children
      bundles = [bundles].concat(flattenDeep(children))
    } else {
      bundles = [bundles]
    }

    bundles = bundles.filter((route) => {
      const { components, component, bundle, namespace } = route
      if (bundle) {
        route.children = [{ bundle, namespace }]
      }
      return !!(components || component || bundle)
    })
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
          if (!toArrayUtil) {
            toArrayUtil = `toArray`
            utilityImports.push(`const ${toArrayUtil}=(arr)=>Array.isArray(arr)?arr:[]\n`)
          }
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
      `...${toArrayUtil}($2)`
    )
    .replace(new RegExp(`(['"\`])${tagComponent}(.*?)${tagComponent}\\1`, 'g'), '$2')
    .replace(new RegExp(`(['"])${tagObject}(.*?)${tagObject}\\1`, 'g'), '$2')

  const routes = nestedRoutes
    ? `[${rootRoute}]`
    : rootRoute.replace(/{\s*(['"])children\1\s*:\s*\[(.*?)]\s*}/g, '$2')

  const routerOptions = `{mode:${JSON.stringify(routerMode)},routes:${routes}}`

  return utilityImports
    .concat(routerImports)
    .concat(componentImports)
    .concat(`const ${importName}=${routerOptions}\n`)
    .join('\n')
}
