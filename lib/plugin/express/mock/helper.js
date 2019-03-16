const fs = require('fs')
//
const chalk = require('chalk')
//
const logger = require('../../../utils/logger')
const fileUtil = require('../../../utils/file')
//
const VALID_METHODS = ['get', 'post', 'put', 'patch', 'delete']
//

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
      logger.error(
        `\nInvalid method ${method} for path ${chalk.cyan(
          path
        )}, please check your mock files.\n`
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

  // 解析动态参数
  parseDynamicParams(match, keys) {
    const params = {}
    const hasOwnProperty = Object.prototype.hasOwnProperty
    for (let i = 1; i < match.length; i++) {
      const prop = keys[i - 1].name
      const val = helper.decodeURLParam(match[i])
      if (val !== undefined || !hasOwnProperty.call(params, prop)) {
        params[prop] = val
      }
    }
    return params
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
    if (typeof mockPath !== 'string') {
      mockPath = ''
    }
    return mockPath.trim() || 'mock'
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
          logger.error(e.message)
        }
      } else if (!fs.statSync(absMockPath).isDirectory()) {
        absMockPath = ''
        logger.error('\nThe path for mock module is not a directory.\n')
      }
    }
    return absMockPath
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

  // 是否是websocket握手请求
  isWebSocketHandshake(req) {
    const { method, headers } = req
    const { upgrade, connection } = Object.assign({}, headers)
    if (method !== 'GET' || !upgrade || !connection) {
      return false
    }
    return upgrade.toLowerCase() === 'websocket' && connection.toLowerCase() === 'upgrade'
  },

  //
  getDataBody(data) {
    let binaryBody
    let body
    let contentType = ''
    let contentLength = 0
    if (data instanceof ArrayBuffer) {
      binaryBody = data
      contentType = 'application/octet-stream'
    } else if (typeof data !== 'string') {
      try {
        body = JSON.stringify(data)
        contentType = 'application/json'
      } catch (e) {
        body = `${data}`
        contentType = 'text/plain'
        debug('error occurred while stringify data. %s', e.message)
      }
    } else {
      try {
        contentType =
          typeof JSON.parse(data) === 'object' ? 'application/json' : 'text/plain'
      } catch (e) {
        contentType = 'text/plain'
      } finally {
        body = data
      }
    }
    if (binaryBody) {
      contentLength = binaryBody.byteLength
    } else if (body) {
      contentLength = new TextEncoder().encode(body).length
    } else {
      contentLength = 0
    }
    return {
      body,
      binaryBody,
      contentType,
      contentLength,
    }
  },
}

//
module.exports = helper
