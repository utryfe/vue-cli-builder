const lodash = require('lodash')
const chalk = require('chalk')

const { getFileBaseName, relativePath, existsSync, joinPath } = require('../utils/file')

const { escapeRegExp, toUnKebabString } = require('../utils/common')

const {
  logIgnoredDynamicRoutes,
  logIgnoredIndexRoute,
  logIgnoredUnknownRoute,
  logIgnoredUnknownRoutes,
  logIgnoredNamedViewRoutes,
  logInvalidEmbeddedRoute,
  logInvalidNestedRoutes,
  getRelativePathUnderCwd,
} = require('./logger')

const defaultPathFormatSetup = {
  leading: '',
  training: '',
}

function formatPath(path, setup) {
  const { leading = ':', training = '?', camelCase = true } = Object.assign({}, setup)
  const {
    ut_build_router_params_symbol: paramsSymbol = '_',
    ut_build_router_view_symbol: viewSymbol = '@',
  } = process.env

  // /(^|\/)\[([^/]+?)](?=\/|$)/g
  const symbolNestedReg = /(^|\/)\[([^/]+?)](?=\/|$)/g

  // /(?:\/?@[^/]+|\.[^/]*)$/g
  const symbolViewReg = new RegExp(
    `(?:\\/?${escapeRegExp(viewSymbol)}[^/]+|\\.[^/]*)$`,
    'g'
  )

  // /(^|\/)(?:(_[^\/]*)|([^\/]+?_))(?=\/|$)/g
  const symbolParamsReg = new RegExp(
    `(^|\\/)(?:(${escapeRegExp(paramsSymbol)}[^\\/]*)|([^\\/]+?${escapeRegExp(
      paramsSymbol
    )}))(?=\\/|$)`,
    'g'
  )

  // /^(_)?(.*?)(_)?$/
  const paramsReg = new RegExp(
    `^(${escapeRegExp(paramsSymbol)})?(.*?)(${escapeRegExp(paramsSymbol)})?$`
  )

  return path
    .replace(symbolNestedReg, '$1$2')
    .replace(symbolViewReg, '')
    .replace(symbolParamsReg, ($0, $1, $2, $3) => {
      return `${$1}${($2 || $3).replace(paramsReg, ($0, $1, $2, $3) => {
        return `${$1 && $2 ? leading : ''}${camelCase ? lodash.camelCase($2) : $2}${
          $3 ? training : ''
        }`
      })}`
    })
}

function getRelativePath(rootDir, file) {
  let pathname
  if (rootDir) {
    const relPath = relativePath(rootDir, file)
    if (relPath.startsWith('./')) {
      pathname = relPath.substring(2)
      if (pathname === '.') {
        pathname = '/'
      }
    }
  }
  return pathname === undefined ? `${getFileBaseName(file, true)}` : pathname
}

function setFilePath(module, pathname) {
  module.filePath = getRelativePathUnderCwd(pathname)
}

function isIndexComponent(module) {
  const { pathname, children } = module
  if (!children) {
    return /^index\./i.test(getFileBaseName(pathname))
  }
  return false
}

function isUnknownRoute(module) {
  const { ut_build_router_params_symbol: paramsSymbol = '_' } = process.env
  // /^_{1,2}$/
  return new RegExp(`^${escapeRegExp(paramsSymbol)}{1,2}$`).test(
    getFileBaseName(module.pathname, true)
  )
}

function matchNamedView(fileName) {
  const { ut_build_router_view_symbol: viewSymbol = '@' } = process.env

  // /^(?:@|[^@]+@)([^.]+)(?:\.|$)/
  const matcher = new RegExp(
    `^(?:${escapeRegExp(viewSymbol)}|[^${escapeRegExp(viewSymbol)}]+${escapeRegExp(
      viewSymbol
    )})([^.]+)(?:\\.|$)`
  ).exec(fileName)

  if (matcher) {
    return matcher[1]
  }
  return ''
}

