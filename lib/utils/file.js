const fs = require('fs')
const path = require('path')
const glob = require('glob')
const jsonPretty = require('json-stringify-pretty-compact')
const copy = require('fs-copy-file-sync')
const mkdir = require('make-dir')

const self = {
  // 解析路径（根据pwd）
  resolvePath(...args) {
    return path.resolve.apply(null, args)
  },

  // 连接路径
  joinPath(...args) {
    return path.join.apply(null, args)
  },

  // 获取目录名称
  getDirName(file, ...args) {
    if (path.isAbsolute(file)) {
      return path.dirname(file)
    }
    return path.dirname(path.resolve.apply(null, args.concat(file)))
  },

  // 根据路径模式获取文件的名称
  getFileName(pattern, options) {
    options = Object.assign({}, options)
    const { noExt } = options
    return self.matchFileSync(pattern, options).map((file) => {
      return self.getFileBaseName(file, noExt)
    })
  },

  // 根据路径获取文件名称
  getFileBaseName(file, noExt) {
    const name = file.replace(/(?:[^\\/]*?[\\/])*/g, '')
    return noExt && !name.startsWith('.') ? name.replace(/\..*$/g, '') : name
  },

  // 获取目录短名称（不包含路径）
  getShortDirName(file, ...args) {
    return self.getDirName
      .apply(null, [file].concat(args))
      .replace(/(?:[^\\/]*?[\\/])*/g, '')
  },

  // 根据模式匹配路径
  matchFileSync(pattern, options) {
    return glob.sync(pattern.trim(), Object.assign({ nodir: false }, options))
  },

  // 写文件
  writeFileSync(outputPath, data, json) {
    const output = self.resolvePath(outputPath)
    fs.writeFileSync(
      output,
      json ? jsonPretty(data, Object.assign({}, json)) : data
    )
    return output
  },

  // 是否是glob路径
  isGlob(pattern) {
    return (
      typeof pattern === 'string' &&
      (/[*!?{}(|)[\]]/.test(pattern) || /[@?!+*]\(/.test(pattern))
    )
  },

  //执行拷贝操作
  execCopy(src, dest) {
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
      mkdir.sync(dest)
    } else {
      const dir = path.dirname(dest)
      if (!fs.existsSync(dir)) {
        mkdir.sync(dir)
      }
      copy(src, dest)
    }
    return dest
  },

  // 同步拷贝文件
  copyFileSync(paths, destDir, context, copyHandler) {
    if (!Array.isArray(paths)) {
      paths = [paths]
    }
    const files = []
    const targets = []
    for (const src of paths) {
      if (self.isGlob(src)) {
        files.push.apply(
          files,
          self.matchFileSync(src, {
            nodir: false,
          })
        )
      } else {
        files.push(path.resolve(src))
      }
    }
    if (files.length) {
      destDir = path.resolve(destDir)
      if (context) {
        if (!path.isAbsolute(context)) {
          context = path.resolve(context)
        }
      } else {
        context = process.cwd()
      }
      copyHandler =
        typeof copyHandler === 'function' ? copyHandler : self.execCopy
      for (const file of files) {
        // 转换为绝对路径
        const srcFile = path.isAbsolute(file) ? file : path.resolve(file)
        const destFile = `${destDir}${srcFile.replace(context, '')}`
        targets.push(copyHandler(srcFile, destFile))
      }
    }
    return targets
  },

  // 取得复制任务对象
  getValidCopyTask(from, to, cwd) {
    let task = null
    if (typeof from === 'string' && typeof to === 'string') {
      from = from.trim()
      to = to.trim()
      if (from && to) {
        task = {}
        if (path.isAbsolute(from)) {
          task.from = from
        } else if (self.isGlob(from)) {
          task.from = cwd
            ? `${typeof cwd === 'object' ? cwd.from : cwd}/${from}`
            : from
        } else if (cwd) {
          task.from = path.join(typeof cwd === 'object' ? cwd.from : cwd, from)
        } else {
          task.from = path.resolve(from)
        }
        if (self.isGlob(to)) {
          throw `[copy] Dest file can not be a glob path. (${to})`
        }
        if (cwd) {
          task.to = path.join(typeof cwd === 'object' ? cwd.to : cwd, to)
        } else {
          task.to = path.resolve(to)
        }
      }
    }
    return task
  },
}

module.exports = self
