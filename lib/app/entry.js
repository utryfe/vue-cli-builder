const debug = require('debug')('service:entry')
//
const getEnv = require('../utils/env')
const logger = require('../utils/logger')
const fileUtil = require('../utils/file')
const commonUtil = require('../utils/common')
const emitter = require('../utils/emitter')

const generate = require('./generate')

// 默认的构建配置
const defaultBuildConfig = {
  // 模块入口
  BUILD_MODULE_ENTRY: 'src/main.js',
  // html模板页面路径
  BUILD_HTML_TEMPLATE: 'public/index.html',
  // 只构建指定的模块
  BUILD_MODULE_FILTER: '',
  // 是否构建多页应用
  BUILD_MPA: false,
  // 是否使用模块懒加载
  BUILD_CODE_SPLITTING: true,
  // 路由名称和页面名称使用连字符格式
  BUILD_USE_HYPHEN_NAME: false,
  // 使用vuex
  BUILD_APP_USE_VUEX: true,
  // 使用vue router
  BUILD_APP_USE_ROUTER: true,
  // 根App路径
  BUILD_ROOT_APP_PATH: 'src/App.vue',
  // 全局Store路径
  BUILD_GLOBAL_STORE_PATH: 'src/store.js',
  // 全局Router路径
  BUILD_GLOBAL_ROUTER_PATH: 'src/router.js',
  // 模块router文件名称（可以是相对于模块目录的子目录文件路径）
  BUILD_MODULE_ROUTER_NAME: 'router.js',
  // 模块store文件名称（可以是相对于模块目录的子目录文件路径）
  BUILD_MODULE_STORE_NAME: 'store.js',
}

// 构建入口管理器
class EntryManager {
  constructor(projectOptions) {
    this.options = projectOptions || {}
    const { preprocess } = Object.assign({}, projectOptions.pluginOptions)
    this.env = getEnv()
    this.config = this.getConfig(preprocess)
    const entrySetup = Object.assign({}, this.config)
    if (preprocess) {
      let { transpileDependencies } = projectOptions
      if (!Array.isArray(transpileDependencies)) {
        transpileDependencies = []
      }
      // 添加对生成代码的babel转译支持
      transpileDependencies.push(/[/\\]node_modules[/\\]\.code[/\\].+?\.js$/)
      projectOptions.transpileDependencies = transpileDependencies
      // 清理临时代码目录
      fileUtil.removeSync('node_modules/.code')
    } else {
      // 清除变量打印
      const preprocessSetup = [
        'BUILD_MPA',
        'BUILD_CODE_SPLITTING',
        'BUILD_APP_USE_VUEX',
        'BUILD_APP_USE_ROUTER',
        'BUILD_USE_HYPHEN_NAME',
        'BUILD_ROOT_APP_PATH',
        'BUILD_GLOBAL_STORE_PATH',
        'BUILD_GLOBAL_ROUTER_PATH',
        'BUILD_MODULE_ROUTER_NAME',
        'BUILD_MODULE_STORE_NAME',
      ]
      for (const item of preprocessSetup) {
        delete entrySetup[item]
      }
    }
    this.env.registerVariables('BUILD_ENTRY_SETUP', entrySetup)
  }

  // 获取构建配置
  getConfig(preprocessOptions) {
    preprocessOptions = Object.assign({}, preprocessOptions)
    const env = this.env
    const constants = Object.assign({}, defaultBuildConfig)
    const envKeys = Object.keys(env)
    const optionsKeys = Object.keys(preprocessOptions)
    //
    return Object.keys(constants).reduce((defined, item) => {
      const def = constants[item]
      const type = typeof def
      let val = undefined
      for (const key of envKeys) {
        if (key.toUpperCase() === item) {
          val = env[key]
          break
        }
      }
      //
      for (const key of optionsKeys) {
        if (
          item
            .toLowerCase()
            .replace(/^BUILD_/i, '')
            .replace(/_(.)/g, (t, m) => m.toUpperCase()) === key
        ) {
          val = preprocessOptions[key]
          break
        }
      }
      //
      if (typeof val !== type) {
        defined[item] = def
      } else if (typeof val === 'string' && !(val = val.trim())) {
        defined[item] = def
      } else {
        defined[item] = val
      }
      return defined
    }, {})
  }

  getFilter(filter) {
    if (typeof filter === 'string') {
      filter = filter.trim()
    } else {
      filter = ''
    }
    if (filter.startsWith('/') && filter.endsWith('/')) {
      filter = filter.substring(1, filter.length - 1)
      if (filter) {
        return new RegExp(filter.replace(/[*.?+$^[\](){}|\\]/g, '\\$&'))
      }
    }
    if (filter) {
      filter = filter
        .toLowerCase()
        .split(',')
        .map((s) => s.trim())
        .filter((s) => !!s)
      //
      if (!filter.length) {
        filter = ''
      }
    }
    return filter
  }

