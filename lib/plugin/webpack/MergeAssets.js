const fs = require('fs')
const { promisify } = require('util')
const readFile = promisify(fs.readFile)
const debug = require('debug')('plugin:MergeAsserts')

//
const CompilerEvent = require('./CompilerEvent')
//
const commonUtil = require('../../utils/common')
const fileUtil = require('../../utils/file')

class MergeAssets {
  // 合并资源插件
  constructor(options) {
    this.options = Object.assign({}, options)
    this.cache = {}
  }

  apply(compiler) {
    //
    new CompilerEvent(
      'MergeAssertsPlugin',
      //
      {
        emit: this.emit,
      },
      this
    ).apply(compiler)
  }

  async emit(compilation) {
    const { asserts, bundle: bundleName } = this.options
    if (Array.isArray(asserts)) {
      const content = await this.merge(asserts)
      const regExp = /\[((?:content)hash)(?::(8|16|32))?]/g
      const matcher = regExp.exec(bundleName)
      let name = bundleName
      if (matcher) {
        name = bundleName.replace(regExp, commonUtil.hash(content, matcher[2]))
      }
      compilation.assets[name] = content
    }
  }

  async merge(asserts) {
    const { cache, context } = this.options
    const contents = cache ? this.cache : {}
    const ctx = context || process.cwd()
    for (let file of asserts) {
      if (!fileUtil.isAbsolute(file)) {
        file = fileUtil.joinPath(ctx, file)
      }
      if (!contents[file] && fs.existsSync(file)) {
        try {
          contents[file] = await readFile(file, 'utf8')
        } catch (e) {
          debug(e.message)
        }
      }
    }
    //
    let body = ''
    Object.keys(contents).forEach((file) => {
      body = body + contents[file] + '\n\n'
    })
    return body
  }
}

MergeAssets.default = MergeAssets
module.exports = MergeAssets
