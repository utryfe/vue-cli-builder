// 注册babel转译

module.exports = (opts) => {
  //
  const { NODE_ENV } = require('../../utils/env')()
  if (NODE_ENV !== 'test') {
    let { only, ignore, babelPreset } = Object.assign({}, opts)
    if (!babelPreset) {
      babelPreset = [
        require.resolve('@babel/preset-env'),
        {
          targets: {
            node: 'current',
          },
        },
      ]
    }
    require('@babel/register')({
      presets: [babelPreset],
      only,
      ignore,
      babelrc: false,
      cache: false,
    })
  }
}
