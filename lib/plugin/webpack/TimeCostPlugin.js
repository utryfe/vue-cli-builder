const chalk = require('chalk')

module.exports = class TimeCostPlugin {
  // 编译耗时统计插件
  constructor() {
    this.startTime = 0
  }
  //
  apply(compiler) {
    compiler.plugin('compilation', () => {
      this.startTime = Date.now()
    })
    compiler.plugin('done', (compilation, callback) => {
      const end = Date.now() - this.startTime
      console.log(
        `\n${chalk.bgCyan.yellow(
          ' TIME COST '
        )} Compile done in: ${chalk.keyword('orange')(`${end / 1000}s\n`)}`
      )
      callback && callback()
    })
  }
}
