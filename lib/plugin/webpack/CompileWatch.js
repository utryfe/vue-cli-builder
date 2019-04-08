const { EventEmitter } = require('events')

const debug = require('debug')('plugin:CompileWatch')
// require('debug').enable('plugin:CompileWatch')

const emitter = require('../../utils/emitter')
const CompilerEvent = require('./CompilerEvent')

// 监听模块变化并触发相应重编译
class CompileWatch extends EventEmitter {
  constructor(options) {
    super()
    this.setMaxListeners(0)
    this.options = Object.assign({}, options)
    this.firstCompile = true
    this.awaitCompile = false
    this.recompileImmediate = false
    this.compiled = false
    this.idForRecompile = 0
    debug('construct completed')
  }

  apply(compiler) {
    new CompilerEvent(
      'CompileWatchWebpackPlugin',
      {
        watchRun: this.watchRun,
        invalid: this.invalid,
        done: this.done,
      },
      this
    ).apply(compiler)

    let id

    emitter
      .on('before-entry-update', () => {
        debug('before-entry-update')
        id = this.idForRecompile
        this.recompileImmediate = false
      })
      .on('entry-changed', () => {
        debug('entry-changed')

        if (id === this.idForRecompile) {
          debug('id for compile is not changed, set recompile immediate')
          this.recompileImmediate = true
          return
        }

        if (this.awaitCompile) {
          debug('awaitCompile is true on entry-changed event, emit watch-resolved event')
          this.emit('watch-resolved')
        } else {
          const hint = 'entry file has been changed'
          if (this.compiled) {
            debug('compiled is true on entry-changed event, emit invalidate event')
            emitter.emit('invalidate', hint)
          } else {
            const curId = id
            this.once('compile-done', () => {
              if (curId === id) {
                debug('compile-done event on entry-changed event, emit invalidate event')
                emitter.emit('invalidate', hint)
              }
            })
          }
        }
      })
  }

  async done() {
    this.firstCompile = false
    const { done } = this.options
    if (typeof done === 'function') {
      debug('await to exec done event for user')
      await done()
    }
    debug('compile done')
    this.compiled = true
    this.emit('compile-done')
    emitter.emit('after-compile')
  }

  async watchRun() {
    const { watchRun } = this.options
    if (typeof watchRun === 'function') {
      debug('await to exec watchRun event for user')
      await watchRun()
    }

    debug('emit before-watch-run event')

    if (this.firstCompile) {
      debug('first compile in watch run')
      return
    }

    emitter.emit('before-watch-run')

    const id = ++this.idForRecompile

    if (this.recompileTimer) {
      debug('clear recompile timer')
      clearTimeout(this.recompileTimer)
    }

    // 延迟重编译200ms，等待更新完成
    this.recompileTimer = setTimeout(() => {
      debug('emit watch-resolved event in recompile timer')
      this.recompileTimer = 0
      this.emit('watch-resolved')
    }, 200)

    if (this.recompileBreaker) {
      debug('exec recompile breaker for reject prev watch compile')
      this.recompileBreaker(new Error('Recompile aborted.'))
    }

    return new Promise((resolve, reject) => {
      debug('await to recompile')
      this.recompileBreaker = reject
      this.awaitCompile = true

      this.once('watch-resolved', () => {
        if (id === this.idForRecompile) {
          debug('exec recompile')
          clearTimeout(this.recompileTimer)
          this.recompileTimer = 0
          this.recompileBreaker = null
          this.awaitCompile = false
          this.compiled = false
          resolve()
        }
      })

      setImmediate(() => {
        if (this.recompileImmediate) {
          this.recompileImmediate = false
          if (id === this.idForRecompile) {
            debug('exec recompile immediate')
            this.emit('watch-resolved')
          }
        }
      })
    })
  }

  invalid(filename) {
    debug(`invalid event (%s)`, filename)
    const { invalid } = this.options
    if (typeof invalid === 'function') {
      debug('await to exec invalid event for user')
      invalid(filename)
    }
  }
}

CompileWatch.default = CompileWatch
module.exports = CompileWatch
