//
module.exports = ({ plugin }, options, projectOptions) => {
  if (!options || typeof options !== 'object') {
    return false
  }

  // HTML模板处理服务
  Object.keys(projectOptions.pages).forEach((page) => {
    plugin.use(`html-${page}`, (args) => [Object.assign({}, args[0], options)])
  })
}
