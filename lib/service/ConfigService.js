const env = require('../utils/env')
const console = require('../utils/console')
//
const Plugin = require('../plugin')
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
      const projectOptions = this.options
      const { pluginOptions } = projectOptions
      const { service } = Object.assign({}, pluginOptions)
      if (service) {
        Object.keys(service).forEach((name) => {
          const serviceOptions = service[name]
          const serve = serviceOptions ? ConfigService.getService(name) : null
          if (serve) {
            // 执行服务
            serve(
              {
                plugin: new Plugin({
                  chainConfig,
                  projectOptions,
                  serviceOptions,
                }),
                config: chainConfig,
                dev: process.env.NODE_ENV !== 'production',
                env: env(),
              },
              serviceOptions,
              projectOptions
            )
          }
        })
      }
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
    this.plugin.configureDevServer((express) => {
      // app 配置
    })
  }
}

// 已注册的服务
ConfigService.services = {}

// 注册服务
ConfigService.registerService = function(name, service) {
  if (typeof name !== 'string') {
    console.error(
      `[registerService] The type of name must be a string. (${name}`
    )
  }
  const services = ConfigService.services
  const lowerName = name.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(services, lowerName)) {
    console.error(
      `[registerService] The service name of '${name}' already exists.`
    )
  }
  if (typeof service !== 'function') {
    console.error(`[registerService] Service must be a function. (${name}`)
  }
  services[lowerName] = service
}

// 获取服务
ConfigService.getService = function(name) {
  if (typeof name === 'string') {
    const services = ConfigService.services
    // 将驼峰名转换为连字符名称
    const hyphenName = name.replace(/[A-Z]+/g, (t) =>
      t.replace(/^(.)/, `-$1`).toLowerCase()
    )
    if (Object.prototype.hasOwnProperty.call(services, hyphenName)) {
      return services[hyphenName]
    }
  }
  console.error(`[getService] Service load error. (${name})`)
}

// 注册内部服务
ConfigService.registerService('copy', require('./dll/copy'))
ConfigService.registerService('html', require('./dll/html'))
ConfigService.registerService('unused', require('./dll/unused'))
ConfigService.registerService('time-cost', require('./dll/timeCost'))

//
module.exports = ConfigService
