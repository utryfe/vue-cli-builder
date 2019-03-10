const jsonPretty = require('json-stringify-pretty-compact')
const logger = require('../../utils/logger')
const file = require('../../utils/file')

// 输出文件
function write(path, data, isWebpack) {
  try {
    logger.log(
      `Your ${isWebpack ? 'webpack' : 'vue-cli'} configuration 🧾 ${file.writeFileSync(
        path && typeof path === 'string'
          ? path
          : `build/${isWebpack ? 'webpack.config.js' : 'vue.config.json'}`,
        data
      )}\n`
    )
  } catch (e) {
    logger.error(e)
  }
}

// 执行生成任务
function execTask(config, options, projectOptions) {
  // 编译开始
  // 输出配置文件
  if (!Array.isArray(options)) {
    // 可支持生成多个文件
    options = [options]
  }
  for (let path of options) {
    if (typeof path === 'string') {
      path = path.trim()
    }
    if (path) {
      if (/^webpack/i.test(path)) {
        // 导出webpack配置
        write(
          path.replace(/^webpack(?::\/\/)?/i, ''),
          `module.exports = ${config.toString()}`,
          true
        )
      } else {
        // 导出vue-cli配置
        write(path, jsonPretty(projectOptions), false)
      }
    }
  }
}

// 输出配置文件
module.exports = ({ config, plugin }, options, projectOptions) => {
  if (options !== true && typeof options !== 'string') {
    return false
  }

  // 使用编译器事件插件，监听webpack的开始编译事件
  plugin.use(
    {
      pluginName: 'CompilerEvent',
      configName: 'eject-config',
    },
    () => [
      'EjectConfigWebpackPlugin',
      {
        entryOption: () => execTask(config, options, projectOptions),
      },
    ]
  )
}