function sortModuleProps(module, before = [], after = []) {
  const cloned = Object.assign({}, module)
  const keys = Object.keys(module)
  const beforeProps = before.filter((prop) => keys.includes(prop))
  const centerProps = keys.filter(
    (prop) => !before.includes(prop) && !after.includes(prop)
  )
  const afterProps = after.filter((prop) => keys.includes(prop))

  for (const key of keys) {
    delete module[key]
  }

  beforeProps
    .concat(centerProps)
    .concat(afterProps)
    .forEach((prop) => {
      module[prop] = cloned[prop]
    })
}

function sortRouteChildren(route, unknown) {
  const { children } = route
  if (children && children.length) {
    const dynamicRoutes = []
    const exactRoutes = []
    const bundleRoutes = []
    const unknownRoutes = []
    const paramsReg = /(?:\/|^):[^:/]+$/
    for (const child of children) {
      const { path, bundle } = child
      if (path) {
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
    route.children = exactRoutes
      .concat(bundleRoutes)
      .concat(dynamicRoutes)
      .concat(unknownRoutes)
    //
    logIgnoredDynamicRoutes(route, unknown === true ? unknownRoutes : dynamicRoutes)
  }
}

function getAbsoluteRoutePath(route) {
  const paths = [route.path]
  let parent
  while ((parent = route.parent)) {
    const { path } = parent
    paths.unshift(!path || path === '/' ? '' : path)
    route = parent
  }
  return paths.join('/')
}

function setRoutePathAndName(route, parent, context) {
  const { pathname, name } = route
  if (typeof name === 'undefined') {
    route.name = toUnKebabString(
      formatPath(
        getRelativePath(context, pathname),
        Object.assign(
          {
            camelCase: false,
          },
          defaultPathFormatSetup
        )
      )
    )
  }

  //
  if (typeof route.path !== 'undefined') {
    route.absRoutePath = route.path
    return
  }

  if (parent) {
    const path = formatPath(getRelativePath(parent.pathname, pathname))
    if (/^(?:\?|)$/.test(path)) {
      route.path = ''
      route.absRoutePath = ''
    } else {
      route.path = path
      route.absRoutePath = getAbsoluteRoutePath(route)
    }
  } else {
    route.path = '/'
    route.absRoutePath = '/'
  }
  return route
}

function setRouteIndexComponent(route, indexPath, context) {
  if (!route.component) {
    route.component = {
      bundle: indexPath,
      namespace: formatPath(getRelativePath(context, indexPath), defaultPathFormatSetup),
    }
    setFilePath(route, indexPath)
  } else {
    logIgnoredIndexRoute(route, indexPath)
  }
}

function setUnknownRoute(route, unknownRoute) {
  if (!route.unknown) {
    route.unknown = unknownRoute
  } else {
    logIgnoredUnknownRoute(route, unknownRoute)
  }
}

function setRouteNamedViewComponents(route, namedView, namedViewPathname, context) {
  // 命名视图路由组件
  const components = route.components || {}
  route.components = components
  components[namedView] = {
    bundle: namedViewPathname,
    namespace: `${formatPath(
      getRelativePath(context, namedViewPathname),
      defaultPathFormatSetup
    )}/${namedView}`,
  }
}

function setNamedViewComponents(route) {
  // 修正路由命名视图
  const { components, component: routeComponent } = route
  if (components) {
    if (!components.default) {
      if (routeComponent) {
        components.default = routeComponent
        delete route.component
      }
    } else if (routeComponent) {
      delete route.component
    }

    route.props = Object.keys(components).reduce((props, key) => {
      props[key] = true
      return props
    }, {})
  } else {
    route.props = true
  }
  return { components, component: routeComponent }
}

function findSpecialRouteModule(route, logger) {
  const { pathname } = route
  let special = null
  for (const module of route.children) {
    if (isIndexComponent(module)) {
      special = module
      break
    }
  }

  const ignoredRoutes = route.children
    .filter((route) => route !== special)
    .map((route) => chalk['cyan'](getRelativePathUnderCwd(route.pathname)))
  logger(pathname, ignoredRoutes)

  return special
}

function findUnknownRoute(route) {
  return findSpecialRouteModule(route, logIgnoredUnknownRoutes)
}

function findNamedViewComponent(route) {
  return (findSpecialRouteModule(route, logIgnoredNamedViewRoutes) || {}).pathname
}

function resolveChildrenRoutes(route, context) {
  //
  let dirIndexPath = ''
  let dirUnknownRoute = null
  const { children, ignoredChildren } = route
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    const { pathname: childPathname } = child
    const fileName = getFileBaseName(childPathname)
    const namedView = matchNamedView(fileName)
    const unknownRoute = !namedView ? isUnknownRoute(child) : false
    let namedViewPathname = namedView ? childPathname : ''

    if (child.children) {
      const childChildren = child.children
      if (!namedView) {
        if (unknownRoute) {
          if (!dirUnknownRoute) {
            dirUnknownRoute = findUnknownRoute(child)
          }
          // 移除非子路由模块(unknownRoute)
          children.splice(index--, 1)
          ignoredChildren.push(child)
        } else if (
          fileName === 'index' &&
          childChildren.length === 1 &&
          isIndexComponent(childChildren[0])
        ) {
          dirIndexPath = childChildren[0].pathname
          // 移除非子路由模块(indexDirComponent)
          children.splice(index--, 1)
          ignoredChildren.push(child)
        }

        continue
      }

      // dir named view
      namedViewPathname = findNamedViewComponent(child)
      if (!namedViewPathname) {
        // 移除非子路由模块(invalidDirNamedView)
        children.splice(index--, 1)
        ignoredChildren.push(child)
        continue
      }
    }

    if (namedView) {
      setRouteNamedViewComponents(route, namedView, namedViewPathname, context)
    } else if (unknownRoute) {
      setUnknownRoute(route, child)
    } else if (isIndexComponent(child)) {
      setRouteIndexComponent(route, childPathname, context)
    } else {
      continue
    }

    // 移除非子路由模块(namedView、indexDirNamedView、indexComponent、unknownRoute)
    children.splice(index--, 1)
    ignoredChildren.push(child)
  }

  return { indexPath: dirIndexPath, unknownRoute: dirUnknownRoute }
}

//
module.exports = exports = (routerConfigPath, context) => {
  // 解析路由配置
  return (route, parent) => {
    const { pathname, relativePath, children, ignoredChildren } = route
    setRoutePathAndName(route, parent, context)

    if (!children) {
      // 路由组件
      route.component = {
        bundle: pathname,
        namespace: relativePath,
      }
      route.props = true
      setFilePath(route, pathname)
      sortModuleProps(route, ['filePath'])
      return
    }

    const { indexPath, unknownRoute } = resolveChildrenRoutes(route, context)
    if (indexPath) {
      setRouteIndexComponent(route, indexPath, context)
    }
    if (unknownRoute) {
      setUnknownRoute(route, unknownRoute)
    }

    const { components, component } = setNamedViewComponents(route)

    // 自定义路由配置
    let router = joinPath(pathname, routerConfigPath)
    if (existsSync(router)) {
      children.push({
        bundle: router,
        namespace: relativePath,
      })
    } else {
      router = ''
    }

    // 未知路由匹配组件，放在最后
    const actualUnknownRoute = route.unknown
    if (actualUnknownRoute) {
      const index = children.findIndex((item) => item === actualUnknownRoute)
      if (index !== -1) {
        children.splice(index, 1)
      }
      children.push(actualUnknownRoute)
      actualUnknownRoute.parent = route
      actualUnknownRoute.path = ''
      // 默认路由的名称设为当前路由名称
      actualUnknownRoute.name = route.name
      delete route.name
    }

    // 属性排序
    sortModuleProps(route, ['filePath', 'path', 'name'], ['children'])

    // 检查正确性
    if (!components && !component && !router && route.nested) {
      logInvalidEmbeddedRoute(route)
    }

    if (parent && !parent.nested && components) {
      logInvalidNestedRoutes(route)
    }
  }
}

exports.defaultPathFormatSetup = defaultPathFormatSetup
exports.getRelativePath = getRelativePath
exports.formatPath = formatPath
exports.sortModuleProps = sortModuleProps
exports.sortRouteChildren = sortRouteChildren
