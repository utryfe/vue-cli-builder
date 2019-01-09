const path = require('path')
//
const template = require('lodash/template')
const serveStatic = require('serve-static')
const isFinished = require('on-finished').isFinished
const finalhandler = require('finalhandler')
const debug = require('debug')('mock:socket:staticServer')
//
const applyMiddleware = require('../../../../utils/middleware').apply

function getWebRootDir() {
  return path.join(__dirname, '..', 'static')
}

//
const rootDir = getWebRootDir()

//
const serve = serveStatic(rootDir, {})

//
function handleIndexHTML(options) {
  return (req, res, next) => {
    if (/^\/(?:index\.html?)?$/.test(req.url)) {
      const { port, host, context, server } = options
      debug('request for index html')
      //
      return fs.readFile(`${rootDir}/index.html`, (err, buf) => {
        if (err) {
          return finalhandler(req, res)(err)
        }
        const address = `${host}${port === '80' ? '' : `:${port}`}`
        //
        res.setHeader('Content-Type', 'text/html')
        res.end(
          template(buf.toString())({
            context,
            server,
            address,
          })
        )
      })
    }
    //
    next()
  }
}

//
function handleStaticResource(options) {
  return (req, res, next) => {
    const url = req.url
    //
    if (/\/iframe\.html?$/.test(url)) {
      debug('request for sockjs iframe.')
      return fs.readFile(`${rootDir}/iframe.html`, (err, buf) => {
        if (err) {
          return finalhandler(req, res)(err)
        }
        res.setHeader('Content-Type', 'text/html')
        res.end(buf, () => {})
      })
    }
    //
    const { context, proxyContext } = options
    if (!url.match(`^(?:${context}|${proxyContext})/`) || isFinished(req)) {
      debug('request for static resource.')
      return serve(req, res, finalhandler(req, res))
    }
    //
    next()
  }
}

//
module.exports = (options) => {
  return (req, res, head, next) => {
    //
    applyMiddleware(
      [
        handleIndexHTML(options),
        //
        handleStaticResource(options),
      ],
      req,
      res,
      next
    )
  }
}
