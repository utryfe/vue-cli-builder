// 压缩产品包
module.exports = ({ plugin, isDev, modernApp, modernBuild }, options) => {
  if (!options || isDev || (modernApp && !modernBuild)) {
    return false
  }
  //
  plugin.use(`^zip-compress`, (args) => {
    let arg = args[0]
    if (!Array.isArray(arg)) {
      arg = (arg && typeof arg === 'object') || arg === true ? [arg] : []
    }
    if (Array.isArray(options)) {
      arg.push.apply(arg, options)
    } else {
      arg.push(options)
    }
    return [arg]
  })
}
