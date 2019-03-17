const { promisify } = require('util')
const { stat, readdir } = require('fs')
const url = require('url')

const Plugin = require('../../plugin/index')
const logger = require('../../utils/logger')
const fileUtil = require('../../utils/file')
const commonUtil = require('../../utils/common')
const getEnv = require('../../utils/env')

// 报告文件信息
const reportAssetsPath = 'node_modules/.assets/report'
const reportFileName = {
  modern: 'index.html',
  legacy: 'legacy.html',
}

// 清理报告文件
function clearReportFile() {
  return Object.values(reportFileName).map((file) => {
    const path = fileUtil.resolvePath(reportAssetsPath, file)
    fileUtil.removeSync(path)
    return path
  })
}

// 构建并预览命令
module.exports = (api, projectOptions) => (args = {}, rawArgv = []) => {
  const service = process.VUE_CLI_SERVICE
  if (service && typeof service.run === 'function') {
    //
    args._ = args._ || []
    args._.unshift('build')
    rawArgv.unshift('build')

    // 命令模式
    args.mode = 'production'
    args.watch = false
    args.report = false
    args.open = false
    args.clean = true

    if (args.silent !== false) {
      args.silent = true
      rawArgv.push('--silent')
    }

    args['unsafe-inline'] = false
    rawArgv.push('--no-unsafe-inline')

    const open = require('minimist')(getEnv.rawArgv).open

    //  清理报告文件
    clearReportFile()

    // 先执行产品构建
    return service
      .run('build', args, rawArgv)
      .catch((error) => {
        console.log()
        logger.error(error ? error.message || error : 'Build failed.')
        console.log()
        process.exit(1)
      })
      .then(async () => {
        // 再创建资源服务器

        const { outputDir, publicPath } = projectOptions
        const servePath = fileUtil.resolvePath(outputDir || 'dist')

        const express = require('express')
        const app = express()
        const serve = require('serve-handler')
        const getStat = promisify(stat)
        const readDir = promisify(readdir)
        const statsDir = '/__files'

        // 获取真实文件路径
        const getReallyPath = (absolutePath) => {
          const normalPath = absolutePath.replace(/\\/g, '/')
          if (normalPath.indexOf(`${statsDir}/`) !== -1) {
            const filePath = fileUtil.relativePath(
              fileUtil.joinPath(servePath, `.${statsDir}`),
              absolutePath
            )
            if (!filePath || filePath.startsWith('..')) {
              return ''
            }
            return fileUtil.joinPath(servePath, filePath)
          }
          return absolutePath
        }

        // 文件详细信息
        app.use(statsDir, (req, res) => {
          //
          const headers = []
          const reqUrl = req.url
          const statsUrl = `${statsDir}${reqUrl}`
          const reallyPath = getReallyPath(fileUtil.joinPath(servePath, `.${statsUrl}`))
          if (fileUtil.isDirectory(reallyPath)) {
            req.url = statsUrl
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

          // 静态资源服务
          serve(
            req,
            res,
            {
              public: servePath,
              cleanUrls: false,
              headers,
            },
            {
              readdir(absolutePath) {
                const reallyPath = getReallyPath(absolutePath)
                return readDir(reallyPath)
              },
              stat(absolutePath) {
                const reallyPath = getReallyPath(absolutePath)
                return getStat(reallyPath)
              },
            }
          )
        })

        // 报告文件
        const reportDir = '/__report'
        app.use(reportDir, (req, res) => {
          serve(req, res, {
            public: fileUtil.resolvePath(reportAssetsPath),
          })
        })

        // 应用路径
        app.use(publicPath, (req, res) => {
          serve(req, res, {
            public: servePath,
          })
        })

        // 非根路径部署时，跳转到统计信息页面
        if (publicPath !== '/') {
          app.all('/', (req, res) => {
            res.redirect('/__stats')
          })
        }

        // 开启HTTP服务器
        const { server, host, port } = await commonUtil.createLocalHttpServer(
          { port: +args.port || 5000 },
          app,
          () => {
            logger.done('\nThe server has been successful closed.\n')
          }
        )

        // 打印地址信息
        const address = url.format({
          protocol: 'http',
          hostname: host,
          port,
          pathname: publicPath,
        })
        const copied = await commonUtil.copyToClipboard(address)

        let footMessage = `  - Files:   ${url.format({
          protocol: 'http',
          hostname: host,
          port,
          pathname: statsDir,
        })}`

        footMessage += `\n  - Report:  ${url.format({
          protocol: 'http',
          hostname: host,
          port,
          pathname: reportDir,
        })}\n`

        if (copied) {
          footMessage += '\nCopied network address to clipboard!'
        }

        await commonUtil.printListeningAddress(
          server,
          {
            title: 'Staging!\n',
            foot: footMessage,
            path: publicPath,
          },
          true
        )

        if (open !== false) {
          commonUtil.openBrowser(address)
        }
      })
  }
}

// 配置webpack
module.exports.chainWebpack = function(chainConfig, projectOptions) {
  const env = process.env
  const modernApp = !!env.VUE_CLI_MODERN_MODE
  const modernBuild = !!env.VUE_CLI_MODERN_BUILD
  const isLegacyBuild = modernApp && !modernBuild
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
module.exports.mode = 'production'
// 脚本命令名称
module.exports.command = 'stage'
