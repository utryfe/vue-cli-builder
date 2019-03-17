const path = require('path')
const minimist = require('minimist')
const cloneDeep = require('lodash').cloneDeep

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
const ENV = {
  UT_DATA_PROCESS_DEFINED: {},
}

function registerVariables(name, value) {
  ENV[name] = value
}

const rawArgv = process.argv.slice(2)
const args = minimist(rawArgv)

const pkg = require('./package')({ cwd: path.join(__dirname, '..', '..') })

//
module.exports = () => {
  // 已经转换的环境变量设置
  const ENV_SETUP = convert(process.env)

  const appData = {}

  ENV.UT_DATA_PROCESS_DEFINED = Object.assign(
    {},
    // 环境变量文件
    getAppData(ENV_SETUP, appData),
    // 命令行参数
    getAppData(convert(args), appData)
  )

  ENV_SETUP.UT_DATA_APP_DEFINED = appData

  // 当前已安装插件的版本
  ENV_SETUP.PLUGIN_VERSION =
    ENV_SETUP.npm_package_devDependencies_vue_cli_plugin_ut_builder ||
    ENV_SETUP.npm_package_dependencies_vue_cli_plugin_ut_builder

  ENV_SETUP.PLUGIN_NAME = pkg.name

  // 应用是否已配置
  ENV_SETUP.UT_BUILD_ENTRY_CONFIGURED = false
  // 构建入口设置
  ENV_SETUP.UT_BUILD_ENTRY_SETUP = {}
  // 构建入口项
  ENV_SETUP.UT_BUILD_ENTRY_POINTS = {}

  // 内部环境变量
  Object.assign(ENV_SETUP, ENV)

  ENV_SETUP.registerVariables = (name, value) => {
    registerVariables(name, value)
    ENV_SETUP[name] = value
  }

  ENV_SETUP.args = cloneDeep(args)
  ENV_SETUP.rawArgv = cloneDeep(rawArgv)

  return ENV_SETUP
}

// 注册插件环境变量
module.exports.registerVariables = registerVariables
// 命名行参数
module.exports.args = cloneDeep(args)
module.exports.rawArgv = cloneDeep(rawArgv)
// 内部环境变量
module.exports.ENV = ENV
