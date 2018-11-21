//

function getPageOptions(page, options) {
  const setup = {}
  Object.keys(options).forEach((pattern) => {
    if (page.match(pattern)) {
      Object.assign(setup, options[pattern])
    }
  })
  return setup
}

module.exports = ({ plugin }, options, projectOptions) => {
  if (!options || typeof options !== 'object') {
    return false
  }
  options = Object.assign({}, options)
  // HTML模板处理服务
  Object.keys(projectOptions.pages).forEach((page) => {
    plugin.use(`html-${page}`, (args) => [
      Object.assign({}, args[0], getPageOptions(page, options)),
    ])
  })
}
