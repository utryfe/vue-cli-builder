//

// 环境变量定义
module.exports = ({ plugin, env }, options) => {
  //
  options = Object.assign({}, options)

  plugin.use('define', (args) => {
    const prop = 'process.env'
    const arg = Object.assign({}, args[0])
    const appData = env.APP_DATA
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
  })
}
