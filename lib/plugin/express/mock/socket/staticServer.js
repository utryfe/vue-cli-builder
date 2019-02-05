const fs = require('fs')
const path = require('path')
//
const template = require('lodash/template')
const serveStatic = require('serve-static')
const isFinished = require('on-finished').isFinished
const finalhandler = require('finalhandler')
const debug = require('debug')('mock:socket:staticServer')
//
const applyMiddleware = require('../../../../utils/middleware')
const commonUtils = require('../../../../utils/common')

function getWebRootDir() {
  return path.join(require.resolve('ut-builder-socket-client'), '..', 'dist')
}

//
const rootDir = getWebRootDir()

debug('web context [%s]', rootDir)

//
const serve = serveStatic(rootDir, {})

//
function handleIndexHTML(options) {
  return (req, res, next) => {
    if (/^\/(?:index\.html?)?$/.test(req.url)) {
      const { port, context, client } = options
      debug('request for index html')
      //
      return fs.readFile(`${rootDir}/index.html`, async (err, buf) => {
        if (err) {
          return finalhandler(req, res)(err)
        }
        const host = await commonUtils.getNetworkHostIP()
        const address = `${host}${port === '80' ? '' : `:${port}`}`
        //
        res.setHeader('Content-Type', 'text/html')
        res.end(
          template(buf.toString())({
            context,
            client,
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
    if (!url.match(`^(?:${context}|${proxyContext})/`) && !isFinished(req)) {
      debug('request for static resource. %s', req.url)
      return serve(req, res, finalhandler(req, res))
    }
    //
    next()
  }
}

//
module.exports = (options) => {
  const indexHandler = handleIndexHTML(options)
  const staticHandler = handleStaticResource(options)
  return (req, res, head, next) => {
    applyMiddleware([indexHandler, staticHandler], req, res, next)
  }
}
