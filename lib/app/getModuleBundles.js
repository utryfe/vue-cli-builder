const fs = require('fs')
const cloneDeep = require('lodash/cloneDeep')

const {
  getFileBaseName,
  existsSync,
  joinPath,
  resolvePath,
  isDirectory,
} = require('../utils/file')

const { transverseTree, toKebabString } = require('../utils/common')

const {
  logIgnoredBundles,
  logNestedRouteNonRouterView,
  logInvalidNestedRouting,
  logNonAppIndex,
} = require('./logger')

const getStoreParser = require('./getStoreParser')
const getRouteParser = require('./getRouteParser')

const {
  formatPath,
  getRelativePath,
  sortModuleProps,
  sortRouteChildren,
  defaultPathFormatSetup,
} = getRouteParser

function setModuleNormalProps(module, nestedRoutes, context) {
  const { pathname, children } = module
  const nestedReg = /^\[.*?]$/
  const isRoot = pathname === context
  if (children) {
    module.nestedSetup = nestedRoutes
    module.autoNested = nestedRoutes === 'auto'
    module.manualNested = !isRoot ? nestedReg.test(getFileBaseName(pathname)) : false
    if (nestedRoutes === 'none') {
      module.nested = false
    } else if (!isRoot) {
      module.nested = module.autoNested || module.manualNested
    } else {
      module.nested = module.autoNested
    }
    module.ignoredChildren = []
  }
  module.relativePath = !isRoot
    ? formatPath(getRelativePath(context, pathname), defaultPathFormatSetup).replace(
        /(^|\/)(\/|$)/g,
        '$1unknown$2'
      )
    : '/'
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

function checkNestedRouterView(route) {
  const { components, component, nested } = route
  if (!nested) {
    return
  }
  if (!components && !component) {
    logInvalidNestedRouting(route)
  }
}

function checkNamedRouterView(route) {
  const { components, component, children, nested, root, layout } = route
  if (!root && (!nested || (!components && !component))) {
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
      /<!--.*?(?=-->)-->|<router-view\b([^>]*)>|<RouterView\b([^>]*)>/g,
      ($0, $1, $2) => {
        if ($1 !== undefined || $2 !== undefined) {
          const matcher = /\bname\s*=\s*(?:(['"])(.*?)\1|([^'"\b/>]*))/.exec($1 || $2)
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
    logNestedRouteNonRouterView(route, name, routes)
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
    const { root, nested } = route
    if (root) {
      if (nested) {
        route.root = false
        checkNestedRouterView(route)
        checkNamedRouterView(route)
      }
      route.root = true
      const layout = resolvePath(build_root_app_path)
      if (existsSync(layout) && !isDirectory(layout)) {
        route.layout = layout
      }
    }
    checkNestedRouterView(route)
    checkNamedRouterView(route)
    checkAppIndex(route, build_route_extensions)
    sortRouteChildren(route)
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

        if (build_kebab_case_path) {
          const { path } = module
          if (path && !path.startsWith(':')) {
            module.path = toKebabString(path)
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
