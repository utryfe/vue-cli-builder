const chalk = require('chalk')
const logger = require('../../utils/logger')
const CompilerEvent = require('./CompilerEvent')

class TimeCost {
  // 编译耗时统计插件
  constructor() {
    this.beginTime = Date.now()
  }

  apply(compiler) {
    //
    new CompilerEvent(
      'TimeCostWebpackPlugin',
      //
      {
        compilation: this.begin,
        done: this.end,
        //
      },
      this
    ).apply(compiler)
  }

  async begin() {
    if (!this.beginTime) {
      this.beginTime = Date.now()
    }
  }

  async end() {
    const end = Date.now() - this.beginTime
    this.beginTime = 0
    logger.log(
      `\nCompile done in 👉 ${chalk.keyword('orange')(`${end / 1000}s\n`)}`
    )
  }
}

TimeCost.default = TimeCost
module.exports = TimeCost
