const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const chokidar = require('chokidar')
const pathToRegexp = require('path-to-regexp')
const bodyParser = require('body-parser')
const babylon = require('babylon')
const traverse = require('@babel/traverse')
const babelTypes = require('@babel/types')
const generator = require('@babel/generator')
const prettier = require('prettier')
const lodash = require('lodash')

const registerBabel = require('../babel/registerBabel')

//
const fileUtil = require('../../utils/file')
const console = require('../../utils/console')

const VALID_METHODS = ['get', 'post', 'put', 'patch', 'delete']
const BODY_PARSED_METHODS = ['post', 'put', 'patch']

// express api mock 中间件

class MockMiddleware extends EventEmitter {
  constructor(options) {
    super()
    if (typeof options !== 'object') {
      options = { path: typeof options !== 'string' ? '' : options }
    }
    this.options = Object.assign(
      {
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
      },
      options
    )
    this.mockFiles = []
    this.mockModules = []
    this.updating = false
    this.createdApi = {}
    this.waitingModule = {}
    this.initModuleState = 0
    try {
      this.init()
    } catch (e) {
      console.error(e.message, true)
    }
  }

  // 初始化
  init() {
    this.initMockDemo()
    const { path: mockPath } = this.options
    const { files, pattern } = this.getMockFiles(mockPath)
    this.loadMockModules(files)
    this.watchFile(pattern)
  }

  // 创建示例文件
  initMockDemo() {
    const { path: mockPath } = this.options
    const absMockPath = this.makeModulesPath(mockPath)
    if (absMockPath) {
      const mockjs = fileUtil.joinPath(absMockPath, 'mock.js')
      if (!fs.existsSync(mockjs)) {
        fs.writeFileSync(mockjs, this.getDemoTemplateCode(), {
          encoding: 'utf8',
        })
        console.log(`Generated demo module file. [${mockjs}]`)
      }
    }
  }

  // 应用中间件
  apply(req, res, next) {
    const match = this.matchMock(req)
    if (match) {
      const {
        method,
        path,
        delay,
        disabled,
        locate,
        handler,
        module,
        loc,
      } = match
      if (disabled) {
        console.raw.log(`Mock disabled: [${method}] ${path}`)
        next()
      } else {
        const action = () => {
          const location = locate
            ? loc ||
              this.getAPILocation(module, {
                method: req.method,
                path: req.path,
              })
            : ''
          match.loc = location
          console.raw.log(
            `Mock matched: [${method}] ${path} ${
              location ? `\n[${location}]` : ''
            }`
          )
          handler(req, res, next)
        }
        if (delay) {
          setTimeout(action, delay)
        } else {
          action()
        }
      }
    } else {
      if (req.xhr) {
        const requestMethod = req.method
        const requestPath = req.path
        const api = `${requestMethod} ${requestPath}`
        if (!this.createdApi[api]) {
          this.createdApi[api] = {
            method: requestMethod,
            path: requestPath,
          }
          res.once('finish', () => {
            this.generateMockModule({
              method: requestMethod,
              path: requestPath,
            })
          })
        }
      }
      next()
    }
  }

  // 获取API在代码中的位置
  getAPILocation(module, { method, path: requestPath }) {
    let location = ''
    try {
      if (fs.existsSync(module)) {
        const code = fs.readFileSync(module).toString('utf8')
        if (code) {
          this.findDefaultExportObjectDeclaration(code, (declaration) => {
            if (!declaration) {
              return
            }
            const properties = declaration.properties
            for (const prop of properties) {
              if (babelTypes.isStringLiteral(prop.key)) {
                const matcher = /(\w+)\s+(.*)/.exec(prop.key.value)
                if (
                  matcher &&
                  matcher[2] === requestPath &&
                  matcher[1].toLowerCase() === method.toLowerCase()
                ) {
                  const loc = prop.key.loc
                  const start = loc ? loc.start : null
                  if (start) {
                    const { line, column } = start
                    location = `${module}:${line}:${column}`
                  }
                  break
                }
              }
            }
          })
        }
      }
    } catch (e) {
      console.error(e.message, true)
    }
    return location
  }

