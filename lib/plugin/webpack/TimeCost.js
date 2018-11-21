const chalk = require('chalk')

class TimeCost {
  // 编译耗时统计插件
  constructor() {
    this.startTime = Date.now()
  }
  //
  apply(compiler) {
    compiler.plugin('compilation', () => {
      if (!this.startTime) {
        this.startTime = Date.now()
      }
    })
    compiler.plugin('done', (compilation, callback) => {
      const end = Date.now() - this.startTime
      this.startTime = 0
      console.log(
        `\n${chalk.bgCyan.yellow(
          ' TIME COST '
        )} Compile done in 👉 ${chalk.keyword('orange')(`${end / 1000}s\n`)}`
      )
      callback && callback()
    })
  }
}

TimeCost.default = TimeCost
module.exports = TimeCost
