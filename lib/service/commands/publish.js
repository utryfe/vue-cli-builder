const chalk = require('chalk')

const validator = require('../../utils/validator')
const commonUtil = require('../../utils/common')
const logger = require('../../utils/logger')
const env = require('../../utils/env')

const ConfigService = require('../ConfigService')

// 终端查询配置
const questions = {
  path: {
    type: 'string',
    question: {
      name: 'path',
      message: 'Please enter the deploy path upon server:',
      filter: (answer) => answer.trim(),
      validate: (answer) =>
        validator.isLocalPath(answer) || 'Invalid deploy path, please re-enter it',
    },
  },
}

// 自定义命令
exports = module.exports = (api, projectOptions) => async (args) => {
  let { build = true, path: deployPath } = args
  const zipFiles = []

  // 执行构建
  if (build) {
    process.env.UT_BUILD_DISABLE_NOTIFIER = true
    commonUtil.getZipFilesPath(projectOptions).forEach((file) => {
      zipFiles.push(file)
    })
    await require('../../utils/service').build(env.args)
  }

  if (!zipFiles.length) {
    logger.done(
      `\n${chalk.red(
        'There is no resources to be published. You must enable the build operation when doing publish. (remove: --no-build)'
      )}\n`
    )
    process.exit(0)
  }

  // 创建ssh服务器连接
  const { connect } = require('../../utils/ssh')
  const co = await connect()

  if (!co) {
    return process.exit(1)
  }

  const { getQuestionAnswers, trimShellQuotes } = require('../../utils/cli')

  // 获取部署路径
  if (typeof deployPath !== 'string') {
    const { path } = await getQuestionAnswers(questions)
    deployPath = path
  }

  deployPath = trimShellQuotes(deployPath)

  // 进行部署
  const spinner = logger.logWithSpinner()
}

// 初始
exports.init = function() {
  ConfigService.addDefaultService(
    'compress',
    'node_modules/.assets/.zip/[name]-[version]'
  )
}

// 配置webpack
exports.chainWebpack = function() {}

// 命令默认的构建模式
exports.defaultMode = 'production'
// 脚本命令名称
// exports.script = 'publish'
// 命令帮助
exports.help = (options) => ({
  description: 'build for production and publish resources.',
  usage: 'vue-cli-service publish [options]',
  options: {
    '--host': `specify the remote host to connect`,
    '--port': `specify the port of ssh connection to remote host (default: 22)`,
    '--user': `specify the username for ssh connection`,
    '--pwd': `specify the password for ssh connection`,
    '--url': `specify the url for ssh connection`,
    '--private-key': `specify the path of privateKey for auth`,
    '--passphrase': `specify the token phrases of privateKey for auth`,
    '--no-private-key': `do not automatic check and use privateKey for landing`,
    '--path': `specify the path on remote host for deploying resources`,
    '--no-build': `do not run build before publishing`,
    '--no-clean': `do not remove the dist directory before building the project`,
    '--no-suspend': `do not suspend when ready to connect the ssh server`,
    '--no-interactive': `do not apply interaction in terminal`,
    '--modern': `build app targeting modern browsers with auto fallback`,
    '--dest': `specify output directory (default: ${options.outputDir})`,
  },
})
