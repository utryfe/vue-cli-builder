const fileUtil = require('../../utils/file')

const Service = require('../../service/ConfigService')

// 雪碧图
module.exports = ({ plugin }, options) => {
  if (!options) {
    return false
  }
  options = Object.assign({}, options)
  const { image, css } = Object.assign(
    {
      image: 'node_modules/.assets/sprites.png',
      // 要以 .module.css 结尾，确保以模块方式加载
      css: 'node_modules/.assets/sprites.module.css',
    },
    options.target
  )
  options.target = {
    image: fileUtil.getAbsPath(image),
    css: fileUtil.getAbsPath(css),
  }
  // 将css文件追加至entry
  Service.addEntryDependency(options.target.css)
  // 应用雪碧图插件
  plugin.use('^sprites-icon', () => [options])
}
