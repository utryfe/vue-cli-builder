const chalk = require('chalk')

module.exports = class TimeCostPlugin {
  // 编译耗时统计插件
  constructor() {
    this.startTime = Date.now()
  }
  //
  apply(compiler) {
    compiler.plugin('done', (compilation, callback) => {
      const end = Date.now() - this.startTime
      console.log(
        `\n${chalk.bgCyan.yellow(
          ' TIME COST '
        )} Compile done in 👉 ${chalk.keyword('orange')(`${end / 1000}s\n`)}`
      )
      callback && callback()
    })
  }
}
