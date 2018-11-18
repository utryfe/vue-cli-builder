//
module.exports = {
  // 路径斜杆格式化
  ensureSlash(val) {
    if (typeof val === 'string') {
      if (!/^https?:/.test(val)) {
        val = val.replace(/^([^/.])/, '/$1')
      }
      return val.replace(/([^/])$/, '$1/')
    }
  },
  removeSlash(val) {
    if (typeof val === 'string') {
      return val.replace(/\/$/g, '')
    }
  },
}
