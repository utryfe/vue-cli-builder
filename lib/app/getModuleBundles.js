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

const logger = require('../utils/logger')
const innerLogger = require('./logger')

const defaultPathFormatSetup = {
  leading: '',
  training: '',
}

function formatPath(path, setup) {
  const { leading = ':', training = '?', camelCase = true } = Object.assign({}, setup)
  const {
    ut_build_router_params_symbol: paramsSymbol = '_',
    ut_build_router_view_symbol: viewSymbol = '#',
  } = process.env

  // /(?:\/?#[^/]+|\.[^/]*)$/g
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

  return path.replace(viewSymbolReg, '').replace(paramsSymbolReg, ($0, $1, $2, $3) => {
    return `${$1}${($2 || $3).replace(innerReg, ($0, $1, $2, $3) => {
      return `${$1 ? leading : ''}${camelCase ? lodash.camelCase($2) : $2}${
        $3 ? training : ''
      }`
    })}`
  })
}

function matchNamedView(fileName) {
  const { ut_build_router_view_symbol: viewSymbol = '#' } = process.env

  // /^(?:#|[^#]+#)([^.]+)(?:\.|$)/
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
  return relativePath(process.cwd(), pathname).replace(/^\.\//, '')
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
    const { pathname, relativePath, children } = mod

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

    // 嵌套路由
    for (let index = 0; index < children.length; index++) {
      const child = children[index]
      const { pathname } = child
      const fileName = getFileBaseName(pathname)
      const namedView = matchNamedView(fileName)
      let namedViewPath = namedView ? pathname : ''

      if (child.children) {
        if (!namedView) {
          continue
        }
        // 目录形式的命名视图组件

        let indexPathname
        for (const view of child.children) {
          if (isIndexComponent(view)) {
            indexPathname = view.pathname
            break
          }
        }

        if (indexPathname) {
          namedViewPath = indexPathname
        } else {
          // 移除非有效的命名视图
          children.splice(index--, 1)

          logger.warn(
            `\nThe directory path of '${getRelativePath(
              process.cwd(),
              pathname
            )}' contains a '${process.env.ut_build_router_view_symbol ||
              '#'}' symbol which is used as the named router view.\n`
          )

          continue
        }
      }

      if (namedView) {
        // 命名视图路由组件
        const components = mod.components || {}
        mod.components = components
        components[namedView] = {
          bundle: namedViewPath,
          namespace: `${formatPath(
            getRelativePath(context, namedViewPath),
            defaultPathFormatSetup
          )}/${namedView}`,
        }
      } else if (isIndexComponent(child)) {
        // 子路由模块入口组件
        if (!mod.component) {
          mod.component = {
            bundle: pathname,
            namespace: formatPath(
              getRelativePath(context, pathname),
              defaultPathFormatSetup
            ),
          }
          setFilePath(mod, pathname)
        }
      } else {
        continue
      }

      // 移除非子路由模块
      children.splice(index--, 1)
    }

    // 修正路由命名视图
    const { components, component: cmp } = mod
    if (components) {
      if (!components.default) {
        if (cmp) {
          components.default = cmp
          delete mod.component
        }
      } else if (cmp) {
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

    sortProps(mod, ['filePath'], ['children'])

    // 检查正确性
    if (!components && !cmp && !moduleRoutes) {
      const relPath = mod.filePath || getRelativePathUnderPwd(mod.pathname)
      innerLogger.warn(
        `There is no route component defined under the directory '${chalk['bold']['cyan'](
          isDirectory(relPath, true) ? relPath : relPath.replace(/[\\/][^\\/]+$/, '')
        )}' where contains some sub-routes in sub-directory.`
      )
    }
  }
}

function getStoreParser(storeConfigPath) {
  return (mod, parent, root) => {
    const { pathname, relativePath, children } = mod
    if (!parent) {
      const tag = `<${randomSequence(10e6)}>`
      mod.state = {}
      mod.modules = {}
      mod.storePropName = `${tag}[Store]${tag}`
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
    transverseTree(bundles, 'children', (module, parent) => {
      const { pathname } = module
      if (!pathname) {
        return
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
    })
  }

  return bundles
}

exports.formatPath = formatPath
