const minimist = require('minimist')
const pkg = require('../../package')

// 转换环境变量值类型
function convert(env) {
  return Object.keys(env).reduce((values, name) => {
    let value = env[name]
    let matcher
    if (value === undefined || /^\s*undefined\s*$/.test(value)) {
      values[name] = undefined
    } else if (value === null || /^\s*null\s*$/.test(value)) {
      values[name] = null
    } else if (/^\s*$/.test(value)) {
      values[value] = ''
    } else if ((matcher = /^\s*(true|false)\s*$/.exec(value))) {
      values[name] = matcher[1] === 'true'
    } else if (!isNaN(value)) {
      values[name] = +value
    } else {
      try {
        values[name] = JSON.parse(value)
      } catch (e) {
        values[name] = value
      }
    }
    return values
  }, {})
}

function getAppData(env, appData) {
  return Object.keys(env).reduce((values, key) => {
    const matcher = /^(vue_)?(app_.+)$/i.exec(key)
    if (matcher) {
      const val = env[key]
      values[key] = val
      values[key.toLowerCase()] = val
      values[key.toUpperCase()] = val
      if (matcher[1]) {
        key = matcher[2]
        values[key] = val
        values[key.toLowerCase()] = val
        values[key.toUpperCase()] = val
      }
      appData[key.toUpperCase()] = val
    }
    return values
  }, {})
}

// 插件环境变量
const ENV = {}

const argv = minimist(process.argv.slice(2))

//
module.exports = () => {
  // 已经转换的环境变量设置
  const ENV_SETUP = Object.assign(
    {
      BUILD_HTML_TEMPLATE: 'public/index.html',
      BUILD_MPA_ENTRY: 'src/pages/*/main.js',
      BUILD_SPA_ENTRY: 'src/main.js',
      // BUILD_MPA: env.BUILD_MPA,
      // BUILD_SPA: env.BUILD_SPA,
    },
    convert(process.env)
  )

  const {
    // HTML模板文件
    BUILD_HTML_TEMPLATE,
    // 多页应用入口脚本
    BUILD_MPA_ENTRY,
    // 单页应用入口脚本
    BUILD_SPA_ENTRY,
    // 是否构建多页应用
    BUILD_MPA,
    // 是否构建单页应用
    BUILD_SPA,
    //
  } = ENV_SETUP

  ENV_SETUP.entry = {
    BUILD_HTML_TEMPLATE,
    BUILD_MPA_ENTRY,
    BUILD_SPA_ENTRY,
    BUILD_MPA,
    BUILD_SPA,
  }

  const appData = {}

  ENV_SETUP.APP_DATA = Object.assign(
    {},
    // 环境变量文件
    getAppData(ENV_SETUP, appData),
    // 命令行参数
    getAppData(convert(argv), appData)
  )

  ENV_SETUP.appData = appData

  // 当前已安装插件的版本
  ENV_SETUP.PLUGIN_VERSION =
    ENV_SETUP.npm_package_devDependencies_vue_cli_plugin_ut_builder ||
    ENV_SETUP.npm_package_dependencies_vue_cli_plugin_ut_builder

  ENV_SETUP.PLUGIN_NAME = pkg.name

  // 应用是否已配置
  ENV_SETUP.APP_CONFIGURED = false

  // 同步至插件内部环境变量
  Object.assign(ENV, ENV_SETUP.entry, {
    PLUGIN_NAME: ENV_SETUP.PLUGIN_NAME,
    PLUGIN_VERSION: ENV_SETUP.PLUGIN_VERSION,
  })
  Object.assign(ENV_SETUP, ENV)

  return ENV_SETUP
}

// 注册插件环境变量
module.exports.registerVariables = (name, value) => (ENV[name] = value)
