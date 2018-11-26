// 移除console
module.exports = ({ config, merge, isDev }, options) => {
  if (!options || isDev) {
    return
  }
  config.module
    .rule('js')
    .use('babel-loader')
    .loader('babel-loader')
    .tap((options) =>
      merge(options, {
        plugins: [['transform-remove-console', Object.assign({}, options)]],
      })
    )
}
