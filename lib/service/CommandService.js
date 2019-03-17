const fs = require('fs')
const fileUtil = require('../utils/file')
const pkg = require('../utils/package')

// 命名行服务
class CommandService {
  //
  constructor(setup) {
    const { plugin, options } = setup
    this.plugin = plugin
    this.options = options
    // 执行命名插件的webpack配置
    plugin.chainWebpack((chainConfig) => {
      for (const cmd of CommandService.commands) {
        const { chainWebpack } = cmd
        if (typeof chainWebpack === 'function') {
          chainWebpack(chainConfig, options)
        }
      }
    })
  }

  // 注册命令
  registerCommand() {
    const { plugin, options } = this
    // 批量注册命名行命令
    for (const cmd of CommandService.commands) {
      const { name, module } = cmd
      plugin.registerCommand(name, module(this, options))
    }
  }
}

// 可用的命令列表
CommandService.commands = []
// 命令模式
CommandService.commandModes = {}
// 加载所有命令
CommandService.loadCommands = function() {
  try {
    const cwd = fileUtil.joinPath(__dirname, 'commands')
    const files = fs.readdirSync(cwd)
    const commands = CommandService.commands
    const modes = CommandService.commandModes
    const scripts = {}

    // 加载
    for (const file of files) {
      const absPath = fileUtil.joinPath(cwd, file)
      const module = require(absPath)
      const { command, mode, chainWebpack } = Object.assign({}, module)
      const cmd = typeof command === 'string' ? command.trim() : ''
      const md = typeof mode === 'string' ? mode.trim() : ''
      const name = cmd || fileUtil.getFileBaseName(absPath, true)
      commands.push({
        chainWebpack,
        module,
        name,
      })
      if (md) {
        modes[name] = md
      }
      scripts[name] = `vue-cli-service ${name}`
    }

    // 写入package.json文件中
    pkg.write(
      { scripts },
      {
        normalize: false,
        overwrite: false,
      }
    )
  } catch (e) {
    console.error(e.message)
  }
}

// 加载所有命令
CommandService.loadCommands()

module.exports = CommandService
