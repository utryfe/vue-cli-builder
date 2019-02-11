//
module.exports = function(config, context) {
  // fork进程的环境变量模式
  const forkEnv = process.env.FORKED_NODE_ENV
  const plugins = config.plugins
  // 清除不需要的插件
  plugins.delete('copy')
  plugins.delete('prefetch')
  plugins.delete('preload')
  plugins.delete('html')
  plugins.delete('dll')
  plugins.delete('named-chunks')

  // 定义代码环境变量，如vue需要development变量，才能够显示开发者工具
  const define = 'define'
  let definePlugin = null
  if (plugins.has(define)) {
    definePlugin = config.plugin(define)
  } else {
    const webpack = require('../index').getContextWebpack(context)
    definePlugin = config.plugin(define).use(webpack.DefinePlugin)
  }
  definePlugin.tap((args) => {
    if (!Array.isArray(args)) {
      args = []
    }
    const arg = Object.assign({}, args[0])
    const prop = 'process.env'
    let env = {}
    for (const key of Object.keys(arg)) {
      if (key === prop) {
        env = arg[key]
        break
      }
    }
    // 变更代码环境模式
    env.NODE_ENV = JSON.stringify(forkEnv)
    arg[prop] = env
    args.splice(0, 1, arg)
    return args
  })
}
