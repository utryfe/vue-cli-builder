import Vue from 'vue'
import mixin from './mixin'
import { toObject, formatSetup, getRootElement, installPlugins } from './utils'

function getInnerPluginOptions(name, plugins) {
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

export default function appLauncher(base, global, innerPlugins) {
  const { store, router, ...baseSetup } = toObject(base)

  const { el, render, template, title, plugins, ...globalMixin } = formatSetup(global)

  const globalSetup = { el, render, template }

  if (typeof title === 'string') {
    document.title = title
  }

  const usedPlugins = innerPlugins
    .map((plugin) => [plugin, getInnerPluginOptions(plugin.name, plugins)])
    .concat(plugins)

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
