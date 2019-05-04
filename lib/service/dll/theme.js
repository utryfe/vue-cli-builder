//
const { getAbsPath } = require('../../utils/file')

// 主题样式处理
module.exports = ({ config }, options) => {
  if (!options) {
    return false
  }

  if (!Array.isArray(options)) {
    options = [options]
  }

  const preProcessorMap = {}
  const preProcessorTypes = ['sass', 'scss', 'stylus', 'less']

  for (let opts of options) {
    if (typeof opts === 'string') {
      opts = { patterns: opts }
    }

    const { preProcessor = 'less', patterns, ...pluginOptions } = Object.assign({}, opts)
    if (!patterns || !preProcessorTypes.includes(preProcessor)) {
      continue
    }

    const resourcePatterns = []
    for (const resource of Array.isArray(patterns) ? patterns : [patterns]) {
      const absPath = getAbsPath(resource)
      if (!absPath) {
        continue
      }
      resourcePatterns.push(absPath)
    }

    if (!resourcePatterns.length) {
      continue
    }

    if (preProcessorMap[preProcessor]) {
      const patterns = preProcessorMap[preProcessor].patterns
      for (const res of resourcePatterns) {
        if (!patterns.includes(res)) {
          patterns.push(res)
        }
      }
    } else {
      preProcessorMap[preProcessor] = {
        injector: 'append',
        ...pluginOptions,
        patterns: resourcePatterns,
      }
    }
  }

  const loader = 'style-resources-loader'
  const loaderPath = require.resolve(loader)
  const moduleTypes = ['normal', 'normal-modules', 'vue', 'vue-modules']
  for (const [preProcessor, options] of Object.entries(preProcessorMap)) {
    for (const type of moduleTypes) {
      config.module
        .rule(preProcessor)
        .oneOf(type)
        .use(loader)
        .loader(loaderPath)
        .options(options)
    }
  }
}
