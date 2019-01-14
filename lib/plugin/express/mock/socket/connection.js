const EventEmitter = require('events').EventEmitter
const uuidv4 = require('uuid/v4')

const debug = require('debug')('mock:socket:connection')

const emitter = require('./emitter')

class Connection extends EventEmitter {
  //
  constructor({ close, url, channel, client }) {
    super()
    this.setMaxListeners(0)
    this.url = url
    this.channel = channel
    this.client = client
    this.token = uuidv4()
    this.closeHandler = close
    this.disconnected = false
    //
    this.once('close', () => {
      this.clear()
    })
    //
    emitter.on(
      'mock-data',
      (this.mockListener = (message) => {
        if (this.disconnected) {
          return
        }
        const { token, data } = message
        if (token === this.token) {
          debug('receive data from mock client. [%s][%s]', this.channel, this.url)
          try {
            this.emit('mock', data)
          } catch (e) {
            debug(`error occurred while send data to client: %s`, e.message)
          }
        }
      })
    )
    //
    emitter.on(
      'close-connection',
      (this.closeListener = (token) => {
        if (token === this.token) {
          this.close()
        }
      })
    )
  }

  clear() {
    if (!this.disconnected) {
      this.disconnected = true
      const closeHandler = this.closeHandler
      emitter.removeListener('close-connection', this.closeListener)
      emitter.removeListener('mock-data', this.mockListener)
      this.closeHandler = null
      this.closeListener = null
      this.mockListener = null
      if (typeof closeHandler === 'function') {
        try {
          closeHandler()
        } catch (e) {
          debug('connection close error. [%s][%s]', this.url, e.message)
        }
      }
      debug('connection closed. [%s]', this.url)
    }
  }

  // close the connection
  close() {
    if (!this.disconnected) {
      this.clear()
      this.emit('close')
    }
  }

  send(...args) {
    if (this.disconnected) {
      return
    }
    this.emit.apply(this, ['data'].concat(args))
  }
}

//
module.exports = (callback, close, url, channel, client) => {
  const conn = new Connection({ close, url, channel, client })
  if (typeof callback === 'function') {
    callback(
      (...args) => {
        conn.send.apply(conn, args)
      },
      (...args) => {
        conn.close.apply(conn, args)
      }
    )
  }
  return conn
}
