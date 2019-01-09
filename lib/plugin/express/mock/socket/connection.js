const EventEmitter = require('events').EventEmitter
const uuidv4 = require('uuid/v4')

const debug = require('debug')('mock:socket:connection')

const emitter = require('./emitter')

class Connection extends EventEmitter {
  //
  constructor(close, url) {
    super()
    this.url = url
    this.token = uuidv4()
    this.closeHandler = close
    //
    this.once('close', () => {
      debug('connection closed. [%s]', this.url)
      this.closeHandler = null
    })
    //
    emitter.on('mock-data', (message) => {
      const { token, data } = message
      if (token === this.token) {
        debug('receive data from mock client. [%s]', this.url)
        this.emit('mock', JSON.stringify(data))
      }
    })
    //
    emitter.on('close-connection', (token) => {
      if (token === this.token) {
        this.close()
      }
    })
  }

  // close the connection
  close() {
    if (typeof this.closeHandler === 'function') {
      try {
        this.closeHandler()
        this.closeHandler = null
        this.emit('close')
        debug('connection closed. [%s]', this.url)
      } catch (e) {
        debug('connection close error. [%s][%s]', this.url, e.message)
      }
    }
  }
}

//
module.exports = (callback, close, url) => {
  const conn = new Connection(close, url)
  callback(
    (...args) => {
      conn.emit.apply(conn, ['data'].concat(args))
    },
    (...args) => {
      conn.emit.apply(conn, ['close'].concat(args))
    }
  )
  return conn
}
