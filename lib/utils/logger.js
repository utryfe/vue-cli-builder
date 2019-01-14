const chalk = require('chalk')
const pkg = require('../../package.json')

const format = (label, args, labelLength) => {
  if (!Array.isArray(args)) {
    args = [args]
  }
  args = args.join('\n')
  if (label) {
    return args
      .split('\n')
      .map((line) => {
        line = line.trim()
        if (line) {
          if (label) {
            line = `${label} ${line}`
            label = ''
          } else {
            line = `${''.padStart(labelLength)} ${line}`
          }
        }
        return line
      })
      .join('\n')
  }
  return args
}

const logger = {
  //
  done(...args) {
    if (args.length) {
      const label = ' DONE '
      console.log(format(chalk.bgGreen.black(label), args, label.length))
    }
  },

  //
  error(...args) {
    if (args.length) {
      const label = ' ERROR '
      console.error(format(chalk.bgRed(label), args, label.length))
    }
  },

  // 警告信息
  warn(...args) {
    if (args.length) {
      const label = ' WARN '
      console.warn(format(chalk.bgYellow.black(label), args, label.length))
    }
  },

  // 日志信息
  log(...args) {
    if (!args.length) {
      return console.log()
    }
    const label = ' INFO '
    console.log(format(chalk.bgBlue.black(label), args, label.length))
  },

  info(...args) {
    logger.log.apply(logger, args)
  },

  // 打印信)息
  print({ env, entry, data }) {
    const userAgent = process.env.npm_config_user_agent
    let npmVersion = ''
    if (/\bnpm\/([^\s]+)/.test(userAgent)) {
      npmVersion = RegExp.$1
    }
    //
    console.log(
      chalk.yellow(
        '------------------------- build mode --------------------------'
      )
    )
    console.log(
      `${chalk.yellow('-')}  ${
        process.env.NODE_ENV
      }  (vNode: ${process.version.replace(/^[\D]+/, '')})${
        npmVersion ? ` (vNpm: ${npmVersion}) ` : ''
      }(vPlugin: ${pkg.version})`
    )
    //
    if (env) {
      console.log(
        chalk.yellow(
          '-------------------- environment variables --------------------'
        )
      )
      Object.keys(env).forEach((name) => {
        console.log(
          `${chalk.yellow('-')}  ${chalk.green(name)}${chalk.yellow(
            ':'
          )} ${chalk.cyan(env[name])}`
        )
      })
    }
    if (data) {
      Object.keys(data).forEach((key) => {
        console.log(
          `${chalk.yellow('-')}  ${chalk.green(key)}${chalk.yellow(
            ':'
          )} ${chalk.cyan(data[key])}`
        )
      })
    }
    //
    if (entry) {
      console.log(
        chalk.yellow(
          '---------------------- build entrypoints ----------------------'
        )
      )
      Object.keys(entry).forEach((name) => {
        console.log(`${chalk.yellow('-')}  ${chalk.blue(entry[name].entry)}`)
      })
    }
    //
    console.log(
      chalk.yellow(
        '---------------------------------------------------------------'
      )
    )
    console.log(
      chalk.cyan('   Life is not just about survival, but poetry and distance.   ')
    )
    console.log(
      chalk.yellow(
        '---------------------------------------------------------------'
      )
    )
  },

  //
  raw: console,
}

module.exports = logger
