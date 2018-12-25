const fs = require('fs')
const chokidar = require('chokidar')
const pathToRegexp = require('path-to-regexp')
const bodyParser = require('body-parser')

const registerBabel = require('../babel/registerBabel')

//
const fileUtil = require('../../utils/file')
const console = require('../../utils/console')

const VALID_METHODS = ['get', 'post', 'put', 'patch', 'delete']
const BODY_PARSED_METHODS = ['post', 'put', 'patch']

// express api mock 中间件
class MockMiddleware {
  constructor(options) {
    if (typeof options !== 'object') {
      options = { path: typeof options !== 'string' ? '' : options }
    }
    this.options = Object.assign(
      {
        path: 'mock',
        delay: 0,
      },
      options
    )
    this.mockFiles = []
    this.mockModules = []
    this.watchFile(this.loadMockModules())
  }

  // 应用中间件
  apply(req, res, next) {
    const match = this.matchMock(req)
    if (match) {
      console.raw.log(`Mock matched: [${match.method}] ${match.path}`)
      return match.handler(req, res, next)
    } else {
      return next()
    }
  }

  //
  registerBabel() {
    if (!this.babelRegistered) {
      const extraFiles = ['@babel/runtime']
      registerBabel({
        ignore: [
          (filePath) => {
            if (filePath.indexOf('node_modules') !== -1) {
              return !extraFiles.some((file) => filePath.indexOf(file) !== -1)
            }
            return !this.mockFiles.includes(filePath)
          },
        ],
      })
      //
      this.babelRegistered = true
    }
  }

  // 加载mock数据
  loadMockModules() {
    const { path: mockConfigPath, delay: globalDelay } = this.options
    const { files: mockFiles, pattern } = this.getMockFiles(mockConfigPath)
    const delaySetup = {}
    this.mockFiles = mockFiles
    this.registerBabel()
    this.clearRequireCache(mockFiles)
    let hasErrors = false
    const modules = mockFiles.reduce((memo, mockFile) => {
      try {
        const module = require(mockFile)
        const delay = module.delay
        Object.keys(module.default || module).forEach((key) => {
          delaySetup[key] = isNaN(delay) ? globalDelay : delay
        })
        memo = Object.assign({}, memo, module.default || module)
      } catch (e) {
        hasErrors = true
        console.error(`Mock file parse failed [${mockFile}]`, true)
        console.raw.error(e)
      }
      return memo
    }, {})
    if (!hasErrors) {
      console.log('Mock file parse success.')
    }
    this.mockModules = this.normalizeModules(modules, delaySetup)
    // 用于监听文件变更
    return pattern
  }

  // 获取mock模块文件
  getMockFiles(mockPath) {
    const defaultMockPath = 'mock'
    if (typeof mockPath !== 'string') {
      mockPath = ''
    }
    mockPath = mockPath.trim() || defaultMockPath
    if (fileUtil.isGlob(mockPath)) {
      return {
        files: fileUtil
          .matchFileSync(mockPath, { nodir: true })
          .map((file) => fileUtil.resolvePath(file)),
        pattern: mockPath,
      }
    }
    const absMockPath = fileUtil.resolvePath(mockPath)
    let files = []
    if (fs.existsSync(absMockPath) && fs.statSync(absMockPath).isDirectory()) {
      console.log(`Load mock data from ${absMockPath} `)
      files = fileUtil
        .matchFileSync('**/*.js', {
          cwd: absMockPath,
          nodir: true,
        })
        .map((file) => fileUtil.joinPath(absMockPath, file))
    }
    return {
      files: files,
      pattern: `${mockPath.replace(/[\\]/g, '/').replace(/\/+$/g, '')}/**/*.js`,
    }
  }

  //
  normalizeModules(modules, delaySetup) {
    return Object.keys(modules).reduce((list, key) => {
      const handler = modules[key]
      const type = typeof handler
      if (type !== 'function' && type !== 'object') {
        console.error(
          `Mock value of "${key}" should be function or object, but got ${type}`,
          true
        )
      }
      const { method, path } = this.parseKey(key)
      const keys = []
      const re = pathToRegexp(path, keys)
      let delay = delaySetup[key]
      delay = isNaN(delay) ? 0 : Math.max(+delay, 0)
      list.push({
        handler: this.createHandler({ method, path, handler, delay }),
        delay,
        method,
        path,
        re,
        keys,
      })
      return list
    }, [])
  }

  //
  createHandler({ method, path, handler, delay }) {
    return (req, res, next) => {
      const sendData = () => {
        if (typeof handler === 'function') {
          handler(req, res, next)
        } else {
          res.json(handler)
        }
      }
      const action = () => {
        if (delay) {
          setTimeout(sendData, delay)
        } else {
          sendData()
        }
      }
      if (BODY_PARSED_METHODS.includes(method)) {
        bodyParser.json({ limit: '5mb', strict: false })(req, res, () => {
          bodyParser.urlencoded({ limit: '5mb', extended: true })(
            req,
            res,
            action
          )
        })
      } else {
        action()
      }
    }
  }

  parseKey(key) {
    let method = 'get'
    let path = key
    if (key.indexOf(' ') > -1) {
      const split = key.split(' ')
      method = split[0].toLowerCase()
      path = split[1]
    }
    if (!VALID_METHODS.includes(method)) {
      console.error(
        `Invalid method ${method} for path ${path}, please check your mock files.`,
        true
      )
    }
    return {
      method,
      path,
    }
  }

  // 清空模块缓存
  clearRequireCache(files) {
    // 清空node require的缓存内容
    Object.keys(require.cache).forEach((path) => {
      if (files.includes(path)) {
        delete require.cache[path]
      }
    })
  }

  // 监听文件变化，重新加载数据
  watchFile(pattern) {
    if (process.env.WATCH_FILES === 'none') {
      return
    }
    const watcher = chokidar.watch(pattern, {
      ignoreInitial: true,
    })
    watcher.on('all', (event, file) => {
      console.log(`[${event}] ${file}, reload mock data.`)
      // 重新加载模块
      this.loadMockModules()
    })
  }

  // 匹配Mock请求
  matchMock(req) {
    const { path: exceptPath } = req
    const exceptMethod = req.method.toLowerCase()
    const hasOwnProperty = Object.prototype.hasOwnProperty
    const mockModules = this.mockModules

    for (const mock of mockModules) {
      const { method, re, keys } = mock
      if (method === exceptMethod) {
        const match = re.exec(req.path)
        if (match) {
          const params = {}
          for (let i = 1; i < match.length; i = i + 1) {
            const key = keys[i - 1]
            const prop = key.name
            const val = this.decodeURLParam(match[i])
            if (val !== undefined || !hasOwnProperty.call(params, prop)) {
              params[prop] = val
            }
          }
          req.params = params
          return mock
        }
      }
    }

    return mockModules.filter(({ method, re }) => {
      return method === exceptMethod && re.test(exceptPath)
    })[0]
  }

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
  }
}

//
module.exports = (options) => {
  const middleware = new MockMiddleware(Object.assign({}, options))
  return (req, res, next) => {
    middleware.apply(req, res, next)
  }
}
