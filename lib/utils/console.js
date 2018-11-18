const chalk = require('chalk')

module.exports = {
  // 抛出错误消息
  error(msg) {
    throw `${msg}\n`
  },

  // 打印信息
  print(type, data) {
    if (type === 'env') {
      console.log(
        chalk.yellow('-------------------- build mode ---------------------')
      )
      console.log(
        `${chalk.yellow('-')}  ${process.env.NODE_ENV}  (vNode: ${
          process.version
        })`
      )
      console.log(
        chalk.yellow('--------------- environment variables ---------------')
      )
      Object.keys(data).forEach((name) => {
        console.log(
          `${chalk.yellow('-')}  ${chalk.green(name)}${chalk.yellow(':')} ${
            data[name]
          }`
        )
      })
    } else if (type === 'entry') {
      console.log(
        chalk.yellow('----------------- build entrypoints -----------------')
      )
      Object.keys(data).forEach((name) => {
        console.log(`${chalk.yellow('-')}  ${chalk.blue(data[name].entry)}`)
      })
      console.log(
        chalk.yellow('-----------------------------------------------------')
      )
    }
  },
}
