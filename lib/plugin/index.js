const console = require('../utils/console')

// 插件
class Plugin {
  // 插件，可被服务使用
  constructor(setup) {
    const { chainConfig, projectOptions, serviceOptions } = setup
    this.chainConfig = chainConfig
    this.projectOptions = projectOptions
    this.serviceOptions = serviceOptions
  }
  // 使用插件
  use(name, handler) {
    const { pluginName, configName } = Plugin.parseName(name)
    const chainConfig = this.chainConfig
    const plugins = chainConfig.plugins
    let plugin = null
    if (plugins.has(configName)) {
      // 获取命名插件
      plugin = chainConfig.plugin(configName)
    } else {
      // 创建命名插件配置，并设置插件构造函数
      plugin = chainConfig.plugin(configName).use(Plugin.getPlugin(pluginName))
    }
    // 修改构建插件参数
    if (handler === undefined) {
      handler = (args) => [Object.assign({}, args[0], this.serviceOptions)]
    }
    if (typeof handler === 'function') {
      plugin.tap((args) => {
        // 返回正确的参数数组才返回
        const res = handler(args)
        return Array.isArray(res) ? res : args
      })
    }
  }
}

//  当前已注册的插件
Plugin.plugins = {}

// 注册插件
Plugin.registerPlugin = function(name, plugin) {
  if (typeof name !== 'string') {
    console.error(
      `[registerPlugin] The type of name must be a string. (${name}`
    )
  }
  const plugins = Plugin.plugins
  const lowerName = name.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(plugins, lowerName)) {
    console.error(
      `[registerPlugin] The plugin name of '${name}' already exists.`
    )
  }
  const type = plugin ? typeof plugin : ''
  if (type !== 'function' && type === 'object') {
    plugin = plugin.default
  }
  if (typeof plugin !== 'function') {
    console.error(`[registerPlugin] Plugin must be a function. (${name}`)
  }
  plugins[lowerName] = plugin
}

// 获取插件
Plugin.getPlugin = function(name) {
  if (typeof name === 'string') {
    const plugins = Plugin.plugins
    const lowerName = name.toLowerCase()
    if (Object.prototype.hasOwnProperty.call(plugins, lowerName)) {
      return plugins[lowerName]
    }
  }
  console.error(`[getPlugin] Plugin load error. (${name})`)
}

// aaa-bbb 将加载注册为aaa的插件
// ^aaa-bbb 将加载注册为aaa-bbb的插件
// -aaa-bbb 将加载注册为-aaa-bbb的插件
// 可直接使用 { pluginName, configName }来避免解析
Plugin.parseName = function(name) {
  let pluginName = name && typeof name === 'string' ? name : ''
  let configName = pluginName
  if (name && typeof name === 'object') {
    pluginName = name.pluginName
    configName = name.configName || pluginName
  } else if (pluginName) {
    if (!name.startsWith('^')) {
      const firstHyphenIndex = name.indexOf('-')
      if (firstHyphenIndex > 0) {
        pluginName = name.substring(0, firstHyphenIndex)
      }
    } else {
      // 以^开头，移除开头的^
      pluginName = name.substring(1)
      configName = pluginName
    }
  }
  return { pluginName, configName }
}

// 注册内部插件
Plugin.registerPlugin('html', require('html-webpack-plugin'))
Plugin.registerPlugin('copy', require('copy-webpack-plugin'))
Plugin.registerPlugin('unused', require('unused-files-webpack-plugin'))
Plugin.registerPlugin('time-cost', require('./webpack/TimeCostPlugin'))
Plugin.registerPlugin('compiler-event', require('./webpack/CompilerEvent'))

// 导出
module.exports = Plugin
