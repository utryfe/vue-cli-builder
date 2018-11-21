const merge = require('webpack-merge')
const chalk = require('chalk')
const debug = require('debug')('plugin:service:config')
//
const getEnv = require('../utils/env')
const logger = require('../utils/logger')
const file = require('../utils/file')
const restart = require('../utils/restart')
const emitter = require('../utils/emitter')
//
const Plugin = require('../plugin')

// const CustomWebpackPlugin = require('../plugin/BuilderWebpackPlugin')

// 配置服务
// 用于通过配置形式使用插件服务
class ConfigService {
  //
  constructor(setup) {
    const { plugin, options } = setup
    this.plugin = plugin
    this.options = options
  }

  // 链式配置
  chainWebpack() {
    //  参数为 chainable webpack 实例
    this.plugin.chainWebpack((chainConfig) => {
      const api = this.plugin
      const projectOptions = this.options
      const { pluginOptions } = projectOptions
      const pluginSetup = Object.assign({}, pluginOptions)
      const { service } = pluginSetup
      if (service) {
        const env = getEnv()
        const NODE_ENV = env.NODE_ENV
        const isDev = NODE_ENV === 'development'
        const isTest = NODE_ENV === 'test'
        const isPro = NODE_ENV === 'production'
        const modernApp = !!env.VUE_CLI_MODERN_MODE
        const modernBuild = !!env.VUE_CLI_MODERN_BUILD
        console.log()
        //
        ConfigService.enableDefaultService(service, pluginSetup)
        //
        Object.keys(service).forEach((name) => {
          const serviceOptions = service[name]
          const serve = ConfigService.getService(name)
          if (serve) {
            // 执行服务
            const state = serve(
              {
                api,
                plugin: new Plugin({
                  chainConfig,
                  projectOptions,
                  serviceOptions,
                }),
                config: chainConfig,
                isDev,
                isTest,
                isPro,
                env,
                modernApp,
                modernBuild,
                merge,
              },
              serviceOptions,
              projectOptions
            )
            if (state !== false) {
              logger.info(`Register service 🚀 '${name}'`)
            }
          }
        })
        console.log()
      }
      // 应用于拦截的默认链式配置
      ConfigService.chainDefaultWebpack(chainConfig)
    })
  }

  // 简单配置
  configureWebpack() {
    // 参数为原始到webpack配置对象
    return this.plugin.configureWebpack((webpackConfig) => {
      // 返回的配置会被调用方合并
      return {
        plugins: [],
      }
    })
  }

  // 开发服务配置
  configureDevServer() {
    // 参数为 express app 实例
    this.plugin.configureDevServer((express, devServer) => {
      this.devServer = devServer
      if (process.env.NODE_ENV === 'development') {
        emitter.once('restart', (reason) => {
          logger.warn(
            `Since ${chalk.cyan(reason)}, you may be need to restart the server.`
          )
          // this.restart(reason)
        })
        emitter.on('invalidate', (config, callback) => {
          // 触发webpack重新编译
          this.devServer.invalidate(callback)
        })
      }
    })
  }

  // 代理服务器配置
  configureProxyServer() {
    // 配置代理服务器
    new Plugin({
      projectOptions: this.options,
    }).configureProxyServer((config) => {
      const { onProxyRes, onProxyReqWs, target, headers } = config
      Object.assign(config, {
        onProxyReqWs: proxyFunc(onProxyReqWs, (proxyReq) => {
          proxyReq.setHeader('X-Proxy-Socket-Remote', target)
        }),
        onProxyRes: proxyFunc(onProxyRes, (proxyRes, req, res) => {
          // 将远程转发地址加到响应头里
          proxyRes.headers['X-Proxy-Remote'] = target
          // 保存代理响应的内容
          let body = new Buffer('')
          proxyRes.on('data', (chunk) => {
            body = Buffer.concat([body, chunk])
          })
          proxyRes.on('end', () => {
            res.rawBody = body
          })
        }),
        headers: Object.assign({ 'X-Proxy-Remote': target }, headers),
      })
    })
  }

  restart(reason) {
    const devServer = this.devServer
    if (!devServer) {
      debug('Server is not ready, restart does not work.')
      return
    }
    if (reason) {
      logger.info(`Since ${chalk.cyan(reason)}, try to restart server...`)
    } else {
      logger.info(`Try to restart server...`)
    }
    // 暂时无法灵活实现重启
    emitter.emit('before-restart')
    devServer.close(restart)
  }
}

// 代理回调函数
function proxyFunc(original, proxy, context) {
  if (typeof original === 'function') {
    return (...args) => {
      original.apply(context, args)
      proxy.apply(context, args)
    }
  } else {
    return context ? proxy.bind(context) : proxy
  }
}

// 使用自定义的babelLoader对代码进行额外处理
function useCustomBabelLoader(chainConfig) {
  chainConfig.module
    .rule('js')
    .use('babel-loader')
    .loader(file.joinPath(`${__dirname}`, '../plugin/babel/CustomBabelLoader'))
}

// 使用自定义的webpack插件
function useCustomWebpackPlugin(chainConfig) {
  // chainConfig.plugin('ut-builder-webpack-plugin').use(CustomWebpackPlugin)
}

// 已注册的服务
ConfigService.services = {}

// 配置默认的chain操作
ConfigService.chainDefaultWebpack = function(chainConfig) {
  // useCustomBabelLoader(chainConfig)
  // useCustomWebpackPlugin(chainConfig)
}

// 启用默认的服务
ConfigService.enableDefaultService = function(service, pluginOptions) {
  // 强制开启环境数据变量定义
  service.define = Object.assign({}, service.define)
  if (pluginOptions.preprocess && process.env.NODE_ENV === 'development') {
    service.watch = Object.assign({}, service.watch)
  }
}

// 注册服务
ConfigService.registerService = function(name, service) {
  if (typeof name !== 'string') {
    logger.error(`[registerService] The type of name must be a string. (${name}`)
    process.exit(1)
  }
  const services = ConfigService.services
  const hyphenName = name.replace(/([A-Z]+)/g, '-$1').toLowerCase()
  if (Object.prototype.hasOwnProperty.call(services, hyphenName)) {
    logger.error(`[registerService] The service name of '${name}' already exists.`)
    process.exit(1)
  }
  if (typeof service !== 'function') {
    logger.error(`[registerService] Service must be a function. (${name}`)
    process.exit(1)
  }
  services[hyphenName] = service
  debug(`Register service 👉 '${name}'`)
}

// 获取服务
ConfigService.getService = function(name) {
  if (typeof name === 'string') {
    const services = ConfigService.services
    // 将驼峰名转换为连字符名称
    const hyphenName = name.replace(/([A-Z]+)/g, '-$1').toLowerCase()
    if (Object.prototype.hasOwnProperty.call(services, hyphenName)) {
      return services[hyphenName]
    }
    const dll = ConfigService.loadDLL(name)
    if (dll) {
      return dll
    }
  }
  logger.warn(`[getService] Service load failed. (${name})`)
}

// 加载内部服务
ConfigService.loadDLL = function(name) {
  let service = null
  try {
    service = require(`./dll/${name}`)
    ConfigService.registerService(name, service)
  } catch (e) {}
  return service
}

// 加载所有内部服务
ConfigService.loadAllDLL = function() {
  for (const name of file.getFileName('dll/*.js', {
    noExt: true,
    cwd: __dirname,
  })) {
    ConfigService.registerService(name, require(`./dll/${name}`))
  }
}

//
module.exports = ConfigService
