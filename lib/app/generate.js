const fs = require('fs')
const lodash = require('lodash')
const fileUtil = require('../utils/file')
const commonUtil = require('../utils/common')

const debug = require('debug')('service:generate')

// 解析模块
const getModuleBundles = require('./getModuleBundles')

// 变量导入
const imports = {
  // 导入全局根组件
  importGlobalApp: require('./importGlobalApp'),
  // 导入模块组件
  importModuleApp: require('./importModuleApp'),
  // 导入全局路由
  importGlobalRoutes: require('./importGlobalRoutes'),
  // 导入全局Store
  importGlobalStore: require('./importGlobalStore'),
  // 导入模块路由
  importModuleRoutes: require('./importModuleRoutes'),
  // 导入模块Store
  importModuleStores: require('./importModuleStores'),
}

const template = lodash.template(
  fs.readFileSync(fileUtil.joinPath(__dirname, 'template', 'code.js.txt')).toString(),
  {
    interpolate: /<%=([\s\S]+?)%>/g,
  }
)

// 文件hash缓存
const cache = {}

// 创建入口文件
function writeEntryFileSync(output, setup) {
  output = fileUtil.resolvePath(`node_modules/.code/${output}`)
  const { type, config } = setup
  const { BUILD_APP_USE_VUEX: useVuex, BUILD_APP_USE_ROUTER: useRouter } = config
  const code = commonUtil.formatCode(
    template(
      Object.keys(imports).reduce(
        (vars, name) => {
          vars[name] = imports[name](setup)
          return vars
        },
        {
          // 应用类型
          type: `'${type}'`,
          // 是否使用路由
          useRouter,
          // 是否使用状态管理
          useVuex,
        }
      )
    )
  )
  //
  const hash = commonUtil.hash(code)
  if (cache[output] !== hash) {
    debug(`file changed. ${output}:${hash}`)
    cache[output] = hash
    fileUtil.writeFileSync(output, code, { encoding: 'utf8' })
  }
  return output
}

//
module.exports = ({ type, modules, config, context = process.cwd() }) => {
  const entryPoints = []
  if (type === 'spa') {
    // 创建单页入口文件
    entryPoints.push({
      module: 'index',
      moduleName: '',
      entry: writeEntryFileSync('index.js', {
        bundles: getModuleBundles({ modules, config }),
        context,
        config,
        type,
      }),
    })
    //
  } else {
    // 多页入口不需要进行代码分片
    config.BUILD_CODE_SPLITTING = false
    //
    const entries = {}
    // 名称
    modules.forEach((module) => {
      const name = lodash.camelCase(fileUtil.getShortDirName(module)).replace(/\W/g, '')
      const entry = entries[name] || []
      entries[name] = entry
      entry.push(module)
    })
    // 生成多页模块的入口文件

    Object.keys(entries).forEach((entry) => {
      entries[entry].forEach((module, index) => {
        //
        const moduleName = fileUtil.getShortDirName(module)
        entryPoints.push({
          module,
          moduleName,
          entry: writeEntryFileSync(`${entry}${index || ''}.js`, {
            bundles: getModuleBundles({ config, modules: [module] }),
            moduleName,
            module,
            context,
            config,
            type,
          }),
          //
        })
      })
    })
  }
  //
  return entryPoints
}
