const { ensurePathQuote } = require('../utils/file')
const { escapeRegExp, getIdentifierMaker, randomSequence } = require('../utils/common')

module.exports = ({ bundles, config, importName = 'storeOptions' }) => {
  const { build_app_use_vuex } = config
  if (!bundles || !build_app_use_vuex) {
    return `const ${importName}=undefined\n`
  }

  const storeImports = ['// store\n']
  const utilityImports = []
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

  let toObjectUtil = ''

  const storeOptions = JSON.stringify(setup, (key, value) => {
    if (key === storePropName && value) {
      const { namespace, bundle } = value
      const identifier = makeIdentifier(namespace)
      storeImports.push(`import ${identifier} from '${ensurePathQuote(bundle)}'\n`)
      if (!toObjectUtil) {
        toObjectUtil = 'toObject'
        utilityImports.push(`const ${toObjectUtil}=(obj)=>Object.assign({},obj)\n`)
      }
      return `${tag}${identifier}${tag}`
    }
    if (key === 'modules' && !Object.keys(value).length) {
      return
    }
    return value
  })
    .replace(new RegExp(`(['"])${escapeRegExp(storePropName)}\\1\\s*:\\s*`, 'g'), '...')
    .replace(new RegExp(`(['"])${tag}(.*?)${tag}\\1`, 'g'), `${toObjectUtil}($2)`)

  return utilityImports
    .concat(storeImports)
    .concat(`const ${importName}=${storeOptions}\n`)
    .join('\n')
}
