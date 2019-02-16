const EventEmitter = require('events').EventEmitter
const debug = require('debug')('mock:socket:proxyServer')

const emitter = require('./emitter')

class ProxyServer extends EventEmitter {
  //
  constructor() {
    super()
    this.connections = []
    this.on('connection', (conn) => {
      if (!conn) {
        return
      }
      this.incoming(conn)
    })
    //
    emitter.on('mock-connection', (socket) => {
      if (this.connections.length) {
        debug('resend the connection')
        emitter.emit('reconnection', {
          socket,
          connections: [].concat(this.connections),
        })
      }
    })
    //
    emitter.once('before-server-close', () => {
      debug('proxy server closing.')
      for (const conn of this.connections) {
        conn.close()
      }
      this.connections.length = 0
      emitter.emit('proxy-server-closed')
    })
  }

  incoming(conn) {
    //
    emitter.emit('client-connect', conn)
    //
    this.connections.push(conn)
    //
    conn.once('close', () => {
      const sockets = this.connections
      const index = sockets.indexOf(conn)
      if (index !== -1) {
        sockets.splice(index, 1)
      }
    })
  }
}

module.exports = new ProxyServer()
