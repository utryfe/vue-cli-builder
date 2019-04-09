const chalk = require('chalk')

const logger = require('../utils/logger')
const emitter = require('../utils/emitter')

const warnings = []
const errors = []
emitter.on('after-compile', () => {
  if (!warnings.length && !errors.length) {
    return
  }
  const printWarnings = warnings.concat()
  const printErrors = errors.concat()
  warnings.length = 0
  errors.length = 0

  setImmediate(() => {
    let log
    while ((log = printWarnings.shift())) {
      logger.warn(chalk['yellow'](typeof log === 'string' ? log : log.message))
    }
    while ((log = printErrors.shift())) {
      logger.error(chalk['red'](typeof log === 'string' ? log : log.message))
    }
    console.log()
  })
})

module.exports = {
  warn(w) {
    if (typeof w === 'string' || (w && w.message)) {
      warnings.push(w)
    }
  },

  error(e) {
    if (typeof e === 'string' || (e && e.message)) {
      errors.push(e)
    }
  },
}
