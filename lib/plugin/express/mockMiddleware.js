const fs = require('fs')
const chokidar = require('chokidar')
const pathToRegexp = require('path-to-regexp')
const bodyParser = require('body-parser')
const babylon = require('babylon')
const traverse = require('@babel/traverse')
const babelTypes = require('@babel/types')
const generator = require('@babel/generator')
const prettier = require('prettier')

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
        // 按路径自动初始化创建接口mock模块
        init: true,
      },
      options
    )
    this.mockFiles = []
    this.mockModules = []
    this.updating = false
    this.createdApi = {}
    this.initModuleState = 0
    this.init()
  }

  // 初始化
  init() {
    const { path: mockPath } = this.options
    const { files, pattern } = this.getMockFiles(mockPath)
    this.loadMockModules(files)
    this.watchFile(pattern)
  }

  // 应用中间件
  apply(req, res, next) {
    const match = this.matchMock(req)
    if (match) {
      const { method, path, disabled, handler } = match
      if (disabled) {
        console.raw.log(`Mock disabled: [${method}] ${path}`)
        return next()
      } else {
        console.raw.log(`Mock matched: [${method}] ${path}`)
        return handler(req, res, next)
      }
    } else {
      if (req.xhr) {
        const requestMethod = req.method
        const requestPath = req.path
        const api = `${requestMethod} ${requestPath}`
        if (!this.createdApi[api]) {
          this.createdApi[api] = true
          res.once('finish', () => {
            this.generateMockModule({
              method: requestMethod,
              path: requestPath,
            })
          })
        }
      }
      return next()
    }
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
        const action = requestPath.substring(requestPath.lastIndexOf('/') + 1)
        const modulePath = fileUtil.joinPath(
          rootDir,
          requestPath.replace(/^\/+|\/[^\/]*$/g, '').replace(/\s+/g, '-')
        )
        let moduleDir = fileUtil.getDirName(modulePath)
        if (action === moduleDir) {
          moduleDir = rootDir
        }
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
            moduleDir === rootDir ? `${rootDir}/root` : modulePath
          }.js`
          this.createModule(module, { method, path: requestPath })
          console.log(`Generated API: ${method} ${requestPath} [${module}]`)
        }
      }
    } catch (e) {
      console.error(e.message, true)
    }
  }

  // 创建模块文件
  createModule(modulePath, { method, path: requestPath }) {
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
    // 写入代码文件
    this.resolvePrettierConfigFile((options) => {
      fs.writeFileSync(modulePath, prettier.format(code, options), { encoding })
    })
  }

  // 注入API代码
  injectAPICodeTo(code, propertyName) {
    // 解析代码成AST
    const ast = babylon.parse(code, {
      sourceType: 'module',
    })
    const traverser = this.getModuleDefaultExport(traverse)
    // 遍历AST，修改代码节点
    let foundExportDefault = false
    traverser(ast, {
      enter: (path) => {
        if (babelTypes.isExportDefaultDeclaration(path.node)) {
          if (!foundExportDefault) {
            foundExportDefault = true
            const declaration = path.node.declaration
            if (babelTypes.isObjectExpression(declaration)) {
              const properties = declaration.properties
              for (const prop of properties) {
                if (babelTypes.isStringLiteral(prop.key)) {
                  if (`${prop.value}`.trim() === propertyName) {
                    return code
                  }
                }
              }
              properties.unshift(
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
            }
          }
        }
      },
    })
    return code
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
    const absMockPath = fileUtil.resolvePath(mockPath)
    if (fs.existsSync(absMockPath)) {
      if (!fs.statSync(absMockPath).isDirectory()) {
        if (this.initModuleState === 0) {
          this.initModuleState = 1
          console.error('The path for mock module is not a directory', true)
        }
      }
    } else {
      // 创建mock模块的目录
      try {
        fileUtil.mkdir(absMockPath)
      } catch (e) {
        console.error(e.message, true)
        this.initModuleState = 1
      }
    }
    return this.initModuleState === 0 ? absMockPath : ''
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
    const { delay: globalDelay } = this.options
    const delaySetup = {}
    const disabledSetup = {}
    this.mockFiles = mockFiles
    this.registerBabel()
    this.clearRequireCache(mockFiles)
    let hasErrors = false
    const modules = mockFiles.reduce((memo, mockFile) => {
      try {
        const module = require(mockFile)
        const delay = module.delay
        const disabled = !!module.disabled
        Object.keys(module.default || module).forEach((key) => {
          delaySetup[key] = isNaN(delay) ? globalDelay : delay
          disabledSetup[key] = disabled
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
    const absMockPath = fileUtil.resolvePath(mockPath)
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
  normalizeModules(modules, { delaySetup, disabledSetup }) {
    return Object.keys(modules).reduce((list, key) => {
      const handler = modules[key]
      const type = typeof handler
      if (type !== 'function' && type !== 'object') {
        console.error(
          `Mock value of "${key}" should be function or object, but got ${type}`,
          true
        )
      }
      const { method, path } = this.parseApiPath(key)
      const keys = []
      const re = pathToRegexp(path, keys)
      const disabled = disabledSetup[key]
      let delay = delaySetup[key]
      delay = isNaN(delay) ? 0 : Math.max(+delay, 0)
      list.push({
        handler: this.createHandler({ method, path, handler, delay }),
        delay,
        disabled,
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
      const sendJSON = (data) => {
        res.json(data)
        next()
      }
      const sendData = () => {
        if (typeof handler === 'function') {
          const result = handler(req, res, next)
          if (result instanceof Promise) {
            result.then(sendJSON)
          } else if (result !== undefined) {
            sendJSON(result)
          }
        } else {
          sendJSON(handler)
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
      this.updating = true
      // 重新加载模块
      const { path } = this.options
      const { files } = this.getMockFiles(path)
      this.loadMockModules(files)
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
    return `// http://mockjs.com/examples.html
