const { ensurePathQuote } = require('../utils/file')
const { escapeRegExp, getIdentifierMaker, randomSequence } = require('../utils/common')

function getToObjectUtil() {
  const name = 'toObject'
  const code = `const ${name}=(obj)=>Object.assign({},obj)\n`
  return { name, code }
}

// 生成store配置代码
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

  const toObjectUtil = { name: '', code: '' }

  let storeOptions = JSON.stringify(setup, (key, value) => {
    if (key === storePropName && value) {
      const { namespace, bundle } = value
      const identifier = makeIdentifier(namespace)
      storeImports.push(`import ${identifier} from '${ensurePathQuote(bundle)}'\n`)
      if (!toObjectUtil.name) {
        Object.assign(toObjectUtil, getToObjectUtil())
      }
      return `${tag}${identifier}${tag}`
    }
    if (key === 'modules' && !Object.keys(value).length) {
      return
    }
    return value
  })

  if (toObjectUtil.name) {
    storeOptions = storeOptions
      .replace(new RegExp(`(['"])${escapeRegExp(storePropName)}\\1\\s*:\\s*`, 'g'), '...')
      .replace(new RegExp(`(['"])${tag}(.*?)${tag}\\1`, 'g'), `${toObjectUtil.name}($2)`)
  }

  if (toObjectUtil.code) {
    utilityImports.push(toObjectUtil.code)
  }

  return utilityImports
    .concat(storeImports)
    .concat(`const ${importName}=${storeOptions}\n`)
    .join('\n')
}
