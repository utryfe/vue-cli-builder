const endOfLine = require('os').EOL
const fs = require('fs')
const upperFirst = require('lodash/upperFirst')

const { joinPath, ensurePathQuote, getFileBaseName } = require('../utils/file')
const logger = require('../utils/logger')
const { plugins: pluginPath } = require('./packages')

let innerPlugins
try {
  innerPlugins = fs.readdirSync(pluginPath).map((file) => ({
    name: getFileBaseName(file, true),
    file: joinPath(pluginPath, file),
  }))
} catch (e) {
  innerPlugins = []
}

module.exports = exports = ({ config, httpMock, importName = 'plugins' }) => {
  const { build_app_plugins } = config

  const foundPlugins = Array.from(
    new Set(build_app_plugins.split(',').map((name) => name.trim()))
  )
    .concat(httpMock ? ['mock'] : [])
    .reduce((plugins, pluginName) => {
      if (!pluginName) {
        return plugins
      }

      const { file } = innerPlugins.find(({ name }) => name === pluginName) || {}
      if (file) {
        plugins.push({ name: `plugin${upperFirst(pluginName)}`, file })
      } else {
        logger.error(
          `\nCan not find the plugin named by ${pluginName}. Available plugins: ${innerPlugins
            .map(({ name }) => name)
            .join('、')}\n`
        )
        process.exit(2)
      }

      return plugins
    }, [])

  let importPlugins
  if (foundPlugins.length) {
    importPlugins = [`// plugin${endOfLine}`]
      .concat(
        foundPlugins.map(
          ({ name, file }) => `import ${name} from '${ensurePathQuote(file)}'${endOfLine}`
        )
      )
      .concat(
        `const ${importName}=[${foundPlugins
          .map(({ name }) => name)
          .join(',')}]${endOfLine}`
      )
  } else {
    importPlugins = [`const ${importName}=[]${endOfLine}`]
  }

  return importPlugins.join(endOfLine)
}
