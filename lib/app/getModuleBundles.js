const lodash = require('lodash')
const chalk = require('chalk')

const {
  //
  getFileBaseName,
  relativePath,
  existsSync,
  joinPath,
  isDirectory,
} = require('../utils/file')

const {
  transverseTree,
  escapeRegExp,
  randomSequence,
  toKebabString,
  toUnKebabString,
} = require('../utils/common')

const innerLogger = require('./logger')

const defaultPathFormatSetup = {
  leading: '',
  training: '',
}

const cwd = process.cwd()

function formatPath(path, setup) {
  const { leading = ':', training = '?', camelCase = true } = Object.assign({}, setup)
  const {
    ut_build_router_params_symbol: paramsSymbol = '_',
    ut_build_router_view_symbol: viewSymbol = '@',
  } = process.env

  // /(^|\/)\[([^/]+?)](?=\/|$)/g
  const nestedSymbolReg = /(^|\/)\[([^/]+?)](?=\/|$)/g

  // /(?:\/?@[^/]+|\.[^/]*)$/g
  const viewSymbolReg = new RegExp(
    `(?:\\/?${escapeRegExp(viewSymbol)}[^/]+|\\.[^/]*)$`,
    'g'
  )

  // /(^|\/)(?:(\$[^\/]+)|([^\/]+?\$))(?=\/|$)/g
  const paramsSymbolReg = new RegExp(
    `(^|\\/)(?:(${escapeRegExp(paramsSymbol)}[^\\/]+)|([^\\/]+?${escapeRegExp(
      paramsSymbol
    )}))(?=\\/|$)`,
    'g'
  )

  // /^(\$)?(.*?)(\$)?$/
  const innerReg = new RegExp(
    `^(${escapeRegExp(paramsSymbol)})?(.*?)(${escapeRegExp(paramsSymbol)})?$`
  )

  return path
    .replace(nestedSymbolReg, '$1$2')
    .replace(viewSymbolReg, '')
    .replace(paramsSymbolReg, ($0, $1, $2, $3) => {
      return `${$1}${($2 || $3).replace(innerReg, ($0, $1, $2, $3) => {
        return `${$1 ? leading : ''}${camelCase ? lodash.camelCase($2) : $2}${
          $3 ? training : ''
        }`
      })}`
    })
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

function isIndexComponent(module) {
  const { pathname, children } = module
  if (!children) {
    return /^index\./i.test(getFileBaseName(pathname))
  }
  return false
}

function getRelativePathUnderPwd(pathname) {
  return relativePath(cwd, pathname).replace(/^\.\//, '')
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
  module.filePath = getRelativePathUnderPwd(pathname)
}

// 调整属性顺序
function sortProps(module, before = [], after = []) {
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

// 解析路由配置
function getRouteParser(routerConfigPath, context) {
  return (mod, parent) => {
    const { pathname, relativePath, children, ignoredChild } = mod

    // 路由名称与路径
    mod.name = toUnKebabString(
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

    mod.path = parent ? formatPath(getRelativePath(parent.pathname, pathname)) : '/'

    if (!children) {
      // 路由组件
      mod.component = { bundle: pathname, namespace: relativePath }
      mod.props = true
      setFilePath(mod, pathname)
      sortProps(mod, ['filePath'])
      return
    }

    // 子路由

    let indexDirComponentPathname = ''
    for (let index = 0; index < children.length; index++) {
      const child = children[index]
      const { pathname: childPathname } = child
      const fileName = getFileBaseName(childPathname)
      const namedView = matchNamedView(fileName)
      let namedViewPathname = namedView ? childPathname : ''

      if (child.children) {
        const childChildren = child.children
        if (!namedView) {
          // 非命名视图
          // 检查是否是目录格式的index组件
          if (
            fileName === 'index' &&
            childChildren.length === 1 &&
            isIndexComponent(childChildren[0])
          ) {
            indexDirComponentPathname = childChildren[0].pathname
            // 移除非子路由模块(indexDirComponent)
            children.splice(index--, 1)
            ignoredChild.push(child)
          }

          continue
        }

        // 目录形式的命名视图组件
        let indexDirNamedViewPathname
        for (const view of child.children) {
          if (isIndexComponent(view)) {
            indexDirNamedViewPathname = view.pathname
            break
          }
        }

        if (indexDirNamedViewPathname) {
          namedViewPathname = indexDirNamedViewPathname
        }

        const ignoredRoutes = child.children
          .filter((route) => route.pathname !== indexDirNamedViewPathname)
          .map((route) => chalk['cyan'](getRelativePath(cwd, route.pathname)))
        if (ignoredRoutes.length) {
          innerLogger.warn(
            `The directory path of ${chalk['bold']['cyan'](
              getRelativePath(cwd, childPathname)
            )} contains a ${chalk['bold']['cyan'](
              process.env.ut_build_router_view_symbol || '@'
            )} symbol which is used as the named router view.\nThese routes under the directory will be ignored:\n${
              // 被忽略路由项
              ignoredRoutes.join('\n')
            }\n`
          )
        }

        if (!indexDirNamedViewPathname) {
          // 移除非子路由模块(invalidDirNamedView)
          children.splice(index--, 1)
          ignoredChild.push(child)
          continue
        }
      }

      if (namedView) {
        // 命名视图路由组件
        const components = mod.components || {}
        mod.components = components
        components[namedView] = {
          bundle: namedViewPathname,
          namespace: `${formatPath(
            getRelativePath(context, namedViewPathname),
            defaultPathFormatSetup
          )}/${namedView}`,
        }
      } else if (isIndexComponent(child)) {
        // 子路由模块入口组件
        if (!mod.component) {
          // 如果已经有了，就不再覆盖
          mod.component = {
            bundle: childPathname,
            namespace: formatPath(
              getRelativePath(context, childPathname),
              defaultPathFormatSetup
            ),
          }
          setFilePath(mod, childPathname)
        } else {
          innerLogger.warn(
            `There already have a index component named by ${chalk['bold']['cyan'](
              getRelativePath(cwd, mod.component.bundle)
            )} under the directory of ${chalk['bold']['cyan'](
              getRelativePath(cwd, pathname)
            )}\nThese routes under the directory will be ignored:\n${
              // 被忽略路由项
              chalk['cyan'](getRelativePath(cwd, childPathname))
            }\n`
          )
        }
      } else {
        continue
      }

      // 移除非子路由模块(namedView、indexDirNamedView、indexComponent)
      children.splice(index--, 1)
      ignoredChild.push(child)
    }

    if (indexDirComponentPathname) {
      if (!mod.component) {
        // 目录格式的模块路由index组件
        mod.component = {
          bundle: indexDirComponentPathname,
          namespace: formatPath(
            getRelativePath(context, indexDirComponentPathname),
            defaultPathFormatSetup
          ),
        }
        setFilePath(mod, indexDirComponentPathname)
      } else {
        innerLogger.warn(
          `There already have a index component named by ${chalk['bold']['cyan'](
            getRelativePath(cwd, mod.component.bundle)
          )} under the directory of ${chalk['bold']['cyan'](
            getRelativePath(cwd, pathname)
          )}\nThese routes under the directory will be ignored:\n${
            // 被忽略路由项
            chalk['cyan'](getRelativePath(cwd, indexDirComponentPathname))
          }\n`
        )
      }
    }

    // 修正路由命名视图
    const { components, component: routeComponent } = mod
    if (components) {
      if (!components.default) {
        if (routeComponent) {
          components.default = routeComponent
          delete mod.component
        }
      } else if (routeComponent) {
        delete mod.component
      }

      mod.props = Object.keys(components).reduce((props, key) => {
        props[key] = true
        return props
      }, {})
    } else {
      mod.props = true
    }

    // 自定义路由配置
    let moduleRoutes = joinPath(pathname, routerConfigPath)
    if (existsSync(moduleRoutes)) {
      children.push({
        bundle: moduleRoutes,
        namespace: relativePath,
      })
    } else {
      moduleRoutes = ''
    }

    sortProps(mod, ['filePath', 'path', 'name'], ['children'])

    // 检查正确性
    if (!components && !routeComponent && !moduleRoutes) {
      const relPath = mod.filePath || getRelativePathUnderPwd(mod.pathname)
      innerLogger.warn(
        `There is no route component defined under the directory ${chalk['bold']['cyan'](
          isDirectory(relPath, true) ? relPath : relPath.replace(/[\\/][^\\/]+$/, '')
        )} where contains some sub-routes in sub-directory.`
      )
    }
  }
}

function getStoreParser(storeConfigPath) {
  return (mod, parent, root) => {
    const { pathname, relativePath, children } = mod
    if (!parent) {
      const tag = `<${randomSequence(10e6)}>`
      Object.assign(mod, {
        state: {},
        modules: {},
        storePropName: `${tag}[Store]${tag}`,
      })
    }

    if (!children) {
      return
    }

    // 子模块

    const moduleStore = joinPath(pathname, storeConfigPath)
    if (!existsSync(moduleStore)) {
      return
    }

    const storePropName = root.storePropName

    if (!parent) {
      const modules = mod.modules
      delete mod.modules
      mod[storePropName] = { bundle: moduleStore, namespace: '/' }
      mod.modules = modules
      return
    }

    const paths = relativePath.split('/')
    let modules = root.modules

    for (const [index, path] of Object.entries(paths)) {
      if (!modules[path]) {
        const storeSetup = { namespaced: true, state: {}, modules: {} }
        modules[path] = storeSetup

        if (+index === paths.length - 1) {
          // 调整对象属性顺序
          const modules = storeSetup.modules
          delete storeSetup.modules
          storeSetup[storePropName] = {
            bundle: moduleStore,
            namespace: relativePath,
          }
          storeSetup.modules = modules
          continue
        }
      }

      modules = modules[path].modules
    }
  }
}

module.exports = exports = ({ modules, context, config }) => {
  if (!modules) {
    return null
  }

  const bundles = lodash.cloneDeep(modules)

  const {
    build_module_router_name,
    build_module_store_name,
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
    const symbolReg = /^\[.*?]$/
    const ignoredBundles = []

    transverseTree(bundles, 'children', (module, parent) => {
      const { pathname, children } = module
      if (!pathname) {
        return
      }

      if (children) {
        module.symbolNested = symbolReg.exec(getFileBaseName(pathname))
        module.ignoredChild = []
      }

      module.normalizedPath = formatPath(pathname, defaultPathFormatSetup)
      module.relativePath = formatPath(
        getRelativePath(context, pathname),
        defaultPathFormatSetup
      )
      module.originalPath = formatPath(
        pathname,
        Object.assign({ camelCase: false }, defaultPathFormatSetup)
      )

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

      if (!module.ignoredChild) {
        return
      }

      for (const { children, pathname } of module.ignoredChild) {
        if (!children) {
          continue
        }
        let bundle
        if (
          routeParser &&
          existsSync((bundle = joinPath(pathname, build_module_router_name)))
        ) {
          ignoredBundles.push(bundle)
        }
        if (
          storeParser &&
          existsSync((bundle = joinPath(pathname, build_module_store_name)))
        ) {
          ignoredBundles.push(bundle)
        }
      }

      //
    })

    if (ignoredBundles.length) {
      innerLogger.warn(
        `As a result of the route has been ignored, these bundles will also be ignored:\n${ignoredBundles
          .map((bundle) => chalk['cyan'](getRelativePath(cwd, bundle)))
          .join('\n')}`
      )
    }
  }

  return bundles
}

exports.formatPath = formatPath
