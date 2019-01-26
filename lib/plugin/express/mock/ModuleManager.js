const fs = require('fs')
const chalk = require('chalk')
//
const logger = require('../../../utils/logger')
const fileUtil = require('../../../utils/file')
const commonUtil = require('../../../utils/common')
//
const registerBabel = require('../../babel/registerBabel')
//
const MockModule = require('./MockModule')
const helper = require('./helper')

/**
 * 管理mock模块文件
 * @type {module.ModuleManager}
 */
module.exports = class ModuleManager {
  //
  constructor(options) {
    this.options = Object.assign({}, options)
    this.mockFiles = []
    this.updating = false
    const { path: mockPath } = this.options
    const { files, pattern } = this.getMockFiles(mockPath)
    this.loadMockModules(files)
    this.watchModulesFile(pattern)
  }

  // 获取mock模块文件
  getMockFiles(mockPath) {
    mockPath = helper.getRelMockPath(mockPath)
    if (fileUtil.isGlob(mockPath)) {
      return {
        files: this.excludeSomeFiles(
          fileUtil
            .matchFileSync(mockPath, { nodir: true })
            .map((file) => fileUtil.resolvePath(file))
        ),
        pattern: mockPath,
      }
    }
    const absMockPath = fileUtil.isAbsolute(mockPath)
      ? mockPath
      : fileUtil.resolvePath(mockPath)
    let files = []
    if (fs.existsSync(absMockPath) && fs.statSync(absMockPath).isDirectory()) {
      if (!this.updating) {
        logger.log(`Load mock data from ${absMockPath} `)
      }
      files = fileUtil
        .matchFileSync('**/*.js', {
          cwd: absMockPath,
          nodir: true,
        })
        .map((file) => fileUtil.joinPath(absMockPath, file))
    }
    return {
      files: this.excludeSomeFiles(files),
      pattern: `${mockPath.replace(/[\\]/g, '/').replace(/\/+$/g, '')}/**/*.js`,
    }
  }

  //
  excludeSomeFiles(files) {
    const { exclude } = this.options
    return exclude ? files.filter((file) => !exclude(file)) : files
  }

  // 加载mock数据
  loadMockModules(mockFiles) {
    const options = this.options
    this.mockFiles = mockFiles
    //
    this.registerBabelTransform()
    //
    helper.clearRequireCache(mockFiles)
    //
    let hasErrors = false
    this.mockModules = mockFiles.reduce((modules, file) => {
      try {
        const module = require(file)
        modules.push(new MockModule({ module, file }, options))
      } catch (e) {
        hasErrors = true
        logger.error(`Mock file parse failed [${file}] [${e.message}]\n`)
      }
      return modules
    }, [])
    //
    if (!hasErrors && !this.updating) {
      logger.log('Mock file parse success.\n')
    }
  }

  //
  registerBabelTransform() {
    if (!this.registered) {
      this.registered = true
      const extraIncludeFiles = [
        /([\\/])@babel\1runtime.*?\1esm\1/,
        /([\\/])babel-runtime.*?\1esm\1/,
      ]
      registerBabel({
        ignore: [
          (path) => {
            if (/([\\/])node_modules\1/.test(path)) {
              return !extraIncludeFiles.some((re) => re.test(path))
            }
            return !this.mockFiles.includes(path)
          },
        ],
      })
    }
  }

  // 监听文件变化，重新加载数据
  watchModulesFile(pattern) {
    const { exclude } = this.options
    commonUtil.watch(pattern, (event, file) => {
      if (exclude(file)) {
        return
      }
      console.log(`Mock ${chalk.cyan(event)}: ${file}, reload mock data.`)
      this.updating = true
      // 重新加载模块
      const { path: mockPath } = this.options
      const { files } = this.getMockFiles(mockPath)
      this.loadMockModules(files)
    })
  }

  getMockModules() {
    const { mockModules } = this
    if (Array.isArray(mockModules)) {
      return [].concat(mockModules)
    }
    return []
  }

  //
}
