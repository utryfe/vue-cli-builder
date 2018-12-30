const console = require('../utils/console')
const pluginProxy = require('./proxy')

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

  // 配置代理服务器
  // callback(context, config)
  configureProxyServer(callback) {
    const { projectOptions } = this
    const devServer = (projectOptions.devServer = Object.assign(
      Object.assign({}, projectOptions.devServer)
    ))
    const { proxy } = devServer
    let proxyConfig = null
    if (typeof proxy === 'string' && proxy.trim()) {
      const context = '/'
      const raw = { target: proxy }
      proxyConfig = { [context]: Object.assign(raw, callback(context, raw)) }
    } else if (proxy && typeof proxy === 'object') {
      proxyConfig = Object.keys(proxy).reduce((config, context) => {
        const raw = proxy[context]
        const { target } = Object.assign({}, raw)
        if (typeof target === 'string' && target.trim() && context.trim()) {
          config[context] = Object.assign(raw, callback(context, raw))
        }
        return config
      }, {})
    }
    if (proxyConfig) {
      devServer.proxy = proxyConfig
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
    console.error(`[registerPlugin] Plugin must be a function. (${name})`)
  }
  plugins[lowerName] = plugin
  console.log(`Register plugin 👉 '${name}'`)
  return plugin
}

// 获取插件
Plugin.getPlugin = function(name) {
  if (typeof name === 'string') {
    const plugins = Plugin.plugins
    const lowerName = name.toLowerCase()
    if (Object.prototype.hasOwnProperty.call(plugins, lowerName)) {
      return plugins[lowerName]
    }
    const plugin = Plugin.load(name)
    if (plugin) {
      return plugin
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

// 加载插件
Plugin.load = function(name) {
  let plugin = null
  try {
    // 加载内部插件
    const className = name
      .replace(/^([a-z])/, (s) => s.toUpperCase())
      .replace(/-([a-zA-Z])/g, (t, s) => s.toUpperCase())
    plugin = require(`./webpack/${className}`)
    // 内部插件使用代理，统一管理
    // plugin = pluginProxy(require(`./webpack/${className}`))
  } catch (e) {
    // 加载外部webpack插件
    const webpackPluginName = /(?:-webpack)?-plugin$/.test(name)
      ? name
      : `${name}-webpack-plugin`
    try {
      plugin = require(webpackPluginName)
    } catch (e) {
      console.error(
        `The plugin of webpack named by '${webpackPluginName}' is not installed.`,
        true
      )
    }
  } finally {
    if (plugin) {
      plugin = Plugin.registerPlugin(name, plugin)
    }
  }
  return plugin
}

// 导出
module.exports = Plugin
