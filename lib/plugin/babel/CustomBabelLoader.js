const babelLoader = require('babel-loader')

// 产品环境，移除debugger
function removeDebugger() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    name: 'transform-remove-debugger',
    visitor: {
      DebuggerStatement(path) {
        if (isProd) {
          path.remove()
        }
      },
    },
  }
}

const plugins = [[removeDebugger, []]]

// 自定义babel插件
module.exports = babelLoader.custom((babel) => {
  return {
    //
    customOptions(options) {
      const clonedOptions = Object.assign({}, options)
      const customOptions = {}
      // 分离出自定义的参数
      Object.keys(clonedOptions).forEach((option) => {
        for (const plugin of plugins) {
          const [constructor, pluginOptions] = plugin
          constructor.options = constructor.options || {}
          for (const pOption of pluginOptions) {
            if (option === pOption) {
              const value = clonedOptions[option]
              customOptions[option] = value
              constructor.options[option] = value
              delete clonedOptions[option]
            }
          }
        }
      })
      return {
        custom: customOptions,
        loader: clonedOptions,
      }
    },
    //
    config(cfg) {
      return Object.assign({}, cfg.options, {
        plugins: (cfg.options.plugins || []).concat(plugins.map((plugin) => plugin[0])),
      })
    },
  }
})

// 注册自定义Babel插件
module.exports.registerBabelPlugin = function(plugin, options) {
  if (typeof plugin === 'function') {
    if (options) {
      if (!Array.isArray(options)) {
        throw '[registerBabelPlugin] Options must be a array.'
      }
    } else {
      options = []
    }
    plugins.push([plugin, options])
  }
}
