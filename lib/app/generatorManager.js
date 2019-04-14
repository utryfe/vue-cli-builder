const cloneDeep = require('lodash/cloneDeep')

const { writeFileSync, relativePath, resolvePath } = require('../utils/file')
const { hash, formatCode, transverseTree, escapeRegExp } = require('../utils/common')
const emitter = require('../utils/emitter')

const debug = require('debug')('service:generate')
// require('debug').enable('service:generate')

// 解析模块
const getModuleBundles = require('./getModuleBundles')
const { sortModuleProps } = getModuleBundles

// 将文件列表转换为目录文件树
function toModuleTree(files, context) {
  const maps = {}
  let root = null
  for (const file of files) {
    file.split(/[/\\]/g).reduce((path, cur, index, array) => {
      const dir = maps[path]
      if (index === array.length - 1) {
        if (dir) {
          dir.children.push({
            pathname: file,
            parent: dir,
          })
        }
      } else {
        const curPath = `${path}/${cur}`
        if (!maps[curPath]) {
          const curDir = {
            pathname: curPath,
            children: [],
            parent: dir,
          }
          maps[curPath] = curDir
          if (!root) {
            root = curDir
          }
          if (dir) {
            dir.children.push(curDir)
          }
        }
        return curPath
      }
    })
  }

  let moduleRoot = null
  while (root && root.children) {
    const { pathname, children } = root
    if (context) {
      if (pathname === context || relativePath(pathname, context).endsWith('.')) {
        moduleRoot = root
        break
      }
    } else if (children.some((dir) => !dir.children)) {
      moduleRoot = root
      break
    }
    root = root.children ? root.children[0] : null
  }

  if (moduleRoot) {
    moduleRoot.parent = null
  }

  return moduleRoot
}

// 生成器
const generators = [
  { name: 'base', generator: require('./importBaseBundles') },
  { name: 'plugins', generator: require('./importPluginBundles') },
  { name: 'launch', generator: require('./importAppLauncher') },
  { name: 'main', generator: require('./importGlobalMain') },
  { name: 'render', generator: require('./importAppRender') },
  // store 要在 router 前面导入
  { name: 'store', generator: require('./importStoreOptions') },
  { name: 'router', generator: require('./importRouterOptions') },
]

// 文件hash缓存
const cache = {}

// 创建入口文件
function writeEntryFileSync(output, options, handleChange) {
  output = resolvePath(`node_modules/.code/${output}`)

  const codeFragment = []
  for (const { name, generator } of generators) {
    codeFragment.push(generator(Object.assign({ importName: name }, options)))
  }

  // 创建App
  codeFragment.push('// Go! ❤️🚀\n')
  codeFragment.push(`launch({store,router,render},main,plugins)\n`)

  const code = formatCode(codeFragment.join('\n'))
  const fileHash = hash(code)
  if (cache[output] !== fileHash) {
    debug(`file changed. ${output}:${fileHash}`)
    cache[output] = fileHash
    writeFileSync(output, code, { encoding: 'utf8' })
    if (typeof handleChange === 'function') {
      handleChange(output)
    }
  }

  return output
}

function hasRouterBundleOrUnknown(route) {
  const { children } = route
  if (children && children.length) {
    return !!children.find((item) => !item.path || item.bundle)
  }
  return false
}

function getRouteBundle(route) {
  const { children } = route
  let bundle
  if (children && children.length) {
    bundle = Object.assign({}, route, {
      children: children.filter((child) => !child.path || !!child.bundle),
    })
  } else {
    bundle = route
  }
  return bundle
}

//
module.exports = exports = ({ type, files, config, httpMock, publicPath, context }) => {
  debug('start to generate entries.')

  const entryPoints = []
  const modules = toModuleTree(files, context)
  const bundles = getModuleBundles({ modules, config, context })
  let changed = false

  if (type === 'spa') {
    entryPoints.push({
      moduleName: 'index',
      module: bundles && bundles['filePath'] ? bundles['filePath'] : 'index',
      entry: writeEntryFileSync(
        'index.js',
        {
          bundles,
          publicPath,
          httpMock,
          context,
          config,
        },
        () => {
          changed = true
        }
      ),
    })
  } else {
    //
    transverseTree(bundles, (route) => {
      route = cloneDeep(route)

      const {
        path,
        nested,
        components,
        component,
        absRoutePath,
        filePath,
        relativePath,
      } = route

      if (!path) {
        return
      }

      const isRoot = absRoutePath === '/'
      const hasBundleOrUnknown = hasRouterBundleOrUnknown(route)

      // 没有组件可以渲染
      if (!isRoot && !component && !components && !hasBundleOrUnknown) {
        return nested ? 'exit' : ''
      }

      route.path = absRoutePath
      if (absRoutePath !== '/') {
        route.alias = '/'
      }

      sortModuleProps(route, ['filePath', 'alias', 'path', 'name'])
      //
      if (nested) {
        const rootPathReg = new RegExp(`^${escapeRegExp(absRoutePath)}`)
        transverseTree(route.children, (route) => {
          const subRoutePath = route.absRoutePath
          if (subRoutePath) {
            route.path = subRoutePath
            const alias = subRoutePath.replace(rootPathReg, '')
            if (alias !== subRoutePath) {
              route.alias = alias
            }
            sortModuleProps(route, ['filePath', 'alias', 'path', 'name'])
          }
        })
      }

      if (component || components || hasBundleOrUnknown) {
        const moduleName = !isRoot ? relativePath : 'index'
        entryPoints.push({
          moduleName,
          module: filePath || 'index',
          entry: writeEntryFileSync(
            `${moduleName}.js`,
            {
              bundles: getRouteBundle(route),
              publicPath,
              httpMock,
              context,
              config,
            },
            () => {
              changed = true
            }
          ),
        })
      }

      //
      if (nested) {
        return 'exit'
      }
    })
  }

  debug('entries generate completed.')
  if (changed) {
    emitter.emit('entry-changed')
  }
  //
  return entryPoints
}
