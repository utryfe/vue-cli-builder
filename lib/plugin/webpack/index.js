const resolve = require('resolve')

function getWebpack(context) {
  return require(resolve.sync('webpack', { basedir: context || process.cwd() }))
}

module.exports = getWebpack()

module.exports.getContextWebpack = getWebpack
