module.exports = {
  // 应用中间件
  apply(middleware, req, res, next) {
    if (!Array.isArray(middleware)) {
      middleware = [middleware]
    }
    const _next = (err) => {
      if (next) {
        next(err)
        next = null
      }
    }
    const call = middleware
      .filter((item) => typeof item === 'function')
      .map((handle) => (next) => handle(req, res, next))
    //
    if (!call.length) {
      next()
    } else {
      try {
        call.reduceRight((a, b) => () => b(a), _next)()
      } catch (e) {
        _next(e)
      }
    }
  },
}
