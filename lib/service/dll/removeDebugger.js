// 移除debugger
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
        plugins: [['transform-remove-debugger', Object.assign({}, options)]],
      })
    )
}
