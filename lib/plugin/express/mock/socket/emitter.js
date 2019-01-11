const EventEmitter = require('events').EventEmitter

const emitter = new EventEmitter()

emitter.setMaxListeners(0)

module.exports = emitter
