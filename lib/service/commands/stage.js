const fs = require('fs')
const url = require('url')
const { promisify } = require('util')

const express = require('express')
const serve = require('serve-handler')

const ConfigService = require('../ConfigService')
const Plugin = require('../../plugin/index')
const logger = require('../../utils/logger')
const fileUtil = require('../../utils/file')
const commonUtil = require('../../utils/common')
const env = require('../../utils/env')

const zipAssetsPath = 'node_modules/.assets/zip'
const reportAssetsPath = 'node_modules/.assets/report'

const stat = promisify(fs.stat)
const readdir = promisify(fs.readdir)
const readdirSync = fs.readdirSync

// 资源压缩文件列表
const zipFiles = []
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
    const filesUrl = `${publicPath.replace(/\/+$/, '')}${reqUrl}`
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
function serveReportResources(app, publicPath) {
  try {
    const absReportAssetsPath = fileUtil.resolvePath(reportAssetsPath)
    if (readdirSync(absReportAssetsPath).length) {
      // 报告资源
      app.use(publicPath, (req, res) => {
        serve(req, res, {
          public: absReportAssetsPath,
        })
      })

      return {
        type: 'Report',
        path: publicPath,
      }
    }
  } catch (e) {}
}

// 压缩文件静态资源服务器
function serveZipResources(app, publicPath) {
  try {
    if (Array.isArray(zipFiles)) {
      const absZipAssetsPath = fileUtil.resolvePath(zipAssetsPath)
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

// 静态资源根路径重定向
function serveStaticRootRedirect(app, publicPath) {
  const staticResExp = new RegExp(`^(${[filesDir, reportDir, zipDir].join('|')})`)
  app.all('/', (req, res, next) => {
    const headers = req.headers
    const referer = headers ? headers.referer : ''
    if (referer) {
      const { pathname } = url.parse(referer)
      const matcher = staticResExp.exec(pathname)
      if (matcher) {
        res.redirect(matcher[1])
        return
      }
    }
    //
    if (publicPath !== '/') {
      res.redirect(publicPath)
      return
    }
    // 转至应用服务器中间件（根路径）
    next()
  })
}

// web应用服务器
function serveApplication(app, publicPath, servePath, historyApiFallback) {
  // html5 历史记录路由 404 服务
  if (!historyApiFallback) {
    historyApiFallback = env.args['history-api-fallback']
  }

  if (historyApiFallback) {
    let fallback = typeof historyApiFallback === 'object' ? historyApiFallback : null
    app.use(
      require('connect-history-api-fallback')(
        Object.assign(
          {
            index: `${publicPath.replace(/\/+$/, '')}/`,
          },
          fallback
        )
      )
    )
  }

  // web应用中间件服务
  app.use(publicPath, (req, res) => {
    serve(req, res, {
      public: servePath,
    })
  })
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

// 开启资源服务器
async function createServer(options) {
  //
  const {
    historyApiFallback,
    //
    port: exceptPort,
    outputPath,
    publicPath,
    open,
  } = options

  if (!fileUtil.existsSync(outputPath)) {
    logger.warn(
      `\nThere has no contents found within '${fileUtil.relativePath(
        process.cwd(),
        outputPath
      )}'\n`
    )

    return
  }

  const app = express()
  const addresses = []

  // 这里顺序要在应用前（中间件）
  addresses.push(serveZipResources(app, zipDir))
  addresses.push(serveReportResources(app, reportDir))
  addresses.push(serveStaticResources(app, filesDir, outputPath))

  // 静态资源根路径重定向
  serveStaticRootRedirect(app, publicPath)
  // web应用
  serveApplication(app, publicPath, outputPath, historyApiFallback)

  // 开启HTTP服务器
  const { server, host, port } = await commonUtil.createLocalHttpServer(
    { port: +exceptPort },
    app,
    () => {
      logger.done('\nThe server has been successful closed.\n')
    }
  )

  const appUrl = await printAddress(addresses, server, host, port, publicPath)

  if (open) {
    commonUtil.openBrowser(appUrl)
  }
}

// 自定义命令
exports = module.exports = (api, projectOptions) => async () => {
  //  清理文件
  fileUtil.removeSync(reportAssetsPath)
  fileUtil.removeSync(zipAssetsPath)

  const args = env.args
  const { dest, build = true, port = 5000, open = true } = args
  const { outputDir, publicPath, devServer } = projectOptions

  if (build) {
    process.env.UT_BUILD_DISABLE_NOTIFIER = true
    commonUtil.getZipFilesPath(projectOptions).forEach((file) => {
      zipFiles.push(file)
    })

    // 执行构建任务
    await require('../../utils/service').build(args)
  }

  const { historyApiFallback } = Object.assign({}, devServer)
  const outputPath = commonUtil.getOutputPath(outputDir, dest)

  // 创建资源服务器
  await createServer(
    Object.assign(
      {
        open: true,
        port: 5000,
      },
      {
        historyApiFallback,
        outputPath,
        publicPath,
        open,
        port,
      }
    )
  )
}

// 初始
exports.init = function() {
  ConfigService.addDefaultService(
    'compress',
    'node_modules/.assets/.zip/[name]-[version]'
  )
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
          const { BundleAnalyzerPlugin } = module
          return BundleAnalyzerPlugin
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
    '--history-api-fallback': 'served 404 responses when using the HTML5 History API',
  },
})
