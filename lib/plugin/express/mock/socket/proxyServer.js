const EventEmitter = require('events').EventEmitter
const debug = require('debug')('mock:socket:proxyServer')

const emitter = require('./emitter')

class ProxyServer extends EventEmitter {
  //
  constructor() {
    super()
    this.sockets = []
    this.on('connection', (connection) => {
      if (!connection) {
        return
      }
      this.incoming(connection)
    })
    //
    emitter.on('mock-connection', (socket) => {
      if (this.sockets.length) {
        debug('resend the connection')
        emitter.emit('reconnection', {
          socket,
          connections: [].concat(this.sockets),
        })
      }
    })
    //
    emitter.once('close-server', () => {
      debug('proxy server closing.')
      for (const socket of this.sockets) {
        socket.close()
      }
      this.sockets.length = 0
    })
  }

  incoming(connection) {
    //
    emitter.emit('client-connect', connection)
    //
    this.sockets.push(connection)
    //
    connection.once('close', () => {
      const sockets = this.sockets
      const index = sockets.indexOf(connection)
      if (index !== -1) {
        sockets.splice(index, 1)
      }
    })
  }
}

module.exports = new ProxyServer()
