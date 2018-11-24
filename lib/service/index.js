//
const env = require('../utils/env')
const strUtil = require('../utils/string')
const userConfig = require('../utils/userConfig')
const ConfigService = require('./ConfigService')
const CommandService = require('./CommandService')
const Plugin = require('../plugin')
const config = require('../config')

// 导出插件
module.exports = (api, projectOptions) => {
  // 以插件形式被调用
  if (!env().APP_CONFIGURED) {
    // 需要对应用进行配置
    Object.assign(projectOptions, config(userConfig || projectOptions))
    const { baseUrl, outputDir } = projectOptions
    if (typeof baseUrl === 'string') {
      projectOptions.baseUrl = strUtil.ensureSlash(baseUrl).replace(/^\.\//, '')
    }
    projectOptions.outputDir = strUtil.removeSlash(outputDir)
  }
  // 加载用户自定义定插件和服务
  const { pluginOptions } = projectOptions
  const { registerService, registerPlugin } = Object.assign({}, pluginOptions)
  if (registerService && typeof registerService === 'object') {
    // 注册用户服务
    Object.keys(registerService).forEach((name) => {
      ConfigService.registerService(name, registerService[name])
    })
  }
  if (registerPlugin && typeof registerPlugin === 'object') {
    // 注册用户插件
    Object.keys(registerPlugin).forEach((name) => {
      Plugin.registerPlugin(name, registerPlugin[name])
    })
  }
  //
  const service = new ConfigService({
    plugin: api,
    options: projectOptions,
  })
  // 执行配置服务
  service.chainWebpack()
  service.configureWebpack()
  service.configureDevServer()
  // 注册命令行服务
  new CommandService({
    plugin: api,
    options: projectOptions,
  }).registerCommand()
}

// 导出注册服务
module.exports.registerService = ConfigService.registerService
// 导出注册插件
module.exports.registerPlugin = Plugin.registerPlugin
// 命令模式定义
module.exports.defaultModes = CommandService.commandModes
