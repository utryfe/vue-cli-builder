const urlUtils = require('url')
//
const sockjs = require('sockjs')

const debug = require('debug')('mock:socket:mockSocketServer')

//
const emitter = require('./emitter')

let connection = null
let proxyContext = ''

function getUrlPathName(url) {
  const originalUrl = proxyContext
    ? url.replace(new RegExp(`^/${proxyContext}`), '')
    : url
  return originalUrl && originalUrl !== '/'
    ? urlUtils.parse(originalUrl).pathname
    : '/'
}

function send(data) {
  if (connection) {
    try {
      debug('send data to mock client. [$s][%s]', data.type, data.path)
      connection.send(JSON.stringify(data))
    } catch (e) {
      debug('send data to mock client error. %s', e.message)
    }
  }
}

function reconnection(sockets) {
  for (const sock of sockets) {
    send({
      type: 'connection',
      path: getUrlPathName(sock.url),
      token: sock.token,
    })
  }
}

function incoming(connection) {
  const { token, url } = connection
  const path = getUrlPathName(url)
  debug('client connected. [%s][%s]', path, token)
  //
  send({
    type: 'connection',
    path,
    token,
  })
  //
  connection.on('data', (data) => {
    send({
      type: 'data',
      path,
      token,
      data,
    })
  })
  //
  connection.once('close', () => {
    send({
      type: 'disconnect',
      path,
      token,
    })
  })
}

//
function listen(conn) {
  if (connection) {
    connection.close()
  }
  connection = conn
  //
  connection.on('data', (message) => {
    debug('receive message from mock client.')
    const { token, data, type } = Object.assign({}, message)
    if (type === 'init') {
      emitter.emit('init-client')
    } else if (type === 'data') {
      emitter.emit('mock-data', { token, data })
    } else if (type === 'disconnect') {
      emitter.emit('close-connection', token)
    }
  })
  //
  connection.on('close', () => {
    connection = null
    debug('mock client has been closed.')
  })
}

function createHandler(options) {
  const { context } = options
  //
  const server = sockjs.createServer({
    log: (severity, line) => {
      if (severity === 'error') {
        debug(line)
      }
    },
  })

  //
  server.on('connection', (conn) => {
    if (!conn) {
      return
    }
    listen(conn)
    debug('listening mock client.')
  })

  //
  emitter.on('client-connect', incoming)
  emitter.on('reconnection', reconnection)
  //
  emitter.once('close-server', () => {
    if (connection) {
      connection.close()
    }
  })

  //
  return server.middleware({
    prefix: context,
  })
}

//
module.exports = (options) => {
  const { context, proxyContext: ctx } = options
  proxyContext = ctx
  //
  const handler = createHandler(options)
  //
  return (req, res, head, next) => {
    if (req.url.match(`^${context}/`)) {
      return handler(req, res, head)
    }
    next()
  }
}
