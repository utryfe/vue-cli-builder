const os = require('os')
const dns = require('dns')
const { promisify } = require('util')

//
const chalk = require('chalk')

const utils = {
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
