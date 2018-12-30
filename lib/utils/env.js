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

// 插件环境变量
const ENV = {}

//
module.exports = () => {
  // 已经转换的环境变量设置
  const ENV_SETUP = Object.assign(
    {
      HTML_TEMPLATE: 'public/index.html',
      MPA_ENTRY: 'src/pages/*/main.js',
      SPA_ENTRY: 'src/main.js',
      // BUILD_MPA: env.BUILD_MPA,
      // BUILD_SPA: env.BUILD_SPA,
    },
    convert(process.env)
  )

  const {
    // HTML模板文件
    HTML_TEMPLATE,
    // 多页应用入口脚本
    MPA_ENTRY,
    // 单页应用入口脚本
    SPA_ENTRY,
    // 是否构建多页应用
    BUILD_MPA,
    // 是否构建单页应用
    BUILD_SPA,
    //
  } = ENV_SETUP

  ENV_SETUP.entry = {
    HTML_TEMPLATE,
    MPA_ENTRY,
    SPA_ENTRY,
    BUILD_MPA,
    BUILD_SPA,
  }

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
