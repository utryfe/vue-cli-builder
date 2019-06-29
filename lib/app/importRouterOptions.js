const endOfLine = require('os').EOL
const { ensurePathQuote } = require('../utils/file')

const {
  getIdentifierMaker,
  randomSequence,
  transverseTree,
  escapeRegExp,
} = require('../utils/common')

const { sortRouteChildren, checkRootRoutes } = require('./getModuleBundles')

function getMapRouteParamsToPropsUtil(type) {
  if (type === 'none' || type === 'params') {
    return {}
  }

  const name = `mapRouteParamsToProps`
  const code =
    type === 'query'
      ? `const ${name}=({query})=>({...query})${endOfLine}`
      : `const ${name}=({params,query})=>({...params,...query})${endOfLine}`

  return { name, code }
}

function getToArrayUtil() {
  const name = 'toArray'
  const code = `const ${name}=(arr)=>Array.isArray(arr)?arr:[]${endOfLine}`
  return { name, code }
}

function getBundleImporter(
  importBundles,
  importNamesCount,
  tag,
  async,
  asyncExclude,
  type = 'router'
) {
  const identifierMap = {}
  const makeIdentifier = getIdentifierMaker(type, importNamesCount)
  return (module) => {
    const { bundle, namespace } = Object.assign({}, module)
    if (!bundle) {
      return ''
    }
    const bundlePath = ensurePathQuote(bundle)
    const declared = identifierMap[bundlePath]
    const identifier = declared || makeIdentifier(namespace)
    identifierMap[bundlePath] = identifier
    if (!declared) {
      importBundles.push(
        async && (!asyncExclude || !~bundlePath.replace(/\\/g, '/').search(asyncExclude))
          ? `const ${identifier}=()=>import('${bundlePath}')${endOfLine}`
          : `import ${identifier} from '${bundlePath}'${endOfLine}`
      )
    }
    return `${tag}${identifier}${tag}`
  }
}

