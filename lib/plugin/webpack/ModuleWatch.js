const CompilerEvent = require('./CompilerEvent')
const emitter = require('../../utils/emitter')

// 监听模块变化，重新执行代码生成
class ModuleWatch {
  constructor(options) {
    this.options = Object.assign({}, options)
    this.inited = false
  }

  //
  apply(compiler) {
    //
    new CompilerEvent(
      'ModuleWatchWebpackPlugin',
      //
      {
        watchRun: this.watch,
        invalid: this.dirtyChange,
      },
      this
    ).apply(compiler)
  }

  watch() {
    if (!this.inited) {
      this.inited = true
      // 初始化
      return Promise.resolve()
    }
    const event = 'watch-resolved'
    //
    if (this.timer) {
      clearTimeout(this.timer)
      if (this.breaker) {
        this.breaker()
      }
    }
    const timer = (this.timer = setTimeout(() => {
      // 等待200ms，期间有可能有同步代码写任务
      emitter.emit(event)
    }, 200))
    //
    return new Promise((resolve, reject) => {
      const breaker = (this.breaker = () => {
        if (breaker === this.breaker) {
          this.breaker = null
        }
        reject(new Error('aborted'))
      })
      //
      emitter.once(event, () => {
        clearTimeout(timer)
        if (timer === this.timer) {
          resolve()
        } else {
          breaker()
        }
      })
    })
  }

  dirtyChange(filename) {
    const { onChange } = this.options
    return new Promise((resolve) => {
      if (typeof onChange === 'function') {
        onChange(filename, resolve)
      } else {
        resolve()
      }
    })
  }
}

ModuleWatch.default = ModuleWatch
module.exports = ModuleWatch
