const file = require('../../utils/file')
//
module.exports = function({ plugin }, options) {
  if (!options || (typeof options !== 'object' && !Array.isArray(options))) {
    return
  }
  // 拷贝静态资源服务
  plugin.use('copy', (args) => {
    const arg = Array.isArray(args[0]) ? args[0] : []
    if (Array.isArray(options)) {
      for (const task of options) {
        if (task && typeof task === 'object') {
          const { from, to } = task
          const copy = file.getValidCopyTask(from, to)
          if (copy) {
            arg.push(Object.assign(task, copy))
          }
        }
      }
    } else {
      Object.keys(options).forEach((from) => {
        // 字符串路径映射形式定义
        const copy = file.getValidCopyTask(from, options[from])
        if (copy) {
          arg.push(
            Object.assign(copy, {
              ignore: ['.*'],
            })
          )
        }
      })
    }
    return [arg]
  })
}
