const fs = require('fs')
//
const lodash = require('lodash')
const chokidar = require('chokidar')
const prettier = require('prettier')
const chalk = require('chalk')
//
const console = require('../../../utils/console')
const fileUtil = require('../../../utils/file')
//
const VALID_METHODS = ['get', 'post', 'put', 'patch', 'delete']
//
let prettierOptions = null

// 工具方法
const helper = {
  //
  parseApiPath(key) {
    let method = 'get'
    let path = key.trim()
    const matcher = /(\w+)\s+(.*)/.exec(key)
    if (matcher) {
      method = matcher[1].toLowerCase()
      path = matcher[2]
    }
    if (!VALID_METHODS.includes(method)) {
      console.error(
        `Invalid method ${method} for path ${chalk.cyan(
          path
        )}, please check your mock files.`,
        true
      )
    }
    return {
      method,
      path,
    }
  },

  // 参数解码
  decodeURLParam(val) {
    if (typeof val !== 'string' || val.length === 0) {
      return val
    }
    try {
      return decodeURIComponent(val)
    } catch (err) {
      if (err instanceof URIError) {
        err.message = `Failed to decode param ' ${val} '`
        err.status = err.statusCode = 400
      }
      throw err
    }
  },

  // 获取默认的模块导出内容
  getModuleDefaultExport(module) {
    if (module.default !== undefined) {
      return module.default
    }
    return module
  },

  // 获取相对输出路径
  getRelMockPath(mockPath) {
    const defaultMockPath = 'mock'
    mockPath = mockPath || path
    if (typeof mockPath !== 'string') {
      mockPath = ''
    }
    return mockPath.trim() || defaultMockPath
  },

  // 创建绝对mock输出路径
  makeAbsModulesPath(mockPath) {
    let absMockPath = ''
    mockPath = helper.getRelMockPath(mockPath)
    if (!fileUtil.isGlob(mockPath)) {
      absMockPath = fileUtil.isAbsolute(mockPath)
        ? mockPath
        : fileUtil.resolvePath(mockPath)
      if (!fs.existsSync(absMockPath)) {
        try {
          fileUtil.mkdir(absMockPath)
        } catch (e) {
          absMockPath = ''
          console.error(e.message, true)
        }
      } else if (!fs.statSync(absMockPath).isDirectory()) {
        absMockPath = ''
        console.error('The path for mock module is not a directory', true)
      }
    }
    return absMockPath
  },

  // 监听文件变化
  watch(pattern, callback) {
    chokidar
      .watch(pattern, {
        ignoreInitial: true,
      })
      .on(
        'all',
        lodash.debounce(callback, 500, {
          trailing: true,
        })
      )
  },

  // 格式化代码
  formatCode(code, options, callback) {
    helper.resolvePrettierConfigFile((config) => {
      code = prettier.format(code, Object.assign({}, config, options))
      if (typeof callback === 'function') {
        callback(code)
      }
    })
    return code
  },

  // 解析prettier配置文件
  resolvePrettierConfigFile(callback) {
    if (prettierOptions) {
      callback(prettierOptions)
    } else {
      const rc = `.prettierrc`
      let configPath = fileUtil.resolvePath(rc)
      if (!fs.existsSync(configPath)) {
        configPath = fileUtil.resolvePath(`${rc}.js`)
        if (!fs.existsSync(configPath)) {
          configPath = ''
        }
      }
      let options = null
      if (configPath) {
        try {
          options = prettier.resolveConfig.sync(configPath)
        } catch (e) {}
      }
      prettierOptions = Object.assign(
        {
          parser: 'babylon',
        },
        options
      )
      callback(prettierOptions)
    }
  },

  // 过滤路径参数
  filterDynamicPathParams(requestPath) {
    let count = -1
    // 非严格匹配uuid并生成restful风格接口
    return requestPath.replace(
      /\/[^/]*?(([\da-z]{8})(-)?([\da-z]{4})\3([\da-z]{4})\3([\da-z]{4})\3([\da-z]{12}))[^/]*/gi,
      () => `/:uuid${++count || ''}`
    )
  },
  //

  // 清空模块缓存
  clearRequireCache(files) {
    // 清空node require的缓存内容
    Object.keys(require.cache).forEach((path) => {
      if (files.includes(path)) {
        delete require.cache[path]
      }
    })
  },
}

//
module.exports = helper
