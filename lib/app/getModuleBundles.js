const fs = require('fs')
const cloneDeep = require('lodash/cloneDeep')

const {
  getFileBaseName,
  existsSync,
  joinPath,
  resolvePath,
  isDirectory,
} = require('../utils/file')

const { transverseTree, toKebabString, escapeRegExp } = require('../utils/common')

const {
  logIgnoredBundles,
  logNestedRouteNonRouterView,
  logInvalidNestedRouting,
  logNonAppIndex,
  logIgnoredDynamicRoutes,
  logDuplicateDefinition,
} = require('./logger')

const getStoreParser = require('./getStoreParser')
const getRouteParser = require('./getRouteParser')

const {
  formatPath,
  getRelativePath,
  sortModuleProps,
  defaultPathFormatSetup,
} = getRouteParser

function setModuleNormalProps(module, nestedType, context) {
  const { pathname, children } = module
  const isRoot = pathname === context
  module.relativePath = !isRoot
    ? formatPath(getRelativePath(context, pathname), defaultPathFormatSetup).replace(
        /(^|\/)(\/|$)/g,
        '$1unknown$2'
      )
    : '/'

  if (children) {
    module.nestedSetup = nestedType
    module.ignoredChildren = []
  }

  if (!isRoot && nestedType !== 'none') {
    const nestedReg = /^~?\[.*?]$/
    const rootNestedReg = /^~.+/
    const baseName = getFileBaseName(pathname)
    module.autoNested = children ? nestedType === 'auto' : false
    module.manualNested = children ? nestedReg.test(baseName) : false
    module.declareNested = children ? module.autoNested || module.manualNested : false
    module.rootNested = rootNestedReg.test(baseName)
  } else {
    module.autoNested = false
    module.manualNested = false
    module.declareNested = false
    module.rootNested = false
  }
}

function collectIgnoredBundles(module, ignoredBundles, routerName, storeName) {
  if (!module.ignoredChildren) {
    return
  }
  for (const { children, pathname } of module.ignoredChildren) {
    if (!children) {
      continue
    }
    let bundle
    if (routerName && existsSync((bundle = joinPath(pathname, routerName)))) {
      ignoredBundles.push(bundle)
    }
    if (storeName && existsSync((bundle = joinPath(pathname, storeName)))) {
      ignoredBundles.push(bundle)
    }
  }
}

function checkNestedRouterView(route, routeExt) {
  const { components, component, nested } = route
  if (!nested) {
    return
  }
  if (!components && !component) {
    logInvalidNestedRouting(route, routeExt)
  }
}

