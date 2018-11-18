const path = require('path')
const glob = require('glob')

const self = {
  // 解析路径（根据pwd）
  resolvePath(...args) {
    return path.resolve(...args)
  },

  // 连接路径
  joinPath(...args) {
    return path.join(...args)
  },

  // 获取目录名称
  getDirName(file, ...args) {
    if (path.isAbsolute(file)) {
      return path.dirname(file)
    }
    return path.dirname(path.resolve(...args.concat(file)))
  },

  // 获取目录短名称（不包含路径）
  getShortDirName(file, ...args) {
    return self
      .getDirName(...[file].concat(args))
      .replace(/(?:[^\\/]*?[\\/])*/g, '')
  },

  // 根据模式匹配路径
  matchFileSync(pattern, options) {
    return glob.sync(
      pattern.trim(),
      Object.assign(
        {
          nodir: true,
        },
        options
      )
    )
  },
}

module.exports = self
