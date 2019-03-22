const { Client } = require('ssh2')
const chalk = require('chalk')

const { readPrivateKey } = require('./key')
const {
  fillCommandArgs,
  //
  getQuestionAnswers,
  suspend,
  trimShellQuotes,
} = require('./cli')

const validator = require('./validator')
const logger = require('./logger')

// 默认的参数查询配置
const defaultQuestions = (conditions) => ({
  host: {
    type: 'string',
    question: {
      message: 'Please enter the remote host:',
      when: () => !conditions.host,
      filter: (answer) => answer.trim(),
      validate: (answer) =>
        validator.isIP(answer) ||
        validator.isDomainName(answer) ||
        'Invalid host address, please re-enter it',
    },
  },
  user: {
    type: 'string',
    question: {
      message: 'Please enter the username:',
      when: () => !conditions.user,
      filter: (answer) => answer.trim(),
      validate: (answer) =>
        validator.isNotEmptyString(answer) ||
        'The username cannot be empty, please re-enter it',
    },
  },
  pwd: {
    type: 'string',
    question: {
      type: 'password',
      message: 'Please enter the password:',
      when: () => !conditions.privateKey,
      filter: (answer) => answer.trim(),
      validate: (answer) =>
        validator.isNotEmptyString(answer) ||
        'The password cannot be empty, please re-enter it',
    },
  },
  port: {
    type: 'number',
    default: 22,
  },
  interactive: {
    type: 'boolean',
    default: true,
  },
  passphrase: {
    type: 'string',
    default: '',
  },
  'private-key': {
    type: ['string', 'boolean'],
    default: false,
  },
})

// 校验密码交互
const validatePasswordQuestion = [
  {
    type: 'input',
    name: 'username',
    message: 'Please enter the username:',
    filter: (answer) => answer.trim(),
    validate: (answer) =>
      validator.isNotEmptyString(answer) ||
      'The username cannot be empty, please re-enter it',
  },
  {
    type: 'password',
    name: 'password',
    message: 'Please enter the password:',
    filter: (answer) => answer.trim(),
    validate: (answer) =>
      validator.isNotEmptyString(answer) ||
      'The password cannot be empty, please re-enter it',
  },
]

// 是否是校验错误异常
function isAuthError(err) {
  return !!(err && err.level === 'client-authentication')
}

// 交互式重连
async function interactiveReconnect(args, spinner) {
  let count = 5 // 最大重连数

  const inquire = async () => {
    const { username, password } = await getQuestionAnswers(validatePasswordQuestion)
    console.log()
    return await createConnection(
      Object.assign({}, args, {
        username,
        password,
      }),
      spinner
    ).catch(async (err) => {
      if (!--count || !isAuthError(err)) {
        throw err
      }
      return await inquire()
    })
  }

  return await inquire()
}

// 进行ssh连接
async function connect(args, interactive, spinner) {
  // 创建连接
  return await createConnection(args, spinner).catch(async (err) => {
    if (!interactive || args.privateKey || !isAuthError(err)) {
      throw err
    }
    return await interactiveReconnect(args, spinner)
  })
}

// 创建连接对象
async function createConnection(args, spinner) {
  return new Promise((resolve, reject) => {
    const setup = Object.assign(
      {
        readyTimeout: 10000,
      },
      args,
      {
        tryKeyboard: false,
        authHandler(methodsLeft, partialSuccess, callback) {
          if (methodsLeft === null) {
            callback(setup.privateKey ? 'publickey' : 'password')
          } else {
            callback(false)
          }
        },
      }
    )

    let conn = new Client()

    let catchError = (err) => {
      err = err || new Error('Connect failed.')
      if (conn) {
        try {
          conn.end()
        } catch (e) {
        } finally {
          conn = null
          spinner.fail(
            isAuthError(err)
              ? `Authentication failure. By ${
                  args.privateKey ? 'publicKey' : 'password'
                }.`
              : err.message
          )
          console.log()
        }
      }
      reject(err)
      catchError = null
    }
    process.once('uncaughtException', catchError)

    spinner.start('Waiting for connect the server...')
    try {
      conn
        .once('ready', () => resolve(conn))
        .once('error', catchError)
        // 进行连接
        .connect(setup)
    } catch (e) {
      catchError(e)
    }
  })
}