function checkNamedRouterView(route, appPath) {
  const { components, component, children, nested, root, layout } = route
  if (
    !root &&
    (!nested ||
      !children ||
      !(components || component) ||
      !children.filter((child) => !child.rootNested).length)
  ) {
    return
  }

  let namedViews
  if (root) {
    namedViews = { default: { bundle: layout } }
  } else {
    namedViews = component ? { default: component } : components
  }
  const declaredRouterViews = new Set()

  for (const { bundle } of Object.values(namedViews)) {
    let content
    try {
      content = bundle ? fs.readFileSync(bundle, { encoding: 'utf8' }) : ''
    } catch (e) {
      content = ''
    }
    if (root && !layout) {
      content = '<template><router-view></template>'
    }

    let [, template] = /<template[^>]*>([\s\S]*)<\/template>/.exec(content) || []
    if (!template || !(template = template.trim())) {
      continue
    }

    template.replace(
      /<!--.*?(?=-->)-->|<router-view\b([^>]*)>|<RouterView\b([^>]*)>|<ice-router-tabs\b([^>]*)>|<IceRouterTabs\b([^>]*)>/g,
      ($0, $1, $2, $3, $4) => {
        if (
          $1 !== undefined ||
          $2 !== undefined ||
          $3 !== undefined ||
          $4 !== undefined
        ) {
          const matcher = /\bname\s*=\s*(?:(['"])(.*?)\1|([^'"\b/>]*))/.exec(
            $1 || $2 || $3 || $4
          )
          declaredRouterViews.add(matcher ? matcher[2] || matcher[3] : '')
        }
      }
    )
  }

  const routerViews = Array.from(declaredRouterViews)
  const namedRoutes = children.concat(root ? route : []).reduce((set, child) => {
    const { components, component } = child
    if (components || component) {
      for (const [name, { bundle }] of Object.entries(
        components || { default: component }
      )) {
        set.push({ name, bundle })
      }
    }
    return set
  }, [])

  const invalidRoutes = {}
  for (const subRoute of namedRoutes) {
    const { name } = subRoute
    if (!routerViews.some((view) => view === name || (!view && name === 'default'))) {
      const components = (invalidRoutes[name] = invalidRoutes[name] || [])
      components.push(subRoute)
    }
  }

  for (const [name, routes] of Object.entries(invalidRoutes)) {
    logNestedRouteNonRouterView(route, name, routes, appPath)
  }
}

function checkDuplicateDefinition(route) {
  const { parent, absRoutePath } = route
  if (!parent) {
    return
  }
  const { children } = parent
  for (const child of children) {
    if (child !== route && child.absRoutePath === absRoutePath) {
      logDuplicateDefinition(route, child)
      break
    }
  }
}

function checkAppIndex(route, routeExt) {
  const { root, unknown, components, component } = route
  if (!root || unknown) {
    return
  }
  if (!components && !component) {
    logNonAppIndex(route, routeExt)
  }
}

function getModuleChecker(config) {
  const { build_root_app_path, build_route_extensions } = config
  return (route) => {
    const { root } = route
    if (root) {
      return
    }
    checkNestedRouterView(route, build_route_extensions)
    checkNamedRouterView(route, build_root_app_path)
    checkDuplicateDefinition(route)
  }
}

function checkRootRoutes(rootRoute, config) {
  const { build_root_app_path, build_route_extensions } = config
  const { children } = rootRoute

  if (children && children.length) {
    rootRoute.nested = true
    rootRoute.root = false
    checkNamedRouterView(rootRoute, build_root_app_path)
  }

  rootRoute.root = true
  const layout = resolvePath(build_root_app_path)
  if (existsSync(layout) && !isDirectory(layout)) {
    rootRoute.layout = layout
  }

  checkNestedRouterView(rootRoute, build_route_extensions)
  checkNamedRouterView(rootRoute, build_root_app_path)
  checkAppIndex(rootRoute, build_route_extensions)
}

function sortRouteChildren(route, unknown) {
  const { children } = route
  if (children && children.length) {
    const dynamicRoutes = []
    const exactRoutes = []
    const bundleRoutes = []
    const unknownRoutes = []
    const paramsReg = /(^|\/):([^/]+?)(?=\/|$)/
    for (const child of children) {
      const { path, bundle } = child
      if (path && path !== '*') {
        if (paramsReg.test(path)) {
          dynamicRoutes.push(child)
        } else {
          exactRoutes.push(child)
        }
      } else if (bundle) {
        bundleRoutes.push(child)
      } else {
        unknownRoutes.unshift(child)
      }
    }
    route.children = bundleRoutes
      .concat(exactRoutes)
      .concat(dynamicRoutes)
      .concat(unknownRoutes)
    //
    logIgnoredDynamicRoutes(route, unknown === true ? unknownRoutes : dynamicRoutes)
  }
}

/**
 * 模块解析器
 * @type {exports}
 */
module.exports = exports = ({ modules, context, config }) => {
  if (!modules) {
    return null
  }

  const bundles = cloneDeep(modules)

  const {
    build_module_router_name,
    build_module_store_name,
    build_app_nested_routes,
    build_kebab_case_path,
    build_app_use_router,
    build_app_use_vuex,
  } = config

  const routeParser = build_app_use_router
    ? getRouteParser(build_module_router_name, context)
    : null
  const storeParser = build_app_use_vuex
    ? getStoreParser(build_module_store_name, context)
    : null

  if (routeParser || storeParser) {
    const moduleChecker = getModuleChecker(config)
    const ignoredBundles = []

    transverseTree(bundles, (module, parent) => {
      const { pathname } = module
      if (!pathname) {
        return
      }

      setModuleNormalProps(module, build_app_nested_routes, context)

      if (routeParser) {
        routeParser(module, parent)

        const { declareNested, children, path, absRoutePath } = module
        module.nested = !!(declareNested && children && children.length)

        if (build_kebab_case_path) {
          if (path && !path.startsWith(':')) {
            module.path = toKebabString(path)
            module.absRoutePath = absRoutePath.replace(
              new RegExp(`${escapeRegExp(path)}$`),
              module.path
            )
          }
        }
      }

      if (storeParser) {
        storeParser(module, parent, bundles)
      }

      collectIgnoredBundles(
        module,
        ignoredBundles,
        routeParser ? build_module_router_name : '',
        storeParser ? build_module_store_name : ''
      )

      if (routeParser) {
        return moduleChecker
      }

      //
    })

    logIgnoredBundles(ignoredBundles)
  }

  return bundles
}

exports.formatPath = formatPath
exports.sortModuleProps = sortModuleProps
exports.sortRouteChildren = sortRouteChildren
exports.checkRootRoutes = checkRootRoutes
