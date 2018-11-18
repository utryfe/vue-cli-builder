//
const ConfigService = require('./ConfigService')
const CommandService = require('./CommandService')
const Plugin = require('../plugin')

// 导出插件
module.exports = (api, projectOptions) => {
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