function escapeObjectString(str, tagObject, tagValue) {
  return `${tagObject}${str
    .replace(new RegExp(`(['"])(${tagValue}.*?${tagValue})\\1`, 'g'), '`$2`')
    .replace(/(['"])(.*?)\1/g, `'$2'`)}${tagObject}`
}

function flattenDeep(routes, rootNestedRoutes, nestedType) {
  const list = []

  transverseTree(routes, (child) => {
    const { components, component, children, bundle, nested, rootNested, parent } = child
    const hasComponent = !!(components || component || bundle)

    if (!hasComponent && !(children && children.length)) {
      return 'exit'
    }

    if (hasComponent && !rootNested) {
      list.push(child)
    }

    if (bundle) {
      return
    }

    if (!parent || !parent.nested || rootNested) {
      child.path = child.absRoutePath
    }

    if (!nested && !rootNested) {
      return 'flat'
    }

    if (nested) {
      child.children = flattenDeep(children, rootNestedRoutes, nestedType)
      sortRouteChildren(child)
    }

    if (rootNested) {
      rootNestedRoutes.push(child)

      const siblings = parent ? parent.children : null
      if (siblings) {
        parent.children = siblings.filter((item) => item !== child)
      }

      if (!nested) {
        delete child.children
        const rootRoutes = []
        const flatChildren = flattenDeep(children, rootRoutes, nestedType)
        const flatRoutes = [...rootRoutes, ...flatChildren]
        for (const route of flatRoutes) {
          if (!route.nested) {
            delete route.children
          }
        }
        rootNestedRoutes.push(...flatRoutes)
      }
    }

    return 'exit'
  })

  return list
}

// 分离根路由和嵌套路由
function toFlatRoutes(root, flatRoutesPropName, nestedType) {
  const { children, absRoutePath } = root
  root.children = []

  let routes
  if (children) {
    const rootNestedRoutes = []
    const subRoutes = flattenDeep(children, rootNestedRoutes, nestedType)

    if (nestedType === 'none') {
      routes = [root, ...subRoutes]
    } else {
      const rootRoutes = []

      root.children = subRoutes.filter((route) => {
        const { declareNested } = route
        if (!declareNested) {
          rootRoutes.push(route)
        }
        return declareNested
      })
      routes = [root, ...rootNestedRoutes, ...rootRoutes]
    }
  } else {
    routes = [root]
  }

  for (const route of routes) {
    const { bundle, namespace } = route
    if (bundle) {
      route[flatRoutesPropName] = [{ bundle, namespace }]
    }
  }

  root = { children: routes, absRoutePath }
  sortRouteChildren(root)

  return root.children
}

function getReplacer(setup) {
  const {
    importRoutes,
    importComponent,
    tagObject,
    tagComponent,
    mapProps,
    mapPropsUtil,
    toArrayUtil,
    flatRoutesPropName,
    routeProps,
  } = setup

  return (key, value) => {
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
      const code = `${tagComponent}${mapPropsUtil.name || true}${tagComponent}`
      if (value === true) {
        return code
      }
      return escapeObjectString(
        JSON.stringify(value, (k, v) => (k ? code : v)),
        tagObject,
        tagComponent
      )
    } else if (key === 'children' || key === flatRoutesPropName) {
      if (!value.length) {
        return
      }
      for (const [index, child] of Object.entries(value)) {
        const marked = importRoutes(child)
        if (marked) {
          value[index] = marked
          if (!toArrayUtil.name) {
            Object.assign(toArrayUtil, getToArrayUtil())
          }
        }
      }
    }
    //
    if (/^(?:\d+|)$/.test(key) || routeProps.includes(key)) {
      return value
    }
  }
}

// 生成路由配置代码
module.exports = ({ bundles, config, publicPath, importName = 'routerOptions' }) => {
  const {
    build_app_use_router,
    build_app_nested_routes: nestedType,
    build_app_router_mode: routerMode,
    build_code_splitting: async,
    build_code_splitting_exclude: asyncExclude,
    build_kebab_case_path: kebabCasePath,
    build_router_map_props: mapProps,
  } = config

  if (!bundles || !build_app_use_router) {
    return `const ${importName}=undefined${endOfLine}`
  }

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

  const routerImports = [`// router${endOfLine}`]
  const componentImports = [`// component${endOfLine}`]
  const utilityImports = []
  const importNamesCount = {
    [importName]: 1,
  }

  if (process.env.NODE_ENV !== 'production') {
    routeProps.push('filePath')
  }

  const tagRoutes = `<${randomSequence(10e8)}>`
  const tagComponent = `<${randomSequence(10e9)}>`
  const tagObject = `<${randomSequence(10e10)}>`
  const tagFlatRoutes = `<${randomSequence(10e11)}>`
  const flatRoutesPropName = `${tagFlatRoutes}[Routes]${tagFlatRoutes}`

  routeProps.push(flatRoutesPropName)

  const importRoutes = getBundleImporter(routerImports, importNamesCount, tagRoutes)

  const importComponent = getBundleImporter(
    componentImports,
    importNamesCount,
    tagComponent,
    async,
    asyncExclude,
    'comp'
  )

  const toArrayUtil = { name: '', code: '' }
  const mapPropsUtil = getMapRouteParamsToPropsUtil(mapProps)

  const flatRoutes = toFlatRoutes(bundles, flatRoutesPropName, nestedType)
  checkRootRoutes(bundles, config)

  let rootRoute = JSON.stringify(
    flatRoutes,
    getReplacer({
      importRoutes,
      importComponent,
      tagObject,
      tagComponent,
      mapProps,
      mapPropsUtil,
      toArrayUtil,
      flatRoutesPropName,
      routeProps,
    })
  )

  if (toArrayUtil.name) {
    rootRoute = rootRoute.replace(
      new RegExp(`(['"])${tagRoutes}(.*?)${tagRoutes}\\1`, 'g'),
      `...${toArrayUtil.name}($2)`
    )
  }

  rootRoute = rootRoute
    .replace(new RegExp(`(['"\`])${tagComponent}(.*?)${tagComponent}\\1`, 'g'), '$2')
    .replace(new RegExp(`(['"])${tagObject}(.*?)${tagObject}\\1`, 'g'), '$2')

  const routes = rootRoute.replace(
    new RegExp(
      `{\\s*(['"])${escapeRegExp(flatRoutesPropName)}\\1\\s*:\\s*\\[(.*?)]\\s*}`,
      'g'
    ),
    '$2'
  )

  if (mapPropsUtil.code) {
    utilityImports.push(mapPropsUtil.code)
  }
  if (toArrayUtil.code) {
    utilityImports.push(toArrayUtil.code)
  }

  const routerOptions = `{mode:${JSON.stringify(routerMode)},base:${JSON.stringify(
    publicPath
  )},kebabCasePath:${JSON.stringify(!!kebabCasePath)},routes:${routes}}`

  return utilityImports
    .concat(routerImports)
    .concat(componentImports)
    .concat(`// router options${endOfLine}`)
    .concat(`const ${importName}=${routerOptions}${endOfLine}`)
    .join(endOfLine)
}