  // 过滤路径参数
  filterDynamicPathParams(requestPath) {
    let count = -1
    // 非严格匹配uuid并生成restful风格接口
    return requestPath.replace(
      /\/[^/]*?(([\da-z]{8})(-)?([\da-z]{4})\3([\da-z]{4})\3([\da-z]{4})\3([\da-z]{12}))[^/]*/g,
      () => `/:uuid${++count || ''}`
    )
  }

  // 生成mock模块文件
  generateMockModule({ method, path: requestPath }) {
    try {
      const { init, path: mockPath } = this.options
      if (!init || fileUtil.isGlob(mockPath)) {
        return
      }
      const rootDir = this.makeModulesPath(mockPath)
      if (rootDir) {
        // 处理restful动态参数
        requestPath = this.filterDynamicPathParams(requestPath)
        const modulePath = fileUtil.joinPath(
          rootDir,
          requestPath
            .replace(/:.*/g, '')
            .replace(/\/+[^\/]*$|^\/+/g, '')
            .replace(/\s+/g, '-')
        )
        let moduleDir =
          modulePath === rootDir ? rootDir : fileUtil.getDirName(modulePath)
        if (!fs.existsSync(moduleDir)) {
          try {
            fileUtil.mkdir(moduleDir)
          } catch (e) {
            console.error(e.message, true)
            moduleDir = ''
          }
        }
        if (moduleDir) {
          const module = `${
            modulePath === rootDir ? `${rootDir}/root` : modulePath
          }.js`
          const dirName = fileUtil.getDirName(module)
          const fileName = fileUtil.getFileBaseName(module)
          this.createModule(`${dirName}/${lodash.lowerFirst(fileName)}`, {
            method,
            path: requestPath,
          })
        }
      }
    } catch (e) {
      console.error(e.message, true)
    }
  }

  // 创建模块文件
  createModule(modulePath, { method, path: requestPath }) {
    const { waitingModule } = this
    if (waitingModule[modulePath]) {
      // 等待模块创建完成
      return this.once('created', () => {
        this.createModule(modulePath, { method, path: requestPath })
      })
    }
    // 加入等待创建中
    waitingModule[modulePath] = { method, path: requestPath }
    const encoding = 'utf8'
    const property = `${method} ${requestPath}`
    let code = ''
    if (fs.existsSync(modulePath)) {
      code = fs.readFileSync(modulePath).toString(encoding)
    }
    if (code) {
      // 已有代码文件中插入API
      code = this.injectAPICodeTo(code, property)
    } else {
      code = this.getTemplateCode(property)
    }
    // 获取代码格式化配置
    this.resolvePrettierConfigFile((options) => {
      // 写入代码文件
      fs.writeFile(
        modulePath,
        prettier.format(code, options),
        { encoding },
        (error) => {
          if (error) {
            console.error(error.message, true)
          } else {
            console.log(
              `Generated API: ${method} ${requestPath} \n[${modulePath}]`
            )
            this.createdApi[property] = modulePath
            delete waitingModule[modulePath]
            this.emit('created', modulePath)
          }
        }
      )
    })
  }

  // 注入API代码
  injectAPICodeTo(code, propertyName) {
    // 查找默认导出对象
    this.findDefaultExportObjectDeclaration(code, (declaration, path, ast) => {
      if (!declaration) {
        return
      }
      // 修改导出属性
      const properties = declaration.properties
      for (const prop of properties) {
        if (babelTypes.isStringLiteral(prop.key)) {
          if (`${prop.value}`.trim() === propertyName) {
            return code
          }
        }
      }
      properties.push(
        babelTypes.objectProperty(
          babelTypes.stringLiteral(propertyName),
          babelTypes.arrowFunctionExpression(
            [
              babelTypes.identifier('req'),
              babelTypes.identifier('res'),
              babelTypes.identifier('next'),
            ],
            babelTypes.callExpression(babelTypes.identifier('next'), [])
          )
        )
      )
      code = this.getModuleDefaultExport(generator)(
        ast,
        {
          sourceMaps: false,
          comments: true,
        },
        code
      ).code
    })
    //
    return code
  }

