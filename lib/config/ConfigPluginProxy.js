// 插件配置代理
// 用于通过配置服务来调用内部插件服务
class ConfigPluginProxy {
  //
  constructor(setup) {
    const { chainConfig, rawWebpack } = setup
    this.rawWabpack = rawWebpack
    this.chainConfig = chainConfig
  }

  // 链式配置
  chainWebpack(serve) {
    // 回调配置服务
    serve(this.chainConfig)
  }

  // 简单配置
  configureWebpack(serve) {
    // 回调配置服务
    return serve(this.rawWabpack)
  }

  // 配置开发服务器
  configureDevServer(serve) {
    // 无法获取到express实例
    // 插件代理不能使用开发服务器配置
  }

  // 注册命令
  registerCommand(name, opts, fn) {
    // 无法获取到插件API实例
    // 插件代理不能使用命令注册
  }
}

module.exports = ConfigPluginProxy
