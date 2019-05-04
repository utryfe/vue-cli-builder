/**
 * 注册loader插件
 * @param webpackConfig webpack-chain
 * @param pluginConfig
 */
module.exports = (webpackConfig, pluginConfig) => {
  if (!webpackConfig) {
    throw new Error('Need webpack-chain instance.')
  }
  const { name, alias, options } = Object.assign({}, pluginConfig)

  const pluginPath = require.resolve(name)
  let exceptPlugin = require(pluginPath)
  if (!exceptPlugin) {
    throw new Error('Plugin export is empty.')
  }
  if (exceptPlugin.default) {
    exceptPlugin = exceptPlugin.default
  }

  const exceptPluginNames = Array.isArray(alias)
    ? alias.filter((al) => typeof al === 'string')
    : typeof alias === 'string'
    ? [alias]
    : []

  if (!exceptPluginNames.includes(pluginPath)) {
    exceptPluginNames.unshift(pluginPath)
  }

  if (!exceptPluginNames.includes(name)) {
    exceptPluginNames.unshift(name)
  }

  const babelLoader = webpackConfig.module.rule('js').use('babel-loader')
  const loaderOptions = Object.assign({}, babelLoader.get('options'))
  const { plugins } = loaderOptions
  const pluginList = Array.isArray(plugins) ? [...plugins] : []

  const usedPlugins = []
  for (const plugin of pluginList) {
    let pluginName
    let pluginConfig
    if (Array.isArray(plugin)) {
      pluginName = plugin[0]
      pluginConfig = plugin[1]
    } else {
      pluginName = plugin
    }
    if (typeof pluginName !== 'string') {
      const type = typeof pluginName
      if (type === 'object' || type === 'function') {
        usedPlugins.push([pluginName, Object.assign({}, pluginConfig, options)])
        if (pluginName === exceptPlugin) {
          exceptPlugin = null
        }
      }
      continue
    }

    if (exceptPluginNames.includes(pluginName)) {
      pluginConfig = Object.assign({}, pluginConfig, options)
      exceptPlugin = null
    }
    usedPlugins.push([pluginName, pluginConfig])
  }

  if (exceptPlugin) {
    usedPlugins.push([pluginPath, Object.assign({}, options)])
  }

  babelLoader.options(
    Object.assign(loaderOptions, {
      plugins: usedPlugins,
    })
  )
}
