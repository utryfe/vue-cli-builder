const chalk = require('chalk')

class TimeCost {
  // 编译耗时统计插件
  constructor() {
    this.beginTime = Date.now()
  }

  apply(compiler) {
    const begin = this.begin.bind(this)
    const end = this.end.bind(this)
    begin.priority = 999999999
    end.priority = -999999999
    compiler.plugin('compilation', begin)
    compiler.plugin('done', end)
  }

  begin() {
    if (!this.beginTime) {
      this.beginTime = Date.now()
    }
  }

  end(compilation, done) {
    const end = Date.now() - this.beginTime
    this.beginTime = 0
    console.log(
      `\n${chalk.bgCyan.yellow(
        ' TIME COST '
      )} Compile done in 👉 ${chalk.keyword('orange')(`${end / 1000}s\n`)}`
    )
    if (typeof done === 'function') {
      done()
    }
  }
}

TimeCost.default = TimeCost
module.exports = TimeCost
