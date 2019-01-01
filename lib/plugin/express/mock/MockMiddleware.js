const fs = require('fs')
const bodyParser = require('body-parser')
const lodash = require('lodash')
const onFinished = require('on-finished')
const chalk = require('chalk')

//
const helper = require('./helper')
const rawBodyMiddleware = require('../rawBodyMiddleware')
//
const console = require('../../../utils/console')
const getEnv = require('../../../utils/env')
const fileUtil = require('../../../utils/file')
const applyMiddleware = require('../../../utils/middleware').apply

//
const MockManager = require('./ModuleManager')
const MockConverter = require('./MockConverter')
const ModuleMaker = require('./ModuleMaker')

const BODY_PARSED_METHODS = ['post', 'put', 'patch']

//
const defaultOptions = {
  path: 'mock',
  // 全局延时
  delay: 0,
  // 生成代码中的默认延时
  defaultDelay: 0,
  // 按路径自动初始化创建接口mock模块
  init: true,
  // 自动定位接口位置
  locate: true,
  // 生成代码中的默认定位代码设置
  defaultLocate: true,
  // 生成代码中默认禁用掉mock
  defaultDisabled: false,
  // 数据文件
  data: {
    // 输入
    input: 'mock.data.json',
    // 输出
    output: 'mock.output.js',
  },
}

/**
 * mock中间件
 * @type {module.MockMiddleware}
 */
