module.exports = {
  // 应用中间件
  apply(middleware, ...args) {
    if (!Array.isArray(middleware)) {
      middleware = [middleware]
    }
    let done = typeof args[args.length - 1] === 'function' ? args.pop() : null
    const next = (err) => {
      if (done) {
        const fn = done
        done = null
        fn(err)
      }
    }
    const call = middleware
      .filter((item) => typeof item === 'function')
      .map((handle) => (next) => handle.apply(null, args.concat(next)))
    //
    if (!call.length) {
      next()
    } else {
      try {
        call.reduceRight((a, b) => () => b(a), next)()
      } catch (e) {
        next(e)
      }
    }
  },
}
