const fs = require('fs')
const url = require('url')
const { promisify } = require('util')

const express = require('express')
const serve = require('serve-handler')

const Plugin = require('../../plugin/index')
const logger = require('../../utils/logger')
const fileUtil = require('../../utils/file')
const commonUtil = require('../../utils/common')
const getEnv = require('../../utils/env')

const zipAssertsPath = 'node_modules/.assets/zip'
const reportAssetsPath = 'node_modules/.assets/report'

const stat = promisify(fs.stat)
const readdir = promisify(fs.readdir)
const readdirSync = fs.readdirSync

// 文件虚拟目录
const filesDir = '/__files'
// 报告虚拟目录
const reportDir = '/__report'
// 压缩包资源目录
const zipDir = '/__zip'

// 获取发布目录下的真实文件路径
function getDistFilePath(absolutePath, publicPath, servePath) {
  const normalPath = absolutePath.replace(/\\/g, '/')
  if (normalPath.indexOf(`${publicPath}/`) !== -1) {
    const filePath = fileUtil.relativePath(
      fileUtil.joinPath(servePath, `.${publicPath}`),
      absolutePath
    )
    if (!filePath || filePath.startsWith('..')) {
      return ''
    }
    return fileUtil.joinPath(servePath, filePath)
  }
  return absolutePath
}

// 静态资源文件服务器
function serveStaticResources(app, publicPath, servePath) {
  // 文件详细信息
  app.use(publicPath, (req, res) => {
    //
    const headers = []
    const reqUrl = req.url
    const filesUrl = `${publicPath}${reqUrl}`
    const reallyPath = getDistFilePath(
      fileUtil.joinPath(servePath, `.${filesUrl}`),
      publicPath,
      servePath
    )
    if (fileUtil.isDirectory(reallyPath)) {
      req.url = filesUrl
    } else if (fileUtil.existsSync(reallyPath)) {
      if (/\.html?$/i.test(reqUrl)) {
        // html文件以普通文本形式展示
        headers.push({
          source: reqUrl,
          headers: [
            {
              key: 'Content-Type',
              value: 'text/plain; charset=utf-8',
            },
          ],
        })
      }
    }

    //
    serve(
      req,
      res,
      {
        public: servePath,
        cleanUrls: false,
        headers,
      },
      {
        readdir: (file) => readdir(getDistFilePath(file, publicPath, servePath)),
        stat: (file) => stat(getDistFilePath(file, publicPath, servePath)),
      }
    )
  })

  return {
    type: 'Files',
    path: publicPath,
  }
}

// 报告文件静态资源服务器
function serveReportResources(app) {
  try {
    const absReportAssetsPath = fileUtil.resolvePath(reportAssetsPath)
    if (readdirSync(absReportAssetsPath).length) {
      // 报告资源
      app.use(reportDir, (req, res) => {
        serve(req, res, {
          public: absReportAssetsPath,
        })
      })

      return {
        type: 'Report',
        path: reportDir,
      }
    }
  } catch (e) {}
}

// 压缩文件静态资源服务器
function serveZipResources(app, publicPath) {
  try {
    const zipFiles = getEnv.ENV['UT_BUILD_APP_RESOURCE_ZIP_FILES']

    if (Array.isArray(zipFiles)) {
      const absZipAssetsPath = fileUtil.resolvePath(zipAssertsPath)
      fileUtil.mkdir(absZipAssetsPath)

      for (const file of zipFiles) {
        if (fileUtil.existsSync(file)) {
          fileUtil.copySingleFileSync(
            file,
            fileUtil.joinPath(absZipAssetsPath, fileUtil.getFileBaseName(file))
          )
        }
      }

      if (readdirSync(absZipAssetsPath).length) {
        const address = serveStaticResources(app, publicPath, absZipAssetsPath)
        if (address) {
          address.type = 'Zip'
        }
        return address
      }
    }
  } catch (e) {}
}

// web应用服务器
function serveApplication(app, publicPath, servePath) {
  // 应用路径
  app.use(publicPath, (req, res) => {
    serve(req, res, {
      public: servePath,
    })
  })

  // 非根路径部署时，跳转到统计信息页面
  if (publicPath !== '/') {
    app.all('/', (req, res) => {
      const headers = req.headers
      if (headers && headers.referer) {
        const parsed = url.parse(headers.referer)
        res.redirect(parsed.pathname.replace(/([^^])\/.*/g, '$1'))
      } else {
        res.redirect(publicPath)
      }
    })
  }
}

