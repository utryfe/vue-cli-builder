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

//
module.exports = ENV_SETUP
