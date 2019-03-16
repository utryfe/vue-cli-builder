const logger = require('../../utils/logger')
const fileUtil = require('../../utils/file')
const commonUtil = require('../../utils/common')

// 构建并预览命令
module.exports = (args = {}, rawArgv = [], projectOptions) => {
  const service = process.VUE_CLI_SERVICE
  if (service && typeof service.run === 'function') {
    //
    args._ = args._ || []
    args._.unshift('build')
    rawArgv.unshift('build')

    if (args.silent !== false) {
      // 默认的参数
      args.silent = true
      rawArgv.push('--silent')
    }

    // 命令模式
    args.mode = 'production'

    const open = args.o
    args.open = false

    // 先执行产品构建
    return service.run('build', args, rawArgv).then(async () => {
      //
      const { outputDir } = projectOptions
      const publicPath = fileUtil.resolvePath(outputDir || 'dist')
      //
      const serve = require('serve-handler')
      // 开启HTTP服务器
      //np
      const { server, ip, port } = await commonUtil.createLocalHttpServer(
        +args.port || 5000,
        async (req, res) => {
          await serve(req, res, {
            public: publicPath,
          })
        },
        () => {
          logger.done('\nThe server has been successful closed.\n')
        }
      )

      const address = `http://${ip}:${port}`
      const copied = await commonUtil.copyToClipboard(address)

      await commonUtil.printListeningAddress(
        server,
        {
          title: 'Staging!\n',
          foot: copied ? '\nCopied network address to clipboard!' : '',
        },
        true
      )

      if (open !== false) {
        commonUtil.openBrowser(address)
      }
    })
  }
}

// 命令默认的构建模式
module.exports.mode = 'production'
// 脚本命令名称
module.exports.command = 'stage'
