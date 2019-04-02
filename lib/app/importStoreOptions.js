const { ensurePathQuote } = require('../utils/file')
const { escapeRegExp, getIdentifierMaker, randomSequence } = require('../utils/common')

module.exports = ({ bundles, config, importName = 'storeOptions' }) => {
  const { BUILD_APP_USE_VUEX } = config
  if (!bundles || !BUILD_APP_USE_VUEX) {
    return `const ${importName} = undefined\n`
  }

  const importStores = []
  const tag = `<${randomSequence()}>`
  const makeIdentifier = getIdentifierMaker('store', {
    [importName]: 1,
  })

  const { modules, state, storePropName } = bundles

  // 这里要明确属性声明顺序
  const setup = { state }
  if (bundles[storePropName]) {
    setup[storePropName] = bundles[storePropName]
  }
  setup.modules = modules

  const storeOptions = JSON.stringify(setup, (key, value) => {
    if (key === storePropName && value) {
      const { namespace, bundle } = value
      const identifier = makeIdentifier(namespace)
      importStores.push(`import ${identifier} from '${ensurePathQuote(bundle)}'\n`)
      return `${tag}${identifier}${tag}`
    }
    if (key === 'modules' && !Object.keys(value).length) {
      return
    }
    return value
  })
    .replace(new RegExp(`(['"])${escapeRegExp(storePropName)}\\1\\s*:\\s*`, 'g'), '...')
    .replace(new RegExp(`(['"])${tag}(.*?)${tag}\\1`, 'g'), 'Object.assign({},$2)')

  return importStores.concat(`const ${importName} = ${storeOptions}\n`).join('\n')
}
