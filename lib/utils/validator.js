const fileUtil = require('./file')

// 校验相关
module.exports = exports = {
  // 是否是IP地址验证
  isIP(ip) {
    if (typeof ip !== 'string' || !/[^.]\.[^.]/.test(ip)) {
      return false
    }
    return /^(?:(?:\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.){3}(?:\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/.test(
      ip.trim()
    )
  },

  // 是否是域名
  isDomainName(name) {
    if (typeof name !== 'string') {
      return false
    }
    name = name.trim()
    if (name.length < 2 || name.length > 255 || !/[^.]\.[^.]/.test(name)) {
      return false
    }
    return /^(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.){0,126}(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9]))\.?$/i.test(
      name
    )
  },

  // 是否是本地路径
  isLocalPath(path) {
    if (typeof path !== 'string' || !(path = path.trim())) {
      return false
    }
    const { protocol } = require('parse-url')(path)
    if (protocol === 'file') {
      const { root } = require('path').parse(path)
      return !!root
    }
    return false
  },

  // 非空字符串
  isNotEmptyString(str) {
    return typeof str === 'string' && !!str.trim()
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
