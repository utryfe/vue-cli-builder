//
const lodashMerge = require('lodash/merge')
const mergeWebpack = require('webpack-merge')
//
const logger = require('../utils/logger')
const getEnv = require('../utils/env')
const entryManager = require('../app/entryManager')
//
const PluginProxy = require('./ConfigPluginProxy')
const ConfigProxy = require('../service/ConfigService')

//
const defaultConfig = require('./default')

// 配置生成
class Config {
  //
  constructor(setup, usedAsService) {
    this.options = lodashMerge(defaultConfig(), setup)
    this.usedAsService = !!usedAsService
  }

  // 输出配置对象
  toConfig() {
    const projectOptions = this.options
    projectOptions.pages = entryManager(projectOptions).toEntryPoints()
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
      if (!this.usedAsService) {
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
      if (!this.usedAsService) {
        if (webpackConfig && typeof webpackConfig === 'object') {
          // 合并webpack配置
          rawWebpack = mergeWebpack(rawWebpack, webpackConfig)
        }
        // 调用内部简单配置服务
        return new ConfigProxy({
          plugin: new PluginProxy({ rawWebpack }),
          options,
        }).configureWebpack()
      }
      //
      return webpackConfig
    }
  }
}

module.exports = (options, usedAsService) => {
  const config = new Config(options, usedAsService).toConfig()
  // 注册应用已配置环境变量
  const envSetup = getEnv()
  envSetup.registerVariables('UT_BUILD_ENTRY_CONFIGURED', true)
  if (!process.env.UT_BUILD_CONFIGURE_PRINTED) {
    // 打印关键配置信息
    logger.print({
      env: envSetup.UT_BUILD_ENTRY_SETUP,
      data: envSetup.UT_DATA_APP_DEFINED,
      entry: envSetup.UT_BUILD_ENTRY_POINTS,
    })
    process.env.UT_BUILD_CONFIGURE_PRINTED = true
  }

  return config
}
