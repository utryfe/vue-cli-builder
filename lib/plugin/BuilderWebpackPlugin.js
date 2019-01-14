const logger = require('../utils/logger')
const runner = require('../utils/runTask')

// 管理插件hooks
class BuilderWebpackPlugin {
  apply(compiler) {
    // 统一注册自定义插件注册的hooks
    Object.keys(BuilderWebpackPlugin.hooks).forEach((name) => {
      BuilderWebpackPlugin.applyHooks(compiler, name)
    })
  }
}

// hooks注册表
BuilderWebpackPlugin.hooks = {}

// 可注册的hooks类型
BuilderWebpackPlugin.hooksMap = {
  shouldEmit: 'tap',
  done: 'tapAsync',
  additionalPass: 'tapAsync',
  beforeRun: 'tapAsync',
  run: 'tapAsync',
  emit: 'tapAsync',
  afterEmit: 'tapAsync',
  thisCompilation: 'tap',
  compilation: 'tap',
  normalModuleFactory: 'tap',
  contextModuleFactory: 'tap',
  beforeCompile: 'tapAsync',
  compile: 'tap',
  make: 'tapAsync',
  afterCompile: 'tapAsync',
  watchRun: 'tapAsync',
  failed: 'tap',
  invalid: 'tap',
  watchClose: 'tap',
  environment: 'tap',
  afterEnvironment: 'tap',
  afterPlugins: 'tap',
  afterResolvers: 'tap',
  entryOption: 'tap',
}

// 应用插件hooks
BuilderWebpackPlugin.applyHooks = function(compiler, name) {
  const emit = BuilderWebpackPlugin.callHooks.bind(null, name)
  if (compiler.hooks) {
    const hooksMap = BuilderWebpackPlugin.hooksMap
    const camelName = name.replace(/-([a-zA-Z])/g, (t, s) => s.toUpperCase())
    try {
      compiler.hooks[camelName][hooksMap[camelName]](
        { name: 'UTBuilderWebpackPlugin' },
        emit
      )
    } catch (e) {
      logger.error(e)
    }
    return
  }
  compiler.plugin(name.replace(/([A-Z]+)/g, '-$1').toLowerCase(), emit)
}

// 执行hooks
BuilderWebpackPlugin.callHooks = function(name, ...args) {
  const camelName = name.replace(/-([a-zA-Z])/g, (t, s) => s.toUpperCase())
  let hooks = BuilderWebpackPlugin.hooks[name]
  hooks = (Array.isArray(hooks) ? hooks : [hooks])
    .filter((hook) => typeof hook === 'function')
    // 优先级排序
    .sort((a, b) => {
      const res = (+a.priority || 0) - (+b.priority || 0)
      if (res > 0) {
        return -1
      }
      if (res < 0) {
        return 1
      }
      return 0
    })
  if (BuilderWebpackPlugin.hooksMap[camelName] === 'tap') {
    // 同步执行
    for (const hook of hooks) {
      hook.apply(null, args)
    }
  } else {
    // 异步执行
    runner(hooks.map((hook) => () => hook.apply(null, args))).then(() => {
      const done = args.pop()
      if (typeof done === 'function') {
        done()
      }
    })
  }
}

// 注册
BuilderWebpackPlugin.registerHooks = function(name, handler) {
  const hooksMap = BuilderWebpackPlugin.hooksMap
  const camelName = name.replace(/-([a-zA-Z])/g, (t, s) => s.toUpperCase())
  if (
    typeof handler === 'function' &&
    Object.prototype.hasOwnProperty.call(hooksMap, camelName)
  ) {
    const hooks = BuilderWebpackPlugin.hooks[name] || []
    BuilderWebpackPlugin.hooks[name] = hooks
    hooks.push(handler)
  } else {
    logger.error(`Illegal hooks name. (${name})`)
    process.exit(1)
  }
}

BuilderWebpackPlugin.default = BuilderWebpackPlugin
module.exports = BuilderWebpackPlugin
