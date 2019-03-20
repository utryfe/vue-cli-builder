// 压缩产品包
module.exports = ({ plugin, isDev, modernApp, modernBuild }, options) => {
  if (!options || isDev) {
    return false
  }

  const emitter = require('../../utils/emitter')
  emitter.on('compress-complete', (zips) => {
    if (modernApp && !modernBuild) {
      return
    }

    const logger = require('../../utils/logger')
    zips.forEach((zip, index) =>
      logger.done(`Compress done 📦 ${zip}${index === zips.length - 1 ? '\n' : ''}`)
    )
  })

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
