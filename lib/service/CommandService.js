// 命名行服务
class CommandService {
  // 测试命令
  test(args) {}

  // 开发服务命令
  serve(args) {}

  // 构建命令
  build(args) {}

  //
  constructor(setup) {
    const { plugin, options, prefix = 'ut' } = setup
    this.plugin = plugin
    this.options = options
    // 命令前缀
    this.prefix = prefix
  }

  // 注册命令
  registerCommand() {
    const plugin = this.plugin
    const prefix = this.prefix
    const exclude = /^(constructor|registerCommand)$/
    const prototype = Object.getPrototypeOf(this)
    // 批量注册命名行命令
    Object.getOwnPropertyNames(prototype).forEach((key) => {
      if (!exclude.test(key)) {
        const property = prototype[key]
        if (typeof property === 'function') {
          plugin.registerCommand(
            // 添加命令前缀，防止跟vue插件命令重名
            `${prefix ? `${prefix}-` : ''}${key}`,
            property.bind(this)
          )
        }
      }
    })
  }
}

// // 命令模式
CommandService.commandModes = {
  // test: 'test',
  // serve: 'development',
  // build: 'production',
}

module.exports = CommandService
