const fs = require('fs')
const path = require('path')
const zipper = require('yazl')
const mkdir = require('make-dir')
const strUtil = require('../../utils/string')
const fileUtil = require('../../utils/file')
const logger = require('../../utils/logger')
const getEnv = require('../../utils/env')
const emitter = require('../../utils/emitter')

const CompilerEvent = require('./CompilerEvent')

// zip压缩
class ZipCompress {
  //
  constructor(options) {
    const env = getEnv()
    if (!Array.isArray(options)) {
      options = [options]
    }
    options = options.map((item) => {
      if (typeof item === 'string' && (item = item.trim())) {
        return { name: item }
      }
      return item
    })

    this.pkgName = env['npm_package_name']
    this.pkgVersion = env['npm_package_version']
    const zipTasks = []
    for (const task of options) {
      if (task && (task === true || typeof task === 'object')) {
        zipTasks.push(
          Object.assign(
            {
              // 拷贝路径
              copy: null,
              // 压缩包名称
              name: `[name]-[version].zip`,
            },
            task
          )
        )
      }
    }
    this.zipTasks = zipTasks
  }

  getZipFiles() {
    return this.zipTasks.map((task) => {
      const { name } = task
      let normalName = strUtil.filter(name, this.getNameFilter()).trim()
      if (!normalName.endsWith('.zip')) {
        normalName += '.zip'
      }
      return fileUtil.isAbsolute(normalName) ? normalName : path.resolve(normalName)
    })
  }

  apply(compiler) {
    this.compiler = compiler
    //
    new CompilerEvent(
      'ZipCompressWebpackPlugin',
      {
        done: this.exec,
      },
      this
    ).apply(compiler)
  }

  async exec() {
    const { compiler } = this
    const context = compiler.options.output.path
    const tasks = this.zipTasks
    //
    const zips = await Promise.all(tasks.map((task) => this.runTask(task, context)))

    emitter.emit('compress-complete', zips)
  }

  // 查找需要压缩的资源
  copyTargetPath(copyOptions, context) {
    const targets = []
    const tasks = []
    const cwd = {
      from: context,
      to: context,
    }
    if (Array.isArray(copyOptions)) {
      for (const task of copyOptions) {
        if (task && typeof task === 'object') {
          const { from, to } = task
          const copyTask = fileUtil.getValidCopyTask(from, to, cwd)
          if (copyTask) {
            tasks.push(copyTask)
          }
        }
      }
    } else if (typeof copyOptions === 'object') {
      Object.keys(copyOptions).forEach((from) => {
        // 字符串路径映射形式定义
        const task = fileUtil.getValidCopyTask(from, copyOptions[from], cwd)
        if (task) {
          tasks.push(task)
        }
      })
    }
    if (tasks.length) {
      // 拷贝资源到特定路径
      // 不执行实际拷贝，只进行路径变更
      const handler = (src, dest) => ({ src, dest })
      for (const task of tasks) {
        const { from, to } = task
        targets.push.apply(targets, fileUtil.copyFileSync(from, to, context, handler))
      }
    }
    return { files: targets, context }
  }

  // 取得需要压缩的资源路径列表
  getTargetFiles(copy, context, callback) {
    let targets = null
    if (copy) {
      // 指定了需要拷贝的资源
      targets = this.copyTargetPath(copy, context)
    } else {
      // 未指定资源，默认取输出目录下所有文件
      targets = {
        context,
        files: fileUtil.matchFileSync(`${context}/**/*`).map((path) => {
          path = fileUtil.resolvePath(path)
          return { src: path, dest: path }
        }),
      }
    }
    callback(targets)
  }

  // 执行压缩
  compress(targets, output, callback) {
    let { files, context } = targets
    if (files.length) {
      const sep = path.sep
      const zipFile = new zipper.ZipFile()
      context = fileUtil.isAbsolute(context) ? context : path.resolve(context)
      for (const file of files) {
        const { src, dest } = file
        if (fs.existsSync(src)) {
          const stat = fs.statSync(src)
          const metaPath = dest.replace(`${context}${sep}`, '')
          if (stat.isDirectory()) {
            if (!files.some((f) => f !== file && f.dest.indexOf(dest) !== -1)) {
              // 空目录
              zipFile.addEmptyDirectory(metaPath)
            }
          } else {
            // 文件
            zipFile.addFile(src, metaPath)
          }
        }
      }
      // 添加结束
      zipFile.end()
      // 输出打包文件
      zipFile.outputStream
        .pipe(fs.createWriteStream(output))
        // 压缩文件输出完成
        .on('close', callback)
    }
  }

  getNameFilter() {
    const now = new Date(+process.env.UT_BUILD_COMMAND_TIMESTAMP)
    const year = now.getFullYear()
    const month = `${now.getMonth() + 1}`.padStart(2, '0')
    const date = `${now.getDate()}`.padStart(2, '0')
    const hour = `${now.getHours()}`.padStart(2, '0')
    const minutes = `${now.getMinutes()}`.padStart(2, '0')
    const seconds = `${now.getSeconds()}`.padStart(2, '0')
    return {
      timestamp: +now,
      time: `${hour}${minutes}${seconds}`,
      date: `${year}${month}${date}`,
      datetime: `${year}${month}${date}${hour}${minutes}${seconds}`,
      version: this.pkgVersion,
      name: this.pkgName,
    }
  }

  // 执行压缩任务
  runTask(task, context) {
    const { name, copy } = task
    let normalName = strUtil.filter(name, this.getNameFilter()).trim()
    if (!normalName.endsWith('.zip')) {
      normalName += '.zip'
    }
    const output = fileUtil.isAbsolute(normalName) ? normalName : path.resolve(normalName)
    const dir = path.dirname(output)
    if (!fs.existsSync(dir)) {
      mkdir.sync(dir)
    } else if (fs.existsSync(output)) {
      const stat = fs.statSync(output)
      if (stat.isDirectory()) {
        logger.error(
          '\n[compress] The output file for compress can not be a directory.\n'
        )
        process.exit(1)
        return
      }
      // 删除已存在的文件
      fs.unlinkSync(output)
    }
    return new Promise((resolve) => {
      this.getTargetFiles(copy, context, (targets) => {
        // 压缩文件
        this.compress(targets, output, () => {
          resolve(output)
        })
      })
    })
  }
}

ZipCompress.default = ZipCompress
module.exports = ZipCompress
