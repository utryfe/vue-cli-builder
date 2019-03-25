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

  const trimLeadingLine = (str) =>
    typeof str === 'string'
      ? str
          .replace(/^\r?\n(\r?\n)*/g, (t, l) => {
            console.log()
            if (l) {
              console.log(l)
            }
            return ''
          })
          .trimLeft()
      : str

  if (stream.isTTY) {
    const spinner = require('ora')(options)
    return {
      set text(val) {
        spinner.text = trimLeadingLine(val)
      },
      start(text) {
        spinner.start(trimLeadingLine(text))
      },
      stop() {
        spinner.stop()
      },
      succeed(text) {
        spinner.succeed(trimLeadingLine(text))
      },
      fail(text) {
        spinner.fail(trimLeadingLine(text))
      },
      info(text) {
        spinner.info(trimLeadingLine(text))
      },
      warn(text) {
        spinner.warn(trimLeadingLine(text))
      },
      log(text) {
        spinner.stop()
        console.log(text)
      },
    }
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

  const echo = (text, symbol) => {
    logText = text === undefined ? logText : text
    spinner(
      `${!symbol && symbol !== '' ? chalk.cyan(frame()) : symbol} ${logText}${
        symbol ? '\n' : ''
      }`
    )
  }

  const clear = (text, symbol) => {
    timer && clearTimeout(timer)
    if (text !== undefined) {
      echo(trimLeadingLine(text), symbol)
    }
  }

  return {
    set text(val) {
      echo(val)
    },
    start(text) {
      clear(text === undefined ? '' : trimLeadingLine(text))
      timer = setInterval(echo, 80)
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
    log(text) {
      clear(text, '')
    },
  }
}

const isHelp = process.argv.slice(2)[0] === 'help'

exports = module.exports = {
  //
  done(...args) {
    if (!isHelp && args.length) {
      const label = ' DONE '
      console.log(format(chalk.bgGreen.black(label), args, label.length))
    }
  },

  //
  error(...args) {
    if (isHelp) {
      console.error.apply(console.error, args)
    } else if (args.length) {
      const label = ' ERROR '
      args = args.map((arg) => {
        return `${arg}`
          .split('\n')
          .map((line) => {
            if (line) {
              return chalk.red(line)
            }
            return line
          })
          .join('\n')
      })
      console.log(format(chalk.bgRed(label), args, label.length))
    }
  },

  // 警告信息
  warn(...args) {
    if (!isHelp && args.length) {
      const label = ' WARN '
      console.warn(format(chalk.bgYellow.black(label), args, label.length))
    }
  },

  // 日志信息
  log(...args) {
    if (!isHelp && !args.length) {
      return console.log()
    }
    const label = ' INFO '
    console.log(format(chalk.bgBlue.black(label), args, label.length))
  },

  info(...args) {
    exports.log.apply(exports, args)
  },

  // 打印信息
  print({ env, entry, data }) {
    if (isHelp) {
      return
    }
    const cwd = process.cwd()
    const cwdReg = new RegExp(`^${cwd.replace(/\\/g, '\\\\')}[\\\\/]`, 'i')
    const userAgent = process.env.npm_config_user_agent
    let npmVersion = ''
    if (/\bnpm\/([^\s]+)/.test(userAgent)) {
      npmVersion = RegExp.$1
    }
    //
    console.log(
      chalk.yellow('------------------------- build mode --------------------------')
    )
    console.log(
      `${chalk.yellow('-')}  ${process.env.NODE_ENV}  (vNode: ${process.version.replace(
        /^[\D]+/,
        ''
      )})${npmVersion ? ` (vNpm: ${npmVersion})` : ''} (vPlugin: ${pkg.version})`
    )
    //
    if (env) {
      const keys = Object.keys(env)
      if (keys.length) {
        console.log(
          chalk.yellow('-------------------- environment variables --------------------')
        )
        keys.forEach((name) => {
          console.log(
            `${chalk.yellow('-')}  ${`${chalk.green(name)}`.toLowerCase()}${chalk.yellow(
              ':'
            )} ${chalk.cyan(env[name])}`
          )
        })
      }
    }
    if (data) {
      const keys = Object.keys(data)
      if (keys.length) {
        console.log(
          chalk.yellow('-------------------- inject to application --------------------')
        )
        keys.forEach((key) => {
          console.log(
            `${chalk.yellow('-')}  ${`${chalk.green(key)}`.toLowerCase()}${chalk.yellow(
              ':'
            )} ${chalk.cyan(data[key])}`
          )
        })
      }
    }
    //
    if (Array.isArray(entry) && entry.length) {
      console.log(
        chalk.yellow('---------------------- build entrypoints ----------------------')
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
      chalk.yellow('---------------------------------------------------------------')
    )
    console.log(
      chalk.cyan('   Life is not just about survival, but poetry and distance.   ')
    )
    console.log(
      chalk.yellow('---------------------------------------------------------------')
    )
    console.log()
  },

  //
  logWithSpinner,

  // 使用盒子框起来的日志
  logWithBoxen(message, options) {
    console.log(
      require('boxen')(
        message,
        Object.assign(
          {
            padding: 1,
            borderColor: 'green',
            margin: {
              left: 2,
              bottom: 1,
            },
          },
          options
        )
      )
    )
  },

  //
  raw: console,
}