  // 获取入口模块路径
  getEntryModules(entry, filter) {
    const modules = {}
    const entryPattern = typeof entry === 'string' ? entry.split(',') : []
    const targets = this.getFilter(filter)
    // 获取构建入口
    entryPattern.forEach((pattern) => {
      pattern = pattern.trim()
      if (pattern) {
        // 匹配路径模式
        fileUtil.matchFileSync(pattern).forEach((file) => {
          const dirName = fileUtil.getShortDirName(file).toLowerCase()
          if (targets) {
            if (targets instanceof RegExp) {
              // 正则过滤
              if (!targets.test(dirName)) {
                return
              }
            } else if (targets.indexOf(dirName) === -1) {
              // 枚举过滤
              return
            }
          }
          modules[file] = file
        })
      }
    })
    return Object.keys(modules)
  }

  //
  toEntryPoints() {
    const entryPages = {}
    //
    const { BUILD_MPA } = this.config
    //
    const { legacyModules, componentModules, rootApp } = this.getBuildModules()
    //
    if (componentModules.length || !legacyModules.length) {
      if (BUILD_MPA) {
        if (componentModules.length) {
          this.buildMPAEntry(componentModules, entryPages)
        }
      } else {
        this.buildSPAEntry(componentModules, entryPages)
        entryPages.index.module = rootApp
      }
      // 监听文件变化，重新生成entry
      this.watch(entryPages)
    }
    if (legacyModules.length) {
      this.buildLegacyEntry(legacyModules, entryPages)
    }
    //
    return this.formatEntries(entryPages)
  }

  // 获取构建模块
  getBuildModules() {
    const {
      BUILD_MODULE_ENTRY,
      BUILD_MODULE_FILTER,
      BUILD_ROOT_APP_PATH,
    } = this.config
    const { pluginOptions } = this.options

    const { preprocess } = Object.assign({}, pluginOptions)

    const rootApp = fileUtil.isAbsolute(BUILD_ROOT_APP_PATH)
      ? BUILD_ROOT_APP_PATH
      : fileUtil.resolvePath(BUILD_ROOT_APP_PATH)

    // 入口模块
    const modules = this.getEntryModules(BUILD_MODULE_ENTRY, BUILD_MODULE_FILTER)
    // 普通入口模块
    const legacyModules = []
    // 组件入口模块
    const componentModules = []
    modules.forEach((module) => {
      module = fileUtil.isAbsolute(module) ? module : fileUtil.resolvePath(module)
      if (!preprocess || module === rootApp || !module.endsWith('.vue')) {
        legacyModules.push(module)
      } else {
        componentModules.push(module)
      }
    })
    return { legacyModules, componentModules, rootApp, preprocess }
  }

  //
  watch(entryPoints) {
    if (process.env.NODE_ENV !== 'development') {
      return
    }
    this.setWatchedEntryPoints(entryPoints)
    //
    if (this.watcher) {
      return
    }
    const { BUILD_MODULE_ROUTER_NAME, BUILD_MODULE_STORE_NAME } = this.config
    const routerName = BUILD_MODULE_ROUTER_NAME.replace(/^\/+/g, '')
    const storeName = BUILD_MODULE_STORE_NAME.replace(/^\/+/g, '')
    //
    const handler = (file) => {
      debug('file has been changed: %s', file)
      this.toEntryPoints()
      emitter.emit('watch-resolved')
    }
    //
    this.watcher = commonUtil.watch(
      // 监听文件的变化
      `**/@(*.vue|${routerName}|${storeName})`,
      {
        add: handler,
        unlink: handler,
      },
      {
        cwd: fileUtil.resolvePath('src'),
        delay: 100,
      }
    )
  }

  formatEntries(entries) {
    // 格式化
    const entryPoints = []
    const pages = {}
    Object.keys(entries).forEach((key) => {
      const {
        entry,
        template,
        filename,
        legacy,
        spa,
        module,
        moduleName,
      } = entries[key]
      //
      pages[key] = {
        entry,
        template,
        filename,
      }
      //
      entryPoints.push({
        entry,
        filename,
        module,
        moduleName,
        legacy,
        spa,
      })
    })
    //
    if (!entryPoints.length) {
      // 没有入口文件，则退出
      logger.error('\nMust include at least one entry.\n')
      process.exit(1)
    }
    // 修改名称
    this.modifyEntryName(pages, entryPoints)
    this.convertToAbsPath(pages, entryPoints)
    // 注册环境变量
    this.env.registerVariables('BUILD_ENTRY_POINTS', entryPoints)
    //
    return pages
  }

