//
module.exports = exports = {
  // 开头斜杆处理
  ensureSlash(val) {
    if (typeof val === 'string') {
      if (!/^https?:/.test(val)) {
        val = val.replace(/^([^/.])/, '/$1')
      }
      return val.replace(/([^/])$/, '$1/')
    }
  },
  // 移除结尾斜杆
  removeSlash(val) {
    if (typeof val === 'string') {
      return val.replace(/\/$/g, '')
    }
  },
  // 过滤字符串
  filter(str, data, pattern) {
    if (str && data && typeof str === 'string' && typeof data === 'object') {
      const { open, close } = Object.assign(
        {
          open: '[',
          close: ']',
        },
        pattern
      )
      return str.replace(
        new RegExp(`(.?)\\${open}\\s*(.*?)\\s*(\\\\|)${close}`, 'g'),
        (input, g1, g2, g3) => {
          if (g1 === '\\' || g3 === '\\') {
            // 反斜杠转义，不做处理
            return g1 === '\\' ? input.substr(1) : input
          }
          if (!g2) {
            // 没有变量名
            return g1
          }
          let val = data[g2]
          if (val === undefined) {
            val = ''
          }
          return `${g1}${val}`
        }
      )
    }
    return `${str}`
  },
}
