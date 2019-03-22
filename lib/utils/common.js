const fs = require('fs')
const os = require('os')
const dns = require('dns')
const crypto = require('crypto')
const prettier = require('prettier')
const { promisify } = require('util')

//
const addressUtil = require('address')
const chalk = require('chalk')
const chokidar = require('chokidar')
const lodash = require('lodash')

const fileUtil = require('./file')
const emitter = require('./emitter')
const logger = require('./logger')

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
        parser: 'babel',
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
  // 随机范围
  randomRange(a, b) {
    a = parseInt(a, 10) || 0
    b = parseInt(b, 10) || 0
    return Math.round(Math.random() * (a > b ? a - b : b - a) + (a > b ? b : a))
  },

  // 生成hash码
  hash(str, length, identifier) {
    let hash = crypto
      .createHash('md5')
      .update(str)
      .digest('hex')
    if (identifier) {
      hash = hash.replace(/^\d/, 'd')
    }
    if (+length) {
      hash = hash.substring(0, +length)
    }

    return hash
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
          watcher.on(event, delay ? lodash.debounce(handler, delay, delaySetup) : handler)
        }
      })
    } else if (typeof callback === 'function') {
      watcher.on('all', delay ? lodash.debounce(callback, delay, delaySetup) : callback)
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
  async printListeningAddress(server, extra, boxen) {
    const details = server.address()
    let localAddress = null
    let networkAddress = null
    let path = extra && typeof extra === 'object' ? extra.path : ''
    if (typeof path !== 'string') {
      path = ''
    } else {
      path = path.trim()
    }
    if (typeof details === 'string') {
      localAddress = details
    } else if (typeof details === 'object' && details) {
      let { port, address } = details
      address = address === '::' ? 'localhost' : address
      localAddress = `http://${
        address === '0.0.0.0' ? 'localhost' : address
      }:${port}${path}`
      const host = await utils.getNetworkHostIP()
      networkAddress = `http://${host}:${port}${path}`
    }
    if (localAddress || networkAddress) {
      let message = ''
      //
      if (extra) {
        const title = typeof extra === 'object' ? extra.title : extra
        if (title && typeof title === 'string') {
          message += title
        }
      }
      if (localAddress) {
        message += `\n${'  - Local:   '}${chalk.cyan(localAddress)}`
      }
      if (networkAddress) {
        message += `\n${'  - Network: '}${chalk.cyan(networkAddress)}`
      }
      if (extra) {
        const foot = typeof extra === 'object' ? extra.foot : ''
        if (foot && typeof foot === 'string') {
          message += `\n${foot}`
        }
      }
      if (boxen) {
        logger.logWithBoxen(message, { margin: 1 })
      } else {
        // print
        console.log(message)
      }

      return {
        local: localAddress,
        network: networkAddress,
      }
    }
  },

  // 获取可用的端口号
  async getNetworkPort(port) {
    const startPort = +port || 8080
    return await require('portfinder').getPortPromise({
      port: startPort,
      startPort,
    })
  },

  // 获取机器在网络上的IP
  async getNetworkHostIP() {
    let address = ''
    try {
      address = addressUtil.ip()
      if (!address) {
        address = await promisify(dns.lookup)(os.hostname())
          .then(({ address }) => address)
          .catch((e) => {
            console.error(`DNS lookup failed: ${e.message}`)
          })
      }
    } catch (e) {
      console.error(e.message)
    }
    if (
      !address ||
      !/^10[.]|^172[.](1[6-9]|2[0-9]|3[0-1])[.]|^192[.]168[.]/.test(address)
    ) {
      // 如果是公网IP地址，就重置为局域网IP显示
      address = '127.0.0.1'
    }
    return address
  },

  // 创建本地网络监听的HTTP服务器
  async createLocalHttpServer(port, handler, closed) {
    const options = port && typeof port === 'object' ? port : { port }
    const { port: exceptPort, host, path } = options
    const servePath = path || '/'
    const actualPort = await utils.getNetworkPort(+exceptPort || 5000)
    const httpServer = require('http').createServer(handler)
    require('killable')(httpServer)
    //
    return new Promise((resolve, reject) => {
      httpServer.listen(
        { host: host || '0.0.0.0', port: actualPort, path: servePath },
        async (err) => {
          if (!err) {
            utils.registerShutdown(() => {
              httpServer.kill(closed)
            })
            const host = await utils.getNetworkHostIP()
            resolve({ server: httpServer, host, port: actualPort, path: servePath })
          } else {
            reject(err)
          }
        }
      )
    })
  },

  // 拷贝内容至剪贴板
  async copyToClipboard(content) {
    try {
      const { write } = require('clipboardy')
      await write(content)
      return true
    } catch (err) {
      console.error(`Cannot copy to clipboard: ${err.message}`)
    }
  },

  // 打开浏览器
  openBrowser(address) {
    try {
      if (typeof address !== 'string' || !(address = address.trim())) {
        return
      }
      const { openBrowser } = require(require('resolve').sync('@vue/cli-shared-utils', {
        basedir: process.cwd(),
      }))
      openBrowser(address)
    } catch (e) {
      //
    }
  },

  // 获取输出路径
  getOutputPath(outputDir, dest) {
    if (typeof dest !== 'string') {
      dest = require('minimist')(process.argv.slice(2)).dest
    }

    let output = typeof dest === 'string' ? dest : outputDir
    output = typeof output === 'string' ? output.trim() : ''
    if (!output) {
      output = 'dist'
    }

    if (!fileUtil.isAbsolute(output)) {
      output = fileUtil.resolvePath(output)
    }
    return output
  },

  // 获取构建资源压缩文件路径
  getZipFilesPath(projectOptions) {
    const { pluginOptions } = Object.assign({}, projectOptions)
    const { service } = Object.assign({}, pluginOptions)
    const { compress } = Object.assign({}, service)

    if (compress) {
      const ZipCompress = require('../plugin/webpack/ZipCompress')
      return new ZipCompress(compress).getZipFiles()
    }

    return []
  },
}

module.exports = exports = utils
