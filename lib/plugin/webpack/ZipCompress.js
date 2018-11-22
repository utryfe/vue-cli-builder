const fs = require('fs')
const path = require('path')
const zipper = require('yazl')
const mkdir = require('make-dir')
const file = require('../../utils/file')
const console = require('../../utils/console')
const getEnv = require('../../utils/env')

// zip压缩
class ZipCompress {
  //
  constructor(options) {
    const env = getEnv()
    if (!Array.isArray(options)) {
      options = [options]
    }
    const zipTasks = []
    for (const task of options) {
      if (task && (task === true || typeof task === 'object')) {
        zipTasks.push(
          Object.assign(
            {
              // 拷贝路径
              copy: null,
              // 压缩包名称
              name: `${env['npm_package_name'] || 'dist'}-${
                env['npm_package_version']
              }.zip`,
            },
            task
          )
        )
      }
    }
    this.zipTasks = zipTasks
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
          const copyTask = file.getValidCopyTask(from, to, cwd)
          if (copyTask) {
            tasks.push(copyTask)
          }
        }
      }
    } else if (typeof copyOptions === 'object') {
      Object.keys(copyOptions).forEach((from) => {
        // 字符串路径映射形式定义
        const task = file.getValidCopyTask(from, copyOptions[from], cwd)
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
        targets.push.apply(
          targets,
          file.copyFileSync(from, to, context, handler)
        )
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
        files: file.matchFileSync(`${context}/**/*`).map((path) => {
          path = file.resolvePath(path)
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
      const zipFile = new zipper.ZipFile()
      context = path.isAbsolute(context) ? context : path.resolve(context)
      for (const file of files) {
        const { src, dest } = file
        if (fs.existsSync(src)) {
          const stat = fs.statSync(src)
          const metaPath = dest.replace(`${context}/`, '')
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

  // 执行压缩任务
  runTask(task, context) {
    const { name, copy } = task
    // 默认名称为npm包名加版本号
    const output = path.isAbsolute(name) ? name : path.resolve(name)
    const dir = path.dirname(output)
    if (!fs.existsSync(dir)) {
      mkdir.sync(dir)
    } else if (fs.existsSync(output)) {
      const stat = fs.statSync(output)
      if (stat.isDirectory()) {
        console.error(
          '[compress] The output file for compress can not be a directory.'
        )
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

  // 应用插件
  apply(compiler) {
    compiler.plugin('done', () => {
      console.log('Start compressing...\n')
      const context = compiler.options.output.path
      const tasks = this.zipTasks
      return Promise.all(tasks.map((task) => this.runTask(task, context))).then(
        (zips) => {
          zips.forEach((zip, index) =>
            console.log(
              `Compress complete 👉 ${zip}${
                index === zips.length - 1 ? '\n' : ''
              }`
            )
          )
        }
      )
    })
  }
}

ZipCompress.default = ZipCompress
module.exports = ZipCompress
