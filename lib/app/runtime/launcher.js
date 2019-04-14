import Vue from 'vue'
import mixin from './mixin'
import { formatSetup, getRootElement, installPlugins, toObject } from './utils'

function getBuildInPluginOptions(name, plugins) {
  if (Array.isArray(plugins)) {
    for (const [index, plugin] of Object.entries(plugins)) {
      if (Array.isArray(plugin)) {
        const [pluginName, pluginOptions] = plugin
        if (pluginName === name) {
          plugins.splice(index, 1)
          return pluginOptions
        }
      }
    }
  }
}

export default function appLauncher(base, global, buildInPlugins) {
  const { store, router, ...baseSetup } = toObject(base)

  const { el, render, template, title, plugins, ...globalMixin } = formatSetup(global)

  const globalSetup = { el, render, template }

  if (typeof title === 'string') {
    document.title = title
  }

  // 取得插件项
  // 如果插件为一个数组，则数组的第一项为插件本身，后续项为插件的配置参数
  const usedPlugins = buildInPlugins
    .map((plugin) => [
      plugin,

      // 内建插件可以通过插件名来配置，比如：
      // ['request', {
      //   params: {}
      // }]
      // 非内建插件需要是一个函数或者包含install方法的对象，比如：
      // [ElementUI, {
      //  zIndex: 1000
      // }]
      getBuildInPluginOptions(plugin.name, plugins),

      // 内建插件配置列表的第二个参数设为内建插件列表，方便插件间相互调用
      buildInPlugins,
    ])
    // 非内建插件
    .concat(plugins)

  // 安装使用的插件
  installPlugins(usedPlugins)

  const options = {
    mixins: [mixin, globalMixin],
    el: getRootElement(el),
    template: '<no-app/>',
    ...toObject(baseSetup),
    ...toObject(globalSetup),
    store,
    router,
  }

  return new Vue(options)
}
