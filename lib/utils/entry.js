const env = require('./env')
const file = require('./file')
const console = require('./console')

// 多页入口
function getMultiPages() {
  const pages = {}
  const { MPA_ENTRY, BUILD_MPA, HTML_TEMPLATE } = env()
  const entry = typeof MPA_ENTRY === 'string' ? MPA_ENTRY.split(',') : []
  const targets =
    typeof BUILD_MPA === 'string'
      ? BUILD_MPA.split(',').map((s) => s.trim().toLowerCase())
      : null
  // 获取构建入口
  entry.forEach((pattern) => {
    // 匹配路径模式
    file.matchFileSync(pattern).forEach((path) => {
      const dirName = file.getShortDirName(path).toLowerCase()
      if (targets && targets.indexOf(dirName) === -1) {
        // 非目标文件过滤
        return
      }
      pages[dirName] = {
        entry: path,
        template: HTML_TEMPLATE,
        filename: `${dirName}.html`,
      }
    })
  })
  return pages
}

// 更改输出文件的名称
function modifyName(pages, options) {
  const { outputDir, indexPath, pluginOptions } = options
  const { indexMap } = Object.assign({}, pluginOptions)
  // 映射名称
  if (indexMap) {
    const existNames = Object.keys(pages).reduce((names, page) => {
      names[page] = true
      return names
    }, {})
    Object.keys(indexMap).forEach((name) => {
      const page = pages[name]
      if (page) {
        const targetName = indexMap[name]
        if (!Object.prototype.hasOwnProperty.call(existNames, targetName)) {
          page.filename = `${targetName}.html`
          existNames[targetName] = true
          delete existNames[name]
        } else {
          console.error(
            `[pluginOptions.indexMap] The file name of '${targetName}' already exists. (${name} => ${targetName})`
          )
        }
      }
    })
  }
  // 修改路径
  if (typeof indexPath === 'string') {
    const dirName = file.getDirName(indexPath, outputDir)
    if (dirName) {
      Object.keys(pages).forEach((name) => {
        const page = pages[name]
        page.filename = file.joinPath(dirName, page.filename)
      })
    }
  }
}

let entryPages = null

module.exports = {
  // 转换为页面配置
  toPages(options) {
    if (entryPages) {
      return entryPages
    }
    entryPages = {}
    const { BUILD_MPA, BUILD_SPA, HTML_TEMPLATE, SPA_ENTRY } = env()
    const { indexPath } = options
    //
    if (BUILD_MPA) {
      Object.assign(entryPages, getMultiPages())
    }
    if (
      BUILD_SPA === true ||
      (BUILD_SPA === undefined && BUILD_MPA === undefined)
    ) {
      // 构建单页应用
      entryPages.index = {
        entry: SPA_ENTRY,
        template: HTML_TEMPLATE,
        filename: indexPath,
      }
    }
    // 修改名称
    modifyName(entryPages, options)
    return entryPages
  },
}
