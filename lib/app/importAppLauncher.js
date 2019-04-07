const { ensurePathQuote, joinPath } = require('../utils/file')

module.exports = ({ config, importName = 'createApp' }) => {
  const { build_app_use_vuex: store, build_app_use_router: router } = config

  let type = ''
  if (store && router) {
    type = 'appFull'
  } else if (store && !router) {
    type = 'appWithStore'
  } else if (!store && router) {
    type = 'appWithRouter'
  } else {
    type = 'appOnly'
  }

  const createAppFile = joinPath(__dirname, 'runtime', `${type}.js`)

  return `import ${importName} from '${ensurePathQuote(createAppFile)}'\n`
}
