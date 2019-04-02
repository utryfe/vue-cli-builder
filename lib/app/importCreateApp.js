const { ensurePathQuote, joinPath } = require('../utils/file')

module.exports = ({ config, importName = 'createApp' }) => {
  const { BUILD_APP_USE_VUEX: store, BUILD_APP_USE_ROUTER: router } = config

  let createAppFile = ''
  if (store && router) {
    createAppFile = 'appFull'
  } else if (store && !router) {
    createAppFile = 'appWithStore'
  } else if (!store && router) {
    createAppFile = 'appWithRouter'
  } else {
    createAppFile = 'appOnly'
  }

  return `import ${importName} from '${ensurePathQuote(
    joinPath(__dirname, 'runtime', createAppFile)
  )}'\n`
}
