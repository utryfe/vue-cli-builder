const clone = require('lodash.clonedeep')
const path = require('path')

function load() {
  let fileConfig = null
  let pkgConfig = null
  try {
    fileConfig = require(path.resolve('vue.config.js'))
    if (!fileConfig || typeof fileConfig !== 'object') {
      fileConfig = null
    }
  } catch (e) {}
  if (!fileConfig) {
    try {
      pkgConfig = require(path.resolve('package.json')).vue
      if (!pkgConfig || typeof pkgConfig !== 'object') {
        pkgConfig = null
      }
    } catch (e) {}
  }
  return fileConfig || pkgConfig
}

// 获取用户原始配置
module.exports = clone(load())