  //
  findDefaultExportObjectDeclaration(code, callback) {
    // 解析代码成AST
    const ast = babylon.parse(code, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
    })
    const traverser = this.getModuleDefaultExport(traverse)
    // 遍历AST，修改代码节点
    let foundExportDefault = false
    let foundDeclaration = null
    let foundPath = null
    traverser(ast, {
      enter: (path) => {
        if (
          !foundDeclaration &&
          babelTypes.isExportDefaultDeclaration(path.node)
        ) {
          if (!foundExportDefault) {
            foundExportDefault = true
            const declaration = path.node.declaration
            if (babelTypes.isObjectExpression(declaration)) {
              foundDeclaration = declaration
              foundPath = path
            }
          }
        }
      },
    })
    callback(foundDeclaration, foundPath, ast)
  }

  // 解析prettier配置文件
  resolvePrettierConfigFile(callback) {
    if (this.prettierOptions) {
      callback(this.prettierOptions)
    } else {
      let configPath = fileUtil.resolvePath('.prettierrc')
      if (!fs.existsSync(configPath)) {
        configPath = fileUtil.resolvePath('.prettierrc.js')
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
      callback(
        (this.prettierOptions = Object.assign(
          {
            parser: 'babylon',
          },
          options
        ))
      )
    }
  }

  // 创建路径
  makeModulesPath(mockPath) {
    const defaultMockPath = 'mock'
    let absMockPath = ''
    if (this.initModuleState !== 0) {
      return absMockPath
    }
    if (!mockPath || typeof mockPath !== 'string') {
      mockPath = ''
    }
    mockPath = mockPath.trim() || defaultMockPath
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
          this.initModuleState = 1
        }
      } else if (!fs.statSync(absMockPath).isDirectory()) {
        absMockPath = ''
        console.warn('The path for mock module is not a directory')
        this.initModuleState = 1
      }
    }
    return absMockPath
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
  loadMockModules(mockFiles) {
    const delaySetup = {}
    const disabledSetup = {}
    const locateSetup = {}
    const apiModules = {}
    this.mockFiles = mockFiles
    this.registerBabel()
    this.clearRequireCache(mockFiles)
    let hasErrors = false
    const modules = mockFiles.reduce((memo, mockFile) => {
      try {
        const module = require(mockFile)
        const { delay, disabled, locate } = module
        Object.keys(module.default || module).forEach((key) => {
          disabledSetup[key] = !!disabled
          delaySetup[key] = delay
          locateSetup[key] = locate
          apiModules[key] = mockFile
        })
        memo = Object.assign({}, memo, module.default || module)
      } catch (e) {
        hasErrors = true
        console.error(`Mock file parse failed [${mockFile}]`, true)
      }
      return memo
    }, {})
    if (!hasErrors && !this.updating) {
      console.log('Mock file parse success.')
    }
    this.mockModules = this.normalizeModules(modules, {
      delaySetup,
      disabledSetup,
      locateSetup,
      apiModules,
    })
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
    const absMockPath = fileUtil.isAbsolute(mockPath)
      ? mockPath
      : fileUtil.resolvePath(mockPath)
    let files = []
    if (fs.existsSync(absMockPath) && fs.statSync(absMockPath).isDirectory()) {
      if (!this.updating) {
        console.log(`Load mock data from ${absMockPath} `)
      }
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
  normalizeModules(modules, setup) {
    const { delaySetup, disabledSetup, locateSetup, apiModules } = setup
    return Object.keys(modules).reduce((list, key) => {
      const handler = modules[key]
      const type = typeof handler
      if (type !== 'function' && type !== 'object') {
        console.error(
          `Mock value of "${key}" should be function or object, but got ${type}`,
          true
        )
      }
      const { delay: globalDelay, locate: globalLocate } = this.options
      const { method, path } = this.parseApiPath(key)
      const keys = []
      const re = pathToRegexp(path, keys)
      const disabled = disabledSetup[key]
      const module = apiModules[key]
      let delay = delaySetup[key]
      delay = isNaN(delay)
        ? Math.max(Math.floor(+globalDelay || 0), 0)
        : Math.max(Math.floor(+delay), 0)
      let locate = locateSetup[key]
      locate = typeof locate === 'boolean' ? locate : !!globalLocate
      list.push({
        handler: this.createHandler({ method, path, handler, delay }),
        delay,
        locate,
        disabled,
        method,
        path,
        re,
        keys,
        module,
      })
      return list
    }, [])
  }

  //
  createHandler({ method, path, handler }) {
    return (req, res, next) => {
      const execNext = (error) => {
        if (next) {
          if (error) {
            if (!(error instanceof Error)) {
              error = new Error(error)
            }
            next(error)
          } else {
            next()
          }
          next = null
        }
      }
      const sendJSON = (data) => {
        res.json(data)
        execNext()
      }
      const action = () => {
        if (typeof handler === 'function') {
          const result = handler(req, res, (err) => {
            execNext(err)
          })
          if (result instanceof Promise) {
            result.then(sendJSON).catch(execNext)
          } else if (result !== undefined) {
            sendJSON(result)
          } else {
            execNext()
          }
        } else {
          sendJSON(handler)
        }
      }
      if (BODY_PARSED_METHODS.includes(method)) {
        let body = undefined
        let parsing = false
        let parsed = false
        let bodyPromise = null
        Object.defineProperty(req, 'body', {
          get: () => {
            if (!parsing) {
              parsing = true
              bodyPromise = new Promise((resolve) => {
                setImmediate(() => {
                  this.parseRequestBody(req, res).then(() => {
                    parsed = true
                    resolve(body)
                  })
                })
              })
            }
            if (!parsed) {
              return bodyPromise
            }
            return Promise.resolve(body)
          },
          set: (value) => {
            body = value
          },
        })
      }
      //
      action()
    }
  }

  //
  parseRequestBody(req, res) {
    return new Promise((resolve) => {
      bodyParser.json({ limit: '5mb', strict: false })(req, res, (err) => {
        if (err) {
          console.error(err.message, true)
        }
        bodyParser.urlencoded({ limit: '5mb', extended: true })(
          req,
          res,
          (err) => {
            if (err) {
              console.error(err.message, true)
            }
            resolve()
          }
        )
      })
    })
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
    watcher.on(
      'all',
      lodash.debounce(
        (event, file) => {
          console.log(`[${event}] ${file}, reload mock data.`)
          this.updating = true
          // 重新加载模块
          const { path } = this.options
          const { files } = this.getMockFiles(path)
          this.loadMockModules(files)
        },
        500,
        {
          trailing: true,
        }
      )
    )
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
          // 动态URL参数（REST API）
          for (let i = 1; i < match.length; i++) {
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
        `Invalid method ${method} for path ${path}, please check your mock files.`,
        true
      )
    }
    return {
      method,
      path,
    }
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

  getModuleDefaultExport(module) {
    if (module.default !== undefined) {
      return module.default
    }
    return module
  }

  // 获取样板代码
  getTemplateCode(replace) {
    const { defaultDelay, defaultLocate } = this.options
    return `// http://mockjs.com/examples.html
import Mock from 'mockjs'

//
//
export const delay = ${
      isNaN(defaultDelay) ? 0 : Math.max(Math.floor(+defaultDelay), 0)
    }
export const disabled = false
export const locate = ${!!defaultLocate}
//
//
export default {
  //
  '${replace}': (req, res, next) => next(),
}`
  }

  // 示例文件代码内容
  getDemoTemplateCode() {
    return `// mockjs内置的数据生成规则函数
// @boolean         @boolean(1, 9, true)
// @natural         @natural(60, 100)
// @integer         @integer(60, 100)
// @float           @float(60, 100, 3, 5)
// @character       @character("lower")   @character("upper")   @character("number")   @character("symbol")
// @string          @string(7, 10)   @string("lower", 5)   @string("upper", 5)   @string("number", 5)   @string("symbol", 5)
// @range           @range(3, 7)     @range(1, 10, 3)
// @date("yyyy-MM-dd")    @date("yy-MM-dd")   @date("y-M-d")
// @time  @time("A HH:mm:ss")   @time("a HH:mm:ss")   @time("H:m:s")
// @datetime  @datetime("yyyy-MM-dd A HH:mm:ss")  @datetime("y-MM-dd HH:mm:ss")  @datetime("y-M-d H:m:s")
// @now
// @color           @hex  @rgb   @rgba   @hsl
// @paragraph       @paragraph(1, 3)
// @sentence        @sentence(3, 5)
// @word            @word(3, 5)
// @title           @title(3, 5)
// @cparagraph      @cparagraph(1, 3)
// @csentence       @csentence(3, 5)
// @cword           @cword(3, 5)          @cword("零一二三四五六七八九十", 5, 7)
// @ctitle          @ctitle(3, 5)
// @first           @last
// @cfirst          @clast
// @name            @cname
// @url             @domain       @protocol     @ip
// @email
// @province        @city       @city(true)
// @county          @county(true)
// @zip
// @guid            @id         @increment

// http://mockjs.com/examples.html
import Mock from 'mockjs'

// 当前模块内的接口返回延时定义（优先级高于全局定义）
export const delay = 50
// 是否禁用当前模块的接口mock
export const disabled = false
// 是否定位接口在代码中的位置
export const locate = false

const path = 'api'

// 可自由使用es6语法
export default {
  // API拦截格式为"method api"(请求方法，api地址)
  // 使用函数值时，三个参数，分别为请求对象，返回对象，以及中间件的next调用方法
  // 直接调用next，该接口被转发至代理服务器
  'GET /my-api/remote': (req, res, next) => next(),

  // 可以使用mockjs来辅助生成数据
  'GET /my-api/names': Mock.mock({
    'list|100': [{ name: '@name', 'value|1-100': 150, 'type|0-2': 1 }],
  }),

  // 也可以直接返回固定的数据
  [\`POST /\${path}/save\`]: () => ({
    state: 1,
    message: '成功',
  }),

  // 可通过res自行处理数据返回等
  'GET /my-api/other'(req, res) {
    // 如果方法返回了不为undefined的值，会被mock服务以res.json()调用来返回给浏览器
    // 另外，方法也可以返回一个Promise，mock服务会将该Promise的resolve值作为数据返回给浏览器
    // return Promise.resolve({ success: true })
    // 也可以自己调用res返回数据
    res.json({ success: true })
  },

  // restful api，可以使用[:param]形式来捕获路径参数
  'POST /api/:id': (req) => {
    // 如果要取post请求的body内容，则需要使用Promise形式来获取解析后的body内容
    return req.body.then((body) => {
      const { params, query } = req
      const { name } = body // body为post等请求发送的内容
      const { pageIndex } = query // query为URL查询参数
      const { id } = params // params为RESTFUL接口路径中的动态参数
      // params 为get请求时的url查询参数
      // body 为post请求时发送的数据
      // 可以使用这些参数做动态返回
      if (pageIndex === 1) {
        return [{ name, id }]
      } else {
        return [{ name: 'boo', id }]
      }
    })
  },
}

// Mock示例
Mock.mock({
  'data|1-10': [
    {
      id: '@id',
      name: '@cname(2, 4)',
    },
  ],
  count() {
    return this.data.length
  },
})
`
  }
}

//
module.exports = (options) => {
  const middleware = new MockMiddleware(Object.assign({}, options))
  return (req, res, next) => {
    middleware.apply(req, res, next)
  }
}
