const { resolvePackage } = require('./common')

let pkgRoot
let mainPath
try {
  ;({ main: mainPath, path: pkgRoot } = resolvePackage('icefox'))
} catch (e) {
  logger.error('\nThe icefox dependency were not found.\n')
  process.exit(2)
}

const path = require('path')
const lib = 'lib'

module.exports = exports = {
  // 包根目录
  root: pkgRoot,
  // 包入口文件
  main: mainPath,
  // 应用的包目录
  lib: path.join(pkgRoot, 'lib'),
  // 代码目录：app
  app: path.join(pkgRoot, lib, 'app'),
  // 代码目录：plugins
  plugins: path.join(pkgRoot, lib, 'plugins'),
  // 代码目录：components
  components: path.join(pkgRoot, lib, 'components'),
  // 静态资源目录
  assets: path.join(pkgRoot, lib, 'assets'),
}