// 加载私钥
async function loadPrivateKey(privateKeyPath, interactive) {
  let privateKey
  let passphrase

  privateKeyPath = trimShellQuotes(privateKeyPath)

  if (typeof privateKeyPath === 'string' || privateKeyPath === true) {
    if (privateKeyPath === true) {
      privateKeyPath = undefined
    }

    // 获取私钥信息
    const { content, passphrase: token } = await readPrivateKey(
      privateKeyPath,
      interactive
    )

    privateKey = content
    passphrase = token
  }
  return { privateKey, passphrase }
}

// 解析参数
async function resolveArgs(options, urlResolver, interactive) {
  const { questions, url, privateKey } = options

  const argsDefine = Object.assign(
    defaultQuestions({
      privateKey,
    }),
    questions
  )

  // 从url中解析主机用户信息
  if (url && typeof url === 'string') {
    const parsedUrl = require('parse-url')(url)
    if (typeof urlResolver === 'function') {
      Object.assign(argsDefine, urlResolver(parsedUrl, argsDefine))
    } else {
      const { resource: host, protocol, port, user } = parsedUrl
      if (protocol === 'ssh') {
        argsDefine.host = host
        if (port !== null) {
          argsDefine.port = port
        }
        if (user) {
          argsDefine.user = user
        }
      }
    }
  }

  // 获取连接参数
  return await fillCommandArgs(argsDefine, interactive)
}

// 处理连接就绪事件
async function handleReady(co, spinner) {
  //
  return await new Promise((resolve, reject) => {
    // 同步系统基础信息
    co.exec('uptime', (err, stream) => {
      //
      const handleError = (err) => {
        try {
          co.end()
        } catch (e) {
          console.error(e)
        } finally {
          reject(err)
        }
      }

      if (err) {
        handleError(err)
      } else {
        stream
          .on('data', (data) => {
            spinner.info(data)
            stream.end()
          })
          .once('close', (code /*signal*/) => {
            if (`${code}` !== '0') {
              handleError(new Error(`remote error with code: ${code}`))
            } else {
              resolve(co)
            }
          })
      }
    })
  })
}

// 打印连接地址信息
function printAddress(details, echo = logger) {
  const { user, host, port } = details
  console.log()
  echo.info(`The connection address is: `)
  //
  logger.logWithBoxen(`${chalk['cyan'](`${user}@${host}:${port}`)}`)
}

//
module.exports = exports = {
  // 连接
  async connect(questions, extra) {
    const {
      'private-key': privateKeyPath = false,
      suspend: waiting = true, // 连接前暂停执行，等待用户确认
      interactive = true, // 是否启用控制台交互
      url = '', // url地址，用于解析用户名及连接地址信息
    } = require('minimist')(process.argv.slice(2))

    if (waiting && interactive) {
      await suspend(true)
    }

    const spinner = logger.logWithSpinner()
    spinner.info('Prepare for connecting the remote ssh server.')
    console.log()

    // 加载私钥，用于使用公钥登录情形
    const { privateKey, passphrase } = await loadPrivateKey(
      privateKeyPath,
      interactive
    ).catch((err) => {
      console.log()
      spinner.fail(chalk.red(err ? err.message : 'Cannot use the publicKey for logon.'))
      console.log()
      spinner.info(chalk.cyan('Change to use password for logon.'))
      console.log()
      return {}
    })

    const { urlHandler } = Object.assign({}, extra)
    const args = await resolveArgs(
      { questions, url, privateKey },
      urlHandler,
      interactive
    )

    // 打印连接地址信息
    const { host, user, pwd, port } = args
    printAddress({ user, host, port }, spinner)

    const setup = Object.assign({}, args, {
      host,
      port,
      privateKey,
      passphrase,
      username: user,
      password: pwd,
    })

    return await connect(
      setup,
      interactive,
      spinner
    )
      //
      .then(async (co) => {
        //
        spinner.succeed('The ssh server has been successfully connected.')
        console.log()

        const { registerShutdown } = require('./common')
        registerShutdown(() => {
          co.once('close', (hasError) => {
            if (!hasError) {
              spinner.succeed('The connection has been successfully closed.')
            } else {
              spinner.fail('An error occurred when closing the connection.')
            }
            console.log()
          }).end()
        })

        return await handleReady(co, spinner, setup)
      })
      //
      .catch(() => {
        spinner.fail('Cannot connect to the ssh server.')
        console.log()
        return null
      })
  },
}
