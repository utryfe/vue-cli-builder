const console = require('../../utils/console')

class CompilerEvent {
  // 编译器事件注册
  constructor(events) {
    this.events = Object.assign({}, events)
  }
  // 应用插件
  apply(compiler) {
    const events = this.events
    Object.keys(events).forEach((event) => {
      try {
        const listeners = CompilerEvent.getListeners(events[event])
        if (listeners) {
          compiler.plugin(event, CompilerEvent.emit.bind(this, listeners))
        }
      } catch (e) {
        console.error(e, true)
      }
    })
  }
}

// 获取注册的监听函数
CompilerEvent.getListeners = function(listeners) {
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

// 发布事件
CompilerEvent.emit = function(listeners, ...args) {
  const tasks = []
  for (const fn of listeners) {
    try {
      const res = fn.apply(null, [].concat(args))
      tasks.push(res instanceof Promise ? res : Promise.resolve())
    } catch (e) {
      tasks.push(Promise.reject(e))
    }
  }
  Promise.all(tasks).then(() => {
    const callback = args.pop()
    if (typeof callback === 'function') {
      callback()
    }
  })
}

CompilerEvent.default = CompilerEvent
module.exports = CompilerEvent
