//
class CompilerEvent {
  // 编译器事件注册
  constructor(events) {
    this.events = Object.assign({}, events)
  }

  // 应用插件
  apply(compiler) {
    const events = this.events
    Object.keys(events).forEach((name) => {
      const hooks = events[name]
      if (Array.isArray(hooks)) {
        for (const hook of hooks) {
          compiler.plugin(name, hook)
        }
      } else if (typeof hooks === 'function') {
        compiler.plugin(name, hooks)
      }
    })
  }
}

CompilerEvent.default = CompilerEvent
module.exports = CompilerEvent
