//
module.exports = ({ plugin }, options, projectOptions) => {
  // HTML模板处理服务
  Object.keys(projectOptions.pages).forEach((page) => {
    plugin.use(`html-${page}`, (args) => [Object.assign({}, args[0], options)])
  })
}
