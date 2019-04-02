const { lowerFirst } = require('lodash')

const {
  getFileBaseName,
  writeFileSync,
  relativePath,
  resolvePath,
} = require('../utils/file')

const { hash, formatCode } = require('../utils/common')
const emitter = require('../utils/emitter')

const debug = require('debug')('service:generate')

// 解析模块
const getModuleBundles = require('./getModuleBundles')

// 将文件列表转换为文件树
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

// 变量导入
const imports = {
  // 导入顺序要保证
  launch: require('./importCreateApp'),
  globalMain: require('./importGlobalMain'),
  moduleMain: require('./importModuleMain'),
  render: require('./importAppRender'),
  store: require('./importStoreOptions'),
  router: require('./importRouterOptions'),
}

// 文件hash缓存
const cache = {}

// 创建入口文件
function writeEntryFileSync(output, options) {
  output = resolvePath(`node_modules/.code/${output}`)

  const codeFragment = []
  for (const [variable, generator] of Object.entries(imports)) {
    codeFragment.push(generator(Object.assign({ importName: variable }, options)))
  }

  // 创建App
  codeFragment.push('// Go!\n')
  codeFragment.push(`launch({store,router,render},globalMain,moduleMain)\n`)

  const code = formatCode(codeFragment.join('\n'))
  const fileHash = hash(code)
  if (cache[output] !== fileHash) {
    debug(`file changed. ${output}:${fileHash}`)
    cache[output] = fileHash
    writeFileSync(output, code, { encoding: 'utf8' })
    emitter.emit('entry-changed')
  }

  return output
}

//
module.exports = exports = ({
  type,
  modules,
  config,
  publicPath,
  context = `${process.cwd()}/src`,
}) => {
  const entryPoints = []
  const moduleTree = toModuleTree(modules, context)

  if (type === 'spa') {
    // 创建单页入口文件
    entryPoints.push({
      module: 'index',
      moduleName: '',
      entry: writeEntryFileSync('index.js', {
        bundles: getModuleBundles({ modules: moduleTree, config, context }),
        publicPath,
        context,
        config,
        type,
      }),
    })
    //
  } else {
    const pages = {}
    if (moduleTree) {
      for (const module of moduleTree['children']) {
        const name = lowerFirst(
          getFileBaseName(
            getModuleBundles.formatPath(getFileBaseName(module.pathname), {
              leading: '',
              training: '',
            })
          )
        ).replace(/\W/g, '')

        const entry = pages[name] || []
        entry.push(Object.assign({}, moduleTree, { children: [module] }))
        pages[name] = entry
      }
    }

    for (const [name, page] of Object.entries(pages)) {
      for (const [index, moduleTree] of Object.entries(page)) {
        const { pathname } = moduleTree
        entryPoints.push({
          module: pathname,
          moduleName: name,
          entry: writeEntryFileSync(`${name}${index || ''}.js`, {
            bundles: getModuleBundles({ modules: moduleTree, config, context }),
            moduleName: name,
            publicPath,
            module,
            context,
            config,
            type,
          }),
          //
        })
      }
    }
  }
  //
  return entryPoints
}
