let pkg
try {
  pkg = require.resolve('icefox').replace(/index\.js$/, '')
} catch (e) {
  logger.error('\nThe icefox dependency were not found.\n')
  process.exit(2)
}

const path = require('path')

module.exports = exports = {
  plugins: path.join(pkg, 'lib/plugins'),
  app: path.join(pkg, 'lib/app'),
}
