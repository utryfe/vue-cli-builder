const chalk = require('chalk')

const logger = require('../utils/logger')
const emitter = require('../utils/emitter')

const warnings = []
const errors = []
emitter.on('after-compile', () => {
  if (!warnings.length && !errors.length) {
    return
  }
  console.log()

  let log
  while ((log = warnings.shift())) {
    logger.warn(chalk['yellow'](typeof log === 'string' ? log : log.message))
  }
  while ((log = errors.shift())) {
    logger.error(chalk['red'](typeof log === 'string' ? log : log.message))
  }
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
