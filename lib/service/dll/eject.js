const console = require('../../utils/console')
const file = require('../../utils/file')

// 输出文件
function write(path, data, isWebpack) {
  try {
    console.log(
      `Your ${
        isWebpack ? 'webpack' : 'vue-cli'
      } configuration 👉 ${file.writeFileSync(
        path && typeof path === 'string'
          ? path
          : `${isWebpack ? 'build.webpack.js' : 'build.vue-cli.json'}`,
        data,
        !isWebpack
      )}\n`
    )
  } catch (e) {
    console.error(e, true)
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
      if (/^webpack:/i.test(path)) {
        // 导出webpack配置
        write(
          path.replace(/^webpack:(\/\/)?/i, ''),
          `module.exports = ${config.toString()}`,
          true
        )
      } else {
        // 导出vue-cli配置
        write(path, projectOptions, false)
      }
    }
  }
}

// 输出配置文件
module.exports = ({ config, plugin }, options, projectOptions) => {
  // 使用编译器事件插件，监听webpack的开始编译事件
  plugin.use('^compiler-event', (args) => {
    const arg = Object.assign({}, args[0])
    let { 'entry-option': start } = arg
    if (!Array.isArray(start)) {
      start = typeof start === 'function' ? [start] : []
    }
    start.push(() => execTask(config, options, projectOptions))
    arg['entry-option'] = start
    return [arg]
  })
}