  //
  setWatchedEntryPoints(pages) {
    const { config, entries: prevEntries } = this
    const { BUILD_MPA } = config
    const currEntries = Object.keys(pages).map((key) => pages[key].entry)
    this.entries = currEntries
    if (prevEntries && commonUtil.difference(prevEntries, currEntries).length) {
      if (BUILD_MPA) {
        const deleted = prevEntries.filter((entry) => !currEntries.includes(entry))
        for (const entry of deleted) {
          try {
            fileUtil.removeSync(entry)
          } catch (e) {
            debug(e.message)
          }
        }
        // 移除 HTML webpack 插件
        // const added = currEntries.filter((entry) => !prevEntries.includes(entry))
        // 添加 HTML webpack 插件
        // 触发更新
        // emitter.emit('invalidate')
        emitter.emit('restart', 'entries has been changed')
      }
    }
  }

  buildLegacyEntry(modules, entryPages) {
    const { options, config } = this
    const { indexPath } = options
    const { BUILD_HTML_TEMPLATE } = config
    const length = modules.length
    //
    modules.forEach((module) => {
      //
      const moduleName =
        length === 1 ? 'index' : fileUtil.getShortDirName(module).replace(/\W/g, '')
      const fileName =
        length === 1 ? indexPath || 'index.html' : `${moduleName}.html`
      //
      const entry = fileUtil.isAbsolute(module)
        ? module
        : fileUtil.resolvePath(module)
      //
      entryPages[moduleName.toLowerCase()] = {
        entry,
        moduleName,
        module: entry,
        template: BUILD_HTML_TEMPLATE,
        filename: fileName,
        legacy: true,
      }
    })
  }

  //
  buildMPAEntry(modules, entryPages) {
    const { config } = this
    const { BUILD_HTML_TEMPLATE } = config
    //
    const entryPoints = generate({
      context: process.cwd(),
      type: 'mpa',
      modules,
      config,
    })
    //
    for (const point of entryPoints) {
      const { entry, module, moduleName } = point
      entryPages[moduleName.toLowerCase()] = {
        entry,
        module,
        moduleName,
        template: BUILD_HTML_TEMPLATE,
        filename: `${moduleName}.html`,
      }
    }
  }

  //
  buildSPAEntry(modules, entryPages) {
    const { config, options } = this
    const { BUILD_HTML_TEMPLATE } = config
    const { indexPath } = options
    //
    const entryPoints = generate({
      context: process.cwd(),
      type: 'spa',
      modules,
      config,
    })
    //
    entryPages.index = {
      entry: entryPoints[0].entry,
      moduleName: 'index',
      template: BUILD_HTML_TEMPLATE,
      filename: indexPath || 'index.html',
      spa: true,
    }
  }

  // 映射页面资源名称
  modifyEntryName(pages, points) {
    const { pluginOptions } = this.options
    const { pageNameMap } = Object.assign({}, pluginOptions)
    // 映射名称
    if (pageNameMap) {
      const existNames = Object.keys(pages).reduce((names, page) => {
        names[page] = true
        return names
      }, {})
      const hasOwnProperty = Object.prototype.hasOwnProperty
      Object.keys(pageNameMap).forEach((name) => {
        const page = pages[name]
        if (page) {
          const targetName = pageNameMap[name]
          if (!hasOwnProperty.call(existNames, targetName)) {
            const entry = points.find((point) => point.filename === page.filename)
            page.filename = `${targetName}.html`
            if (entry) {
              entry.filename = page.filename
            }
            existNames[targetName] = true
            delete existNames[name]
          } else {
            logger.error(
              `\n[pluginOptions.pageNameMap] The file name of '${targetName}' already exists. (${name} => ${targetName})\n`
            )
          }
        }
      })
    }
  }

  // 转换为绝对路径
  convertToAbsPath(pages, points) {
    const { outputDir, indexPath } = this.options
    let dirName = ''
    if (typeof indexPath === 'string' && indexPath.trim()) {
      dirName = fileUtil.getDirName(indexPath, outputDir)
    } else if (!fileUtil.isAbsolute(outputDir)) {
      dirName = fileUtil.resolvePath(outputDir)
    } else {
      dirName = outputDir
    }
    if (dirName) {
      const { BUILD_USE_HYPHEN_NAME } = this.config
      Object.keys(pages).forEach((name) => {
        const page = pages[name]
        let pageName = page.filename
        if (BUILD_USE_HYPHEN_NAME) {
          const hyphenName = pageName.replace(/[A-Z]+/g, (t, index) =>
            (!index ? t : `-${t}`).toLowerCase()
          )
          //
          if (hyphenName !== pageName) {
            const entry = points.find((point) => point.filename === pageName)
            if (entry) {
              entry.filename = hyphenName
            }
            pageName = hyphenName
          }
        }
        page.filename = fileUtil.joinPath(dirName, pageName)
      })
    }
  }

  destroy() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }
}

let manager = null

module.exports = (options) => {
  if (manager) {
    manager.destroy()
  }
  manager = new EntryManager(options)
  return manager
}
