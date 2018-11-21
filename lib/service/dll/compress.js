// 压缩
const fs = require('fs')
const path = require('path')
const zipper = require('yazl')
const rimraf = require('rimraf')
const file = require('../../utils/file')
const console = require('../../utils/console')

// 执行拷贝
function copy(options, context) {
  const targets = []
  const tempPath = fs.mkdtempSync('.tmp')
  const tasks = []
  const cwd = {
    from: context,
    to: tempPath,
  }
  if (Array.isArray(options)) {
    for (const task of options) {
      if (task && typeof task === 'object') {
        const { from, to } = task
        const copyTask = file.getValidCopyTask(from, to, cwd)
        if (copyTask) {
          tasks.push(copyTask)
        }
      }
    }
  } else if (typeof options === 'object') {
    Object.keys(options).forEach((from) => {
      // 字符串路径映射形式定义
      const task = file.getValidCopyTask(from, options[from], cwd)
      if (task) {
        tasks.push(task)
      }
    })
  }
  if (tasks.length) {
    // 拷贝资源到特定路径
    for (const task of tasks) {
      const { from, to } = task
      targets.push.apply(targets, file.copyFileSync(from, to, context))
    }
  }
  return { files: targets, cwd: tempPath, tmp: tempPath }
}

// 拷贝文件
function copyFile(options, projectOptions, callback) {
  const { copy: copyOptions } = Object.assign({}, options)
  const { outputDir } = projectOptions
  callback(
    copyOptions
      ? // 指定了需要拷贝的资源
        copy(copyOptions, outputDir)
      : // 未指定资源，默认取输出目录下所有文件
        {
          cwd: outputDir,
          files: file
            .matchFileSync(`${outputDir}/**/*`)
            .map((path) => file.resolvePath(path)),
        }
  )
}

// 压缩文件
function compress(targets, output, callback) {
  let { files, cwd } = targets
  if (files.length) {
    const zipFile = new zipper.ZipFile()
    cwd = path.isAbsolute(cwd) ? cwd : path.resolve(cwd)
    for (const file of files) {
      const stat = fs.statSync(file)
      const metaPath = file.replace(`${cwd}/`, '')
      if (stat.isDirectory()) {
        if (!files.some((f) => f !== file && f.indexOf(file) !== -1)) {
          // 空目录
          zipFile.addEmptyDirectory(metaPath)
        }
      } else {
        // 文件
        zipFile.addFile(file, metaPath)
      }
    }
    // 添加结束
    zipFile.end()
    // 输出打包文件
    zipFile.outputStream
      .pipe(fs.createWriteStream(output))
      // 压缩文件输出完成
      .on('close', () => {
        callback()
      })
  }
}

// 压缩产品包
module.exports = ({ plugin, isDev, env }, options, projectOptions) => {
  if (!options || isDev) {
    return
  }
  plugin.use('^compiler-event', (args) => {
    const arg = Object.assign({}, args[0])
    let { done } = arg
    if (!Array.isArray(done)) {
      done = typeof done === 'function' ? [done] : []
    }
    done.push(() => {
      const { name } = Object.assign({}, options)
      // 默认名称将版本号包含
      const zipName =
        name ||
        `${env['npm_package_name'] || 'dist'}-${env['npm_package_version']}.zip`
      const output = path.isAbsolute(zipName) ? zipName : path.resolve(zipName)
      if (fs.existsSync(output)) {
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
      // 拷贝文件
      return new Promise((resolve) => {
        console.log('Compressing...\n')
        copyFile(options, projectOptions, (targets) => {
          // 压缩文件
          compress(targets, output, () => {
            const done = (error) => {
              if (error) {
                console.error(error, true)
              }
              console.log(`Compress complete 👉 ${output}\n`)
              resolve()
            }
            let { tmp } = targets
            if (tmp) {
              // 清理临时目录
              rimraf(path.isAbsolute(tmp) ? tmp : path.resolve(tmp), done)
            } else {
              done()
            }
          })
        })
      })
    })
    arg['done'] = done
    return [arg]
  })
}
