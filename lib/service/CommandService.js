const fs = require('fs')

const fileUtil = require('../utils/file')
const pkg = require('../utils/package')
const env = require('../utils/env')
const debug = require('debug')('service:command')

// 命名行服务
class CommandService {
  //
  constructor(setup) {
    const { plugin, options } = setup
    this.plugin = plugin
    this.options = options

    // 执行命令的webpack配置
    plugin.chainWebpack((chainConfig) => {
      Object.values(CommandService.commands).forEach((module) => {
        const { chainWebpack } = module
        if (typeof chainWebpack === 'function') {
          chainWebpack(chainConfig, options)
        }
      })
    })
  }

  // 注册命令
  registerCommand() {
    const { plugin, options } = this
    // 批量注册命名行命令
    const commands = CommandService.commands
    const command = env.command
    const commandList = env.commandList

    Object.keys(commands).forEach((name) => {
      const module = commands[name]

      let { help, init } = module
      if (typeof help === 'function') {
        help = help(options)
      }

      if (typeof init === 'function') {
        init(plugin, options)
        debug(`command init: ${name}:${command}:${commandList}`)
      }

      const cmd = module(plugin, options)

      if (help && typeof help === 'object') {
        plugin.registerCommand(name, help, cmd)
      } else {
        plugin.registerCommand(name, cmd)
      }
    })
  }
}

// 可用的命令列表
CommandService.commands = {}
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
      //
      const absPath = fileUtil.joinPath(cwd, file)
      const name = fileUtil.getFileBaseName(absPath, true)

      if (commands.hasOwnProperty(name)) {
        console.error(`\nThe name of command with '${name}' is already exists.\n`)
        process.exit(1)
      }

      const module = require(absPath)
      const { script, defaultMode } = Object.assign({}, module)
      const scriptName = typeof script === 'string' ? script.trim() : ''
      const mode = typeof defaultMode === 'string' ? defaultMode.trim() : ''

      // 自定义命令
      commands[name] = module

      // 默认的命令模式
      if (mode) {
        modes[name] = mode
      }

      // 脚本命令名称
      if (scriptName) {
        scripts[name] = `vue-cli-service ${scriptName}`
      }
    }

    if (Object.keys(scripts).length) {
      // 写入package.json文件中
      pkg.write(
        { scripts },
        {
          normalize: false,
          overwrite: false,
        }
      )
    }
  } catch (e) {
    console.error(e.message)
  }
}

// 加载所有命令
CommandService.loadCommands()

module.exports = CommandService
