// 移除console
module.exports = ({ config, merge, isPro }, options) => {
  if (!options || !isPro) {
    return false
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
