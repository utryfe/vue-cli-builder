//
const merge = require('lodash.merge')
const mergeWebpack = require('webpack-merge')
//
const console = require('../utils/console')
const env = require('../utils/env')
const entry = require('../utils/entry')
//
const PluginProxy = require('./PluginProxy')
const ConfigProxy = require('../service/ConfigService')

//
const defaultConfig = require('./default')

// 配置生成
class Config {
  //
  constructor(setup) {
    this.options = merge(defaultConfig(), setup)
  }

  // 输出配置对象
  toConfig() {
    const projectOptions = this.options
    projectOptions.pages = entry.toPages(projectOptions)
    projectOptions.chainWebpack = this.toChainWebpack()
    projectOptions.configureWebpack = this.toConfigureWebpack()
    // 返回工程构建配置
    return projectOptions
  }

  // 构建链式配置服务
  toChainWebpack() {
    const options = this.options
    const { chainWebpack } = options
    return (chainConfig) => {
      if (typeof chainWebpack === 'function') {
        // 调用用户链式服务
        chainWebpack(chainConfig, options)
      }
      if (!env().PLUGIN_VERSION) {
        // 挂载内部插件服务
        new ConfigProxy({
          plugin: new PluginProxy({ chainConfig }),
          options,
          // 执行链式配置
        }).chainWebpack()
      }
    }
  }

  // 构造简单配置服务
  toConfigureWebpack() {
    const options = this.options
    const { configureWebpack } = options
    return (rawWebpack) => {
      let webpackConfig = null
      if (typeof configureWebpack === 'function') {
        // 调用用户配置服务
        webpackConfig = configureWebpack(rawWebpack, options)
      } else {
        // 简单配置对象
        webpackConfig = configureWebpack
      }
      if (webpackConfig && typeof webpackConfig === 'object') {
        // 合并webpack配置
        mergeWebpack(rawWebpack, webpackConfig)
      }
      if (!env().PLUGIN_VERSION) {
        // 调用内部简单配置服务
        return new ConfigProxy({
          plugin: new PluginProxy({ rawWebpack }),
          options,
        }).configureWebpack()
      }
    }
  }
}

module.exports = (options) => {
  const config = new Config(options).toConfig()
  // 注册应用已配置环境变量
  env.registerVariables('APP_CONFIGURED', true)
  // 打印关键配置信息
  console.print('env', env().entry)
  console.print('entry', config.pages)
  return config
}
