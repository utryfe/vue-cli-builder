const fs = require('fs')
const os = require('os')
const dns = require('dns')
const crypto = require('crypto')
const prettier = require('prettier')
const { promisify } = require('util')

//
const chalk = require('chalk')
const chokidar = require('chokidar')
const lodash = require('lodash')

const fileUtil = require('./file')
const emitter = require('./emitter')

let prettierOptions = null

// 解析prettier配置文件
function resolvePrettierConfig(callback) {
  if (!prettierOptions) {
    const rc = `.prettierrc`
    let configPath = fileUtil.resolvePath(rc)
    if (!fs.existsSync(configPath)) {
      configPath = fileUtil.resolvePath(`${rc}.js`)
      if (!fs.existsSync(configPath)) {
        configPath = ''
      }
    }
    let options = null
    if (configPath) {
      try {
        options = prettier.resolveConfig.sync(configPath)
      } catch (e) {}
    }
    prettierOptions = Object.assign(
      {
        parser: 'babylon',
      },
      options
    )
  }
  if (typeof callback === 'function') {
    callback(prettierOptions)
  }
  return Object.assign({}, prettierOptions)
}

//

const utils = {
  // 生成hash码
  hash(str) {
    return crypto
      .createHash('md5')
      .update(str)
      .digest('hex')
  },

  // 两个集合的差集
  difference(setA, setB) {
    const diff = new Set(setA)
    for (const elem of setB) {
      if (diff.has(elem)) {
        diff.delete(elem)
      } else {
        diff.add(elem)
      }
    }
    return Array.from(diff)
  },

  // 监听文件变化
  watch(pattern, callback, options) {
    const setup = Object.assign({}, options)
    const delay = setup.delay === undefined ? 500 : setup.delay
    delete setup.delay
    const watcher = chokidar.watch(
      pattern,
      Object.assign(
        {
          ignoreInitial: true,
          ignored: 'node_modules/**/*',
          disableGlobbing: false,
        },
        setup
      )
    )
    const delaySetup = {
      trailing: true,
    }
    if (callback && typeof callback === 'object') {
      Object.keys(callback).forEach((event) => {
        const handler = callback[event]
        if (typeof handler === 'function') {
          watcher.on(
            event,
            delay ? lodash.debounce(handler, delay, delaySetup) : handler
          )
        }
      })
    } else if (typeof callback === 'function') {
      watcher.on(
        'all',
        delay ? lodash.debounce(callback, delay, delaySetup) : callback
      )
    }
    //
    utils.registerShutdown(() => {
      watcher.close()
    })
    emitter.once('before-restart', () => {
      watcher.close()
    })
    return watcher
  },

  // 格式化代码
  formatCode(code, options, callback) {
    const config = resolvePrettierConfig()
    code = prettier.format(code, Object.assign({}, config, options))
    if (typeof callback === 'function') {
      callback(code)
    }
    return code
  },

  // 注册进程关闭回调
  registerShutdown(fn) {
    let run = false
    const wrapper = () => {
      if (!run) {
        run = true
        fn()
      }
    }
    process.on('SIGINT', wrapper)
    process.on('SIGTERM', wrapper)
    process.on('exit', wrapper)
  },

  // 打印服务器监听地址
  async printListeningAddress(server, title) {
    const details = server.address()
    let localAddress = null
    let networkAddress = null
    if (typeof details === 'string') {
      localAddress = details
    } else if (typeof details === 'object' && details) {
      let { port, address } = details
      address = address === '::' ? 'localhost' : address
      localAddress = `http://${
        address === '0.0.0.0' ? 'localhost' : address
      }:${port}`
      const ip = await utils.getNetworkHostIP()
      networkAddress = `http://${ip}:${port}`
    }
    if (localAddress || networkAddress) {
      //
      console.log()
      console.log()
      console.log(title)
      if (localAddress) {
        console.log(`${'  - Local:   '}${chalk.cyan(localAddress)}`)
      }
      if (networkAddress) {
        console.log(`${'  - Network: '}${chalk.cyan(networkAddress)}`)
      }
    }
  },

  // 获取机器在网络上的IP
  async getNetworkHostIP() {
    try {
      return await promisify(dns.lookup)(os.hostname())
        .then(({ address }) => address)
        .catch((err) => {
          console.error(`DNS lookup failed: ${err.message}`)
          return '127.0.0.1'
        })
    } catch (e) {
      console.error(e.message)
      return '127.0.0.1'
    }
  },
}

module.exports = utils