module.exports = class MockMiddleware {
  //
  constructor(options) {
    if (typeof options !== 'object') {
      options = { path: typeof options !== 'string' ? '' : options }
    }
    this.options = Object.assign(lodash.cloneDeep(defaultOptions), options)
    //
    this.pluginName = getEnv().PLUGIN_NAME
    this.createdApi = {}
    //
    try {
      this.initBuiltInFiles()
      this.initConverter()
      this.initManager()
      this.initMaker()
    } catch (e) {
      console.error(e.message, true)
    }
  }

  // 创建内建文件
  initBuiltInFiles() {
    const { path: mockPath } = this.options
    const absMockPath = helper.makeAbsModulesPath(mockPath)
    if (absMockPath) {
      const mockjs = fileUtil.joinPath(absMockPath, 'mock.js')
      if (!fs.existsSync(mockjs)) {
        // 拷贝示例文件
        fileUtil.copySingleFileSync(
          fileUtil.joinPath(__dirname, 'template', 'mock.js'),
          fileUtil.joinPath(absMockPath, 'mock.js')
        )
        console.log(`Generated for mock. [${mockjs}]`)
      }
    }
  }

  // 初始化mock数据转换器
  initConverter() {
    const options = this.options
    const { data } = options
    const { input: dataFile, output: tplFile } = Object.assign(
      {},
      defaultOptions.data,
      data
    )
    if (!dataFile || !tplFile) {
      return null
    }
    options.data = { input: dataFile, output: tplFile }
    //
    this.converter = new MockConverter(Object.assign({}, options))
  }

  // 初始化mock模块管理器
  initManager() {
    const options = this.options
    //
    this.manager = new MockManager(
      //
      Object.assign({}, options, {
        exclude: (file) => {
          if (this.converter) {
            let { data, path: mockPath } = this.options
            let { input, output } = data
            if (!fileUtil.isAbsolute(file)) {
              file = fileUtil.resolvePath(file)
            }
            mockPath = helper.getRelMockPath(mockPath)
            input = fileUtil.isAbsolute(input)
              ? input
              : fileUtil.resolvePath(mockPath, input)
            output = fileUtil.isAbsolute(output)
              ? output
              : fileUtil.resolvePath(mockPath, output)
            return file === input || file === output
          }
          return false
        },
      })
      //
    )
  }

  // 初始化模块生成器
  initMaker() {
    const options = this.options
    this.maker = new ModuleMaker(
      Object.assign({}, options, {
        convert: (data) => this.converter.convertToMockJS(data),
      })
    )
  }

  // 应用中间件
  apply(req, res, next) {
    if (!req.xhr) {
      // 不处理非ajax请求
      return next()
    }
    const mock = this.matchMock(req)
    if (mock) {
      // 匹配
      const { method, path, delay, disabled } = mock
      if (disabled) {
        const location = this.maker.getMockLocation(mock)
        console.raw.log(
          `Mock ${chalk.gray('disabled')}: [${method}] ${chalk.cyan(path)} ${
            location ? `[${location}]` : ''
          }`
        )
        // 下一个中间件
        next()
      } else {
        if (delay) {
          setTimeout(() => {
            this.handleMock(mock, { req, res, next })
          }, delay)
        } else {
          this.handleMock(mock, { req, res, next })
        }
      }
    } else {
      // 未匹配
      const { method, path } = req
      const api = `${method} ${path}`
      if (!this.createdApi[api]) {
        this.createdApi[api] = true
        // 完成代理请求后，根据远程服务器返回到数据创建mock模块
        onFinished(res, () => {
          this.maker.makeMockModule({
            method,
            path,
            data: res.rawBody,
          })
        })
      }
      //
      next()
    }
  }

  // 根据请求对象匹配模块
  matchMock(req) {
    const { path: exceptPath } = req
    const exceptMethod = req.method.toLowerCase()

    const mockModules = this.manager.getMockModules()
    //
    for (const module of mockModules) {
      const result = module.match(exceptMethod, exceptPath)
      if (result) {
        this.parseDynamicParams(req, result)
        return result.mock
      }
    }
  }

  // 解析动态参数
  parseDynamicParams(req, { match, mock }) {
    const params = {}
    const { keys } = mock
    const hasOwnProperty = Object.prototype.hasOwnProperty
    for (let i = 1; i < match.length; i++) {
      const prop = keys[i - 1].name
      const val = helper.decodeURLParam(match[i])
      if (val !== undefined || !hasOwnProperty.call(params, prop)) {
        params[prop] = val
      }
    }
    req.params = params
  }

  // 处理mock
  handleMock(mock, { req, res, next }) {
    let { method, path, handler } = mock
    const location = this.maker.getMockLocation(mock)
    console.raw.log(
      `Mock ${chalk.cyan('matched')}: [${method}] ${chalk.cyan(path)} ${
        location ? `[${location}]` : ''
      }`
    )
    if (!onFinished.isFinished(res)) {
      if (!handler) {
        handler = mock.handler = this.createHandler(mock)
      }
      // 执行本地mock处理程序
      handler(req, res, next)
    }
  }

  // 创建mock处理程序
  createHandler({ data, method }) {
    const limit = '5mb'
    //
    const middleware = BODY_PARSED_METHODS.includes(method)
      ? [
          // 保证远程代理能获取到原始请求的内容
          rawBodyMiddleware(),
          // 二进制流
          bodyParser.raw({
            limit,
          }),
          // json格式
          bodyParser.json({
            limit,
            strict: false,
          }),
          // 表单格式
          bodyParser.urlencoded({
            limit,
            extended: true,
          }),
        ]
      : []
    //
    middleware.push(this.handleMockData(data))
    //
    return (req, res, next) => {
      // 对当前请求应用中间件
      applyMiddleware(middleware, req, res, next)
    }
  }

  // 处理mock数据内容
  handleMockData(data) {
    return (req, res, next) => {
      //
      const doNext = (err) => {
        if (!next || onFinished.isFinished(res)) {
          return
        }
        next(err)
        // 防止重复被调用
        next = null
      }
      // 发送数据
      const sendJSON = (data) => {
        if (next) {
          if (data !== undefined && !onFinished.isFinished(res)) {
            res.setHeader('X-Mocked-By', this.pluginName)
            res.json(data)
          } else {
            // 使用代理服务器处理
            doNext()
          }
        }
      }
      if (typeof data === 'function') {
        const mockRes = data(req, res, doNext)
        if (mockRes instanceof Promise) {
          mockRes.then(sendJSON).catch(doNext)
        } else if (mockRes !== undefined) {
          sendJSON(mockRes)
        } else {
          doNext()
        }
      } else {
        sendJSON(data)
      }
    }
  }

  //
}
