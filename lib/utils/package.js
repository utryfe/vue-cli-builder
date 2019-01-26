//
const cache = {}

module.exports = (options) => {
  options = Object.assign({ cwd: process.cwd() }, options)
  const { cwd } = options
  if (!cache[cwd]) {
    cache[cwd] = require('read-pkg').sync(options)
  }
  return Object.assign({}, cache[cwd])
}
