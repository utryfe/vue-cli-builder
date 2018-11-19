const console = require('../../utils/console')

module.exports = class CompilerEvent {
  // 编译器事件注册
  constructor(events) {
    this.events = Object.assign({}, events)
  }
  // 获取注册的监听函数
  getListeners(listeners) {
    if (typeof listeners === 'function') {
      return [listeners]
    }
    if (Array.isArray(listeners)) {
      listeners = listeners.filter((listener) => typeof listener === 'function')
      if (listeners.length) {
        return listeners
      }
    }
    return null
  }
  //
  apply(compiler) {
    const events = this.events
    Object.keys(events).forEach((event) => {
      try {
        const listeners = this.getListeners(events[event])
        if (listeners) {
          compiler.plugin(event, (...args) => {
            for (const fn of listeners) {
              try {
                fn.apply(null, args)
              } catch (e) {
                console.error(e, true)
              }
            }
          })
        }
      } catch (e) {
        console.error(e, true)
      }
    })
  }
}
