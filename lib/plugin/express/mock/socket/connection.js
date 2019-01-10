const EventEmitter = require('events').EventEmitter
const uuidv4 = require('uuid/v4')

const debug = require('debug')('mock:socket:connection')

const emitter = require('./emitter')

class Connection extends EventEmitter {
  //
  constructor({ close, url, channel, client }) {
    super()
    this.url = url
    this.channel = channel
    this.client = client
    this.token = uuidv4()
    this.closeHandler = close
    this.disconnected = false
    //
    this.once('close', () => {
      if (this.disconnected) {
        return
      }
      this.closeHandler = null
      this.disconnected = true
      debug('connection closed. [%s]', this.url)
      emitter.removeListener('close-connection', this.closeListener)
      emitter.removeListener('mock-data', this.mockListener)
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
          debug('receive data from mock client. [%s]', this.url)
          this.emit('mock', JSON.stringify(data))
        }
      })
    )
    //
    emitter.on(
      'close-connection',
      (this.closeListener = (token) => {
        if (token === this.token) {
          emitter.removeListener('close-connection', this.closeListener)
          emitter.removeListener('mock-data', this.mockListener)
          this.close()
        }
      })
    )
  }

  // close the connection
  close() {
    if (typeof this.closeHandler === 'function') {
      try {
        this.disconnected = true
        this.closeHandler()
        this.closeHandler = null
        this.emit('close')
        debug('connection closed. [%s]', this.url)
      } catch (e) {
        debug('connection close error. [%s][%s]', this.url, e.message)
      }
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