import Mock from 'mockjs'

export const delay = 50
export const disabled = false

export default {
  //
  '${replace}': (req, res, next) => next(),
}

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

Mock.mock({
  'data|1-10': [
    {
      id: '@id',
      name: '@cname',
    },
  ],
  count() {
    return this.data.length
  },
})

/*

const path = 'api'
// 可自由使用es6语法
export default {
  // 属性格式为"method api"(请求方法，api地址)
  // 可以使用mockjs来辅助生成数据
  'GET /my-api/names': Mock.mock({
    'list|100': [{ name: '@name', 'value|1-100': 150, 'type|0-2': 1 }],
  }),

  // 使用函数返回mock数据
  // 属性名可以使用动态属性名语法
  [\`POST /\${path}/save\`]() {
    return {
      state: 1,
      message: '成功',
    }
  },

  // 属性名可以使用动态属性名语法
  [\`GET \${path}/list\`](req, res, next) {
    // 函数时，可接受三个参数，分别为请求对象，返回对象，以及中间件的next调用方法
    const { params, body } = req
    // params 为get请求时的url查询参数
    // body 为post请求时发送的数据
    // 可以使用这些参数做动态返回
    if (params.pageIndex === 1) {
      return [{ name: 'foo' }]
    } else {
      return [{ name: 'boo' }]
    }
  },

  // 通过res自行处理数据返回等
  'GET /my-api/other'(req, res, next) {
    // 函数时，三个参数，分别为请求对象，返回对象，以及中间件的next调用方法
    // 如果方法返回了不为undefined的值，会被mock服务以res.json()调用来返回给浏览器
    // 另外，方法也可以返回一个Promise，mock服务会将该Promise的resolve值作为数据返回给浏览器
    // return Promise.resolve({ success: true })

    // 如果方法没有返回值（返回值为undefined），则可以自己调用res返回数据，并调用next触发下一个中间件
    res.json({ success: true })
    next()
  },
}

*/
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
