const path = require('path')
const fs = require('fs')
const { fork } = require('child_process')
//
const webpack = require(path.resolve('node_modules/webpack'))
const chalk = require('chalk')
const ConcatPlugin = require('webpack-concat-plugin')
//
const debug = require('debug')('plugin:DllReference')
//
const CompilerEvent = require('../CompilerEvent')
//
const getPackage = require('../../../utils/package')
const commonUtil = require('../../../utils/common')
const fileUtil = require('../../../utils/file')
const logger = require('../../../utils/logger')
const config = require('./config.dll')

let cachedDeps = null
let cachedBundles = null

class DllReference {
  //
  constructor(options) {
    this.options = options = Object.assign({}, options)
    this.context = options.context || process.cwd()
  }

  // 应用插件
  apply(compiler) {
    //
    new CompilerEvent(
      'CachedDllRefWebpackPlugin',
      {
        beforeRun: this.run,
        watchRun: this.run,
      },
      // context
      this
    ).apply(compiler)
  }

  //
  async run(compiler) {
    if (this.initialized) {
      return
    }
    this.initialized = true
    try {
      debug('execute dll.')
      // 创建链接库
      const bundles = await this.generateDllBundles()
      if (bundles.length) {
        //
        for (const bundle of bundles) {
          const { context, absManifestPath: manifest } = bundle
          // 添加链接库引用插件
          new webpack.DllReferencePlugin({
            //
            context,
            manifest,
            //
          }).apply(compiler)
          //
        }
        const isProd = process.env.NODE_ENV === 'production'
        const { assetsDir } = this.options
        // 合并dll
        new ConcatPlugin({
          uglify: isProd,
          outputPath: path.relative(process.cwd(), assetsDir),
          fileName: isProd ? 'vendor.dll.[hash:8].js' : 'vendor.dll.js',
          filesToConcat: bundles.map(({ absFilePath }) => absFilePath),
          //
        }).apply(compiler)
      }
    } catch (e) {
      debug(e.message)
    }
  }

  // 获取依赖信息
  getDependencies() {
    if (cachedDeps) {
      return Object.assign({}, cachedDeps)
    }
    // 应用缓存，可能存在二次构建
    cachedDeps = {}
    // 构建依赖列表
    const context = this.context
    const { dependencies: deps } = getPackage({ cwd: context })
    if (deps && typeof deps === 'object') {
      //
      Object.keys(deps).forEach((dep) => {
        try {
          const module = path.join(context, 'node_modules', dep)
          // 依赖需与依赖版本相关
          const { version } = getPackage({ cwd: module })
          //
          cachedDeps[dep] = {
            module,
            version,
          }
        } catch (e) {}
      })
    }
    return Object.assign({}, cachedDeps)
  }

  // 生成链接库
  async generateDllBundles() {
    if (cachedBundles) {
      return [...cachedBundles]
    }
    // 可能二次构建，缓存bundle信息
    cachedBundles = []
    //
    const entries = []
    const context = this.context
    const output = config.outputDir
    const deps = this.getDependencies()
    //
    Object.keys(deps).forEach((name) => {
      const { version } = deps[name]
      const filename = `${commonUtil.hash(`${name}@${version}`, 0, true)}`
      const absFilePath = path.join(output, filename)
      const manifest = `${filename}.manifest.json`
      const absManifestPath = path.join(output, manifest)
      //
      cachedBundles.push({
        name,
        context,
        version,
        filename,
        manifest,
        absFilePath,
        absManifestPath,
      })
      // 如果不存在链接文件或清单文件，则需重新构建连接库
      if (!fs.existsSync(absFilePath) || !fs.existsSync(absManifestPath)) {
        entries.push({
          name,
          filename,
        })
      }
    })
    // 创建动态链接文件
    await this.makeDllBundle(entries, output).then(debug)
    // 当前已链接的bundles
    return [...cachedBundles]
  }

  // 进度打印
  logWithSpinner(msg) {
    const spinner = this.spinner
    if (!spinner) {
      return
    }
    spinner.text = `${chalk.cyan('[DLL]')} ${msg}`
    spinner.start()
  }

  // 执行dll依赖打包
  makeDllBundle(entries, output) {
    // 没有需要重新构建的链接库，则成功返回
    if (!entries.length) {
      return Promise.resolve('No entry files need to be packaged.')
    }
    if (!fs.existsSync(output)) {
      fileUtil.mkdir(output)
    }
    //
    const context = this.context
    //
    return new Promise((resolve, reject) => {
      this.spinner = logger.logWithSpinner()
      // 使用子进程生成动态链接文件
      const forked = fork(path.join(__dirname, 'fork'), [], {
        cwd: context,
        execArgv: [],
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: {
          // 此环境变量设置后，执行环境中本插件不执行额外操作
          BUILD_DLL_REFERENCE_FORK: true,
          NODE_ENV: 'production',
        },
      })
      // 接收子进程构建结果消息
      forked.on('message', (message) => {
        const { type, payload } = message
        if (type === 'progress') {
          const { percent, message: msg } = Object.assign({}, payload)
          // 进度消息
          this.logWithSpinner(`${Math.floor(percent * 100)}% ${msg}`)
        } else if (type === 'failed') {
          //
          this.spinner.fail('Errors occurred while build for DLL.\n')
          this.spinner = null
          // 构建失败
          reject(new Error('Build for dll failed.'))
          //
        } else if (type === 'done') {
          this.spinner.succeed('Build for DLL successful.\n')
          this.spinner = null
          // 关闭子进程
          forked.send({
            type: 'close',
          })
          resolve()
        }
      })
      // 进度提示开启
      this.logWithSpinner('0% building')
      // 通知子进程生成dll文件
      forked.send({
        type: 'build',
        payload: {
          context,
          entry: entries.reduce((entry, { name, filename }) => {
            entry[filename] = [name]
            return entry
          }, {}),
          output: {
            path: output,
            filename: '[name]',
            library: '[name]',
          },
        },
      })
      //
    })
  }
}

DllReference.default = DllReference
module.exports = DllReference
