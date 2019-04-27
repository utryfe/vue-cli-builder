const endOfLine = require('os').EOL
const { ensurePathQuote, joinPath } = require('../utils/file')
const { app } = require('./packages')

module.exports = ({ config, importName = 'createApp' }) => {
  const { build_app_use_vuex: store, build_app_use_router: router } = config

  let type = ''
  if (store && router) {
    type = 'full'
  } else if (store && !router) {
    type = 'withStore'
  } else if (!store && router) {
    type = 'withRouter'
  } else {
    type = 'only'
  }

  const createAppFile = joinPath(app, `${type}.js`)

  return [`// app creator${endOfLine}`]
    .concat(`import ${importName} from '${ensurePathQuote(createAppFile)}'${endOfLine}`)
    .join(endOfLine)
}
