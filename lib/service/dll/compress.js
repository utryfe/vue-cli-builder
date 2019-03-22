// 压缩产品包
module.exports = ({ plugin, isDev, modernApp, modernBuild }, options) => {
  if (!options || isDev || (modernApp && !modernBuild)) {
    return false
  }

  const emitter = require('../../utils/emitter')
  emitter.on('compress-complete', (zips) => {
    const logger = require('../../utils/logger')
    zips.forEach((zip, index) =>
      logger.done(`Compress done 📦 ${zip}${index === zips.length - 1 ? '\n' : ''}`)
    )
  })

  //
  plugin.use(`^zip-compress`, () => [options])
}
