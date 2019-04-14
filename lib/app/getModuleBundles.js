const lodash = require('lodash')

const { getFileBaseName, existsSync, joinPath } = require('../utils/file')

const { transverseTree, toKebabString } = require('../utils/common')

const { logIgnoredBundles } = require('./logger')
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
  const symbolReg = /^\[.*?]$/
  const isRoot = pathname === context
  if (children) {
    module.autoNested = !isRoot ? nestedRoutes === 'auto' : false
    module.symbolNested = !isRoot ? symbolReg.test(getFileBaseName(pathname)) : false
    module.nested = !isRoot ? module.autoNested || module.symbolNested : false
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

/**
 * 模块解析器
 * @type {exports}
 */
module.exports = exports = ({ modules, context, config }) => {
  if (!modules) {
    return null
  }

  const bundles = lodash.cloneDeep(modules)

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
        return sortRouteChildren
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
