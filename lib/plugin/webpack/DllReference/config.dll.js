const os = require('os')
const path = require('path')

const output = path.join(os.homedir(), '.node_cache', 'dll')

module.exports = {
  pages: {},
  outputDir: output,
  assetsDir: '',
  filenameHashing: false,
  runtimeCompiler: true,
  productionSourceMap: false,
  css: {
    extract: false,
    modules: false,
    sourceMap: false,
  },
  lintOnSave: false,
}
