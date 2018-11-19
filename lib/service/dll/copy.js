const file = require('../../utils/file')
//
module.exports = function({ plugin }, options) {
  // 拷贝静态资源服务
  plugin.use('copy', (args) => {
    const arg = Array.isArray(args[0]) ? args[0] : []
    if (Array.isArray(options)) {
      for (const task of options) {
        if (task && typeof task === 'object') {
          // 对象完整配置
          arg.push(
            Object.assign(task, {
              from: file.resolvePath(task.from),
              to: file.resolvePath(task.to),
            })
          )
        }
      }
    } else {
      Object.keys(options).forEach((from) => {
        // 字符串路径映射形式定义
        arg.push({
          from: file.resolvePath(from),
          to: file.resolvePath(options[from]),
          ignore: ['.*'],
        })
      })
    }
    return [arg]
  })
}
