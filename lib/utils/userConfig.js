const merge = require('lodash').merge
const path = require('path')

function loadUserConfig() {
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

const userConfig = loadUserConfig()

// 获取用户原始配置
module.exports = userConfig ? merge({}, userConfig) : null
