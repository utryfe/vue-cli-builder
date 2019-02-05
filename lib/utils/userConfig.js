const merge = require('lodash').merge
const path = require('path')
const readPack = require('./package')

function loadUserConfig() {
  let fileConfig = null
  let pkgConfig = null
  try {
    const configPath = path.resolve('vue.config.js')
    // 去掉缓存，重新加载
    for (const cachedPath of Object.keys(require.cache)) {
      if (cachedPath === configPath) {
        delete require.cache[cachedPath]
        break
      }
    }
    fileConfig = require(configPath)
    if (!fileConfig || typeof fileConfig !== 'object') {
      fileConfig = null
    }
  } catch (e) {}
  if (!fileConfig) {
    try {
      pkgConfig = readPack().vue
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
