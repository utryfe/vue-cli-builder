const BuilderWebpackPlugin = require('./BuilderWebpackPlugin')
// 自定义webpack插件代理
module.exports = function(Plugin) {
  return class WebpackPluginProxy {
    constructor(options) {
      if (typeof Plugin === 'function') {
        const plugin = new Plugin(options)
        if (typeof plugin.apply === 'function') {
          this.plugin = plugin
        }
      } else if (Plugin && typeof Plugin.apply === 'function') {
        this.plugin = Plugin
      }
    }
    apply(compiler) {
      const plugin = this.plugin
      if (plugin) {
        plugin.apply(
          Object.assign(Object.create(compiler), {
            plugin(name, handler) {
              BuilderWebpackPlugin.registerHooks(name, handler)
            },
          })
        )
      }
    }
  }
}
