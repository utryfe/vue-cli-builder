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

const logWithSpinner = (options) => {
  options = Object.assign({ stream: process.stdout }, options)
  const { stream } = options
  if (stream.isTTY) {
    return require('ora')(options)
  }
  let linePosition = 0
  let lastMessage = ''
  const spinner = (msg) => {
    if (lastMessage === msg) {
      return
    }
    let str = ''
    for (; linePosition > msg.length; linePosition--) {
      str += '\b \b'
    }
    for (let i = 0; i < linePosition; i++) {
      str += '\b'
    }
    linePosition = msg.length
    if (str) {
      stream.write(str)
    }
    stream.write(msg)
    lastMessage = msg
  }
  //
  const frame = require('elegant-spinner')()
  const symbols = require('log-symbols')
  let timer = null
  let logText = ''
  const log = (text, symbol) => {
    logText = text || logText
    spinner(`${symbol || chalk.cyan(frame())} ${logText}${symbol ? '\n' : ''}`)
  }
  const clear = (text, symbol) => {
    timer && clearTimeout(timer)
    if (text) {
      log(text, symbol)
    }
  }
  return {
    set text(val) {
      log(val)
    },
    start(text) {
      clear(text)
      timer = setInterval(log, 80)
    },
    stop() {
      clear()
    },
    succeed(text) {
      clear(text, symbols.success)
    },
    fail(text) {
      clear(text, symbols.error)
    },
    info(text) {
      clear(text, symbols.info)
    },
    warn(text) {
      clear(text, symbols.warning)
    },
  }
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

  logWithSpinner() {},

  // 打印信息
  print({ env, entry, data }) {
    const cwd = process.cwd()
    const cwdReg = new RegExp(`^${cwd.replace(/\\/g, '\\\\')}[\\\\/]`, 'i')
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
        npmVersion ? ` (vNpm: ${npmVersion})` : ''
      } (vPlugin: ${pkg.version})`
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
          `${chalk.yellow('-')}  ${`${chalk.green(
            name
          )}`.toLowerCase()}${chalk.yellow(':')} ${chalk.cyan(env[name])}`
        )
      })
    }
    if (data) {
      console.log(
        chalk.yellow(
          '-------------------- inject to application --------------------'
        )
      )
      Object.keys(data).forEach((key) => {
        console.log(
          `${chalk.yellow('-')}  ${`${chalk.green(
            key
          )}`.toLowerCase()}${chalk.yellow(':')} ${chalk.cyan(data[key])}`
        )
      })
    }
    //
    if (Array.isArray(entry)) {
      console.log(
        chalk.yellow(
          '---------------------- build entrypoints ----------------------'
        )
      )
      entry.forEach(({ module, moduleName, legacy, spa, filename }) => {
        const htmlName = filename.substring(0, filename.indexOf('.'))
        console.log(
          `${chalk.yellow('-')}  ${chalk.blue(module.replace(cwdReg, ''))}${
            legacy ? ' (legacy)' : ''
          }${spa ? ' (spa)' : ''}${htmlName !== moduleName ? ` (${filename})` : ''}`
        )
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
module.exports.logWithSpinner = logWithSpinner
