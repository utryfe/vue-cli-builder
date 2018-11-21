//
const commonUtil = require('../../utils/common')
const emitter = require('../../utils/emitter')

function getDefinedEnv(args, env, options) {
  const prop = 'process.env'
  const arg = Object.assign({}, args[0])
  const appData = env.APP_DATA_DEFINED_PROCESS
  //
  arg[prop] = Object.assign(
    {},
    arg[prop],
    // 配置文件中的数据
    Object.keys(options).reduce((data, key) => {
      data[key] = JSON.stringify(options[key])
      return data
    }, {}),
    // 环境变量里的数据
    Object.keys(appData).reduce((data, key) => {
      data[key] = JSON.stringify(appData[key])
      return data
    }, {})
  )
  //
  return [arg]
}

// 环境变量定义
module.exports = ({ plugin, env, isDev }, options) => {
  //
  options = Object.assign({}, options)
  //
  plugin.use('define', (args) => {
    return getDefinedEnv(args, env, options)
  })
  //
  if (isDev) {
    commonUtil.watch(
      '.env?(.development)?(.local)',
      () => {
        emitter.emit('restart', 'env file has been changed')
      },
      { delay: 300, cwd: process.cwd() }
    )
  }
}
