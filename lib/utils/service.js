const { trimShellQuotes, runCliService } = require('./cli')

module.exports = exports = {
  // 执行构建服务
  async build(args) {
    return await runCliService(
      'build',
      trimShellQuotes(
        Object.assign(
          {
            'unsafe-inline': false,
          },
          args,
          {
            mode: 'production',
            watch: false,
            report: false,
            open: false,
            silent: true,
          }
        )
      )
    )
  },
}
