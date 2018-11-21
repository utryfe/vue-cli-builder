const fileUtil = require('./file')

// 校验相关
module.exports = {
  // 是否是IP地址验证
  isIP(val) {
    return /^(?:(?:\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.){3}(?:\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/.test(
      val
    )
  },

  // 是否是路径
  isRelativePath(val, allowGlob) {
    val = typeof val === 'string' ? val.trim() : val
    if (allowGlob) {
      return fileUtil.isGlob(val) && /^\w+(?:[\\/]|$)/.test(val)
    }
    return /^(?:\w+[\\/])*\w+$/g.test(val)
  },
}