// 打印地址信息
async function printAddress(addresses, server, host, port, publicPath) {
  addresses = addresses.filter((item) => !!item)

  const maxStrLen = addresses.reduce((len, b) => Math.max(len, b.type.length), 7)

  let paths = ''

  addresses.forEach((addr, index) => {
    const { type, path } = addr
    paths += `${index ? '\n' : ''}  - ${`${type}:`.padEnd(maxStrLen + 1)} ${url.format({
      protocol: 'http',
      hostname: host,
      pathname: path,
      port,
    })}`
  })

  const appUrl = url.format({
    protocol: 'http',
    hostname: host,
    port,
    pathname: publicPath,
  })

  if (await commonUtil.copyToClipboard(appUrl)) {
    paths += '\n\nCopied network address to clipboard!'
  }

  await commonUtil.printListeningAddress(
    server,
    {
      title: 'Staging!\n',
      foot: paths,
      path: publicPath,
    },
    true
  )

  return appUrl
}

// 构建并预览命令
exports = module.exports = (api, projectOptions) => (args = {}, rawArgv = []) => {
  const service = process.VUE_CLI_SERVICE
  if (!service || typeof service.run !== 'function') {
    return Promise.resolve()
  }

  //
  args._ = args._ || []
  args._.unshift('build')
  rawArgv.unshift('build')

  // 命令模式
  args.mode = 'production'
  args.watch = false
  args.report = false
  args.open = false

  if (args.silent !== false) {
    args.silent = true
    rawArgv.push('--silent')
  }

  args['unsafe-inline'] = false
  rawArgv.push('--no-unsafe-inline')

  const rawArgs = require('minimist')(process.argv.slice(2))

  const open = rawArgs.open
  const build = rawArgs.build
  const dest = typeof rawArgs.dest === 'string' ? rawArgs.dest.trim() : ''

  //  清理文件
  fileUtil.removeSync(reportAssetsPath)
  fileUtil.removeSync(zipAssertsPath)

  const runTask =
    build !== false
      ? service.run('build', args, rawArgv).catch((error) => {
          console.log()
          logger.error(error ? error.message || error : 'Build failed.')
          console.log()
          process.exit(1)
        })
      : Promise.resolve()

  // 先执行产品构建
  return runTask.then(async () => {
    // 再创建资源服务器

    const { outputDir, publicPath } = projectOptions
    const servePath = fileUtil.resolvePath(dest || outputDir || 'dist')

    if (!fileUtil.existsSync(servePath)) {
      return
    }

    const app = express()

    // web应用
    serveApplication(app, publicPath, servePath)

    // 开启HTTP服务器
    const { server, host, port } = await commonUtil.createLocalHttpServer(
      { port: +args.port || 5000 },
      app,
      () => {
        logger.done('\nThe server has been successful closed.\n')
      }
    )

    const addresses = []
    addresses.push(serveStaticResources(app, filesDir, servePath))
    addresses.push(serveZipResources(app, zipDir))
    addresses.push(serveReportResources(app))

    const appUrl = await printAddress(addresses, server, host, port, publicPath)

    if (open !== false) {
      commonUtil.openBrowser(appUrl)
    }
  })
}

// 配置webpack
exports.chainWebpack = function(chainConfig, projectOptions) {
  const env = process.env
  const modernApp = !!env.VUE_CLI_MODERN_MODE
  const modernBuild = !!env.VUE_CLI_MODERN_BUILD
  const isLegacyBuild = modernApp && !modernBuild

  const reportFileName = {
    modern: 'index.html',
    legacy: 'legacy.html',
  }

  const bundleName = reportFileName[isLegacyBuild ? 'legacy' : 'modern']

  new Plugin({
    chainConfig,
    projectOptions,
  })
    .use(
      {
        configName: 'bundle-analyzer',
        pluginName: 'webpack-bundle-analyzer',
        getExportModule(module) {
          return module.BundleAnalyzerPlugin
        },
      },
      () => [
        {
          logLevel: 'warn',
          openAnalyzer: false,
          analyzerMode: 'static',
          reportFilename: fileUtil.resolvePath(reportAssetsPath, bundleName),
          generateStatsFile: false,
        },
      ]
    )
    // friendly-errors
    .use('^friendly-errors', (args) => [
      Object.assign({}, args[0], {
        onErrors(severity, errors) {
          if (severity !== 'error') {
            return
          }
          console.error()
          for (const err of errors) {
            console.error(err ? err.message : 'Build failed.')
            console.error()
          }
          process.exit(1)
        },
      }),
    ])
}

// 命令默认的构建模式
exports.defaultMode = 'production'
// 脚本命令名称
exports.script = 'stage'
// 命令帮助
exports.help = (options) => ({
  description: 'build for production and preview resources.',
  usage: 'vue-cli-service stage [options]',
  options: {
    '--dest': `specify output directory (default: ${options.outputDir})`,
    '--modern': `build app targeting modern browsers with auto fallback`,
    '--no-build': `do not run build before staging`,
    '--no-clean': `do not remove the dist directory before building the project`,
    '--no-open': `do not automatic open the browser while staging`,
  },
})
