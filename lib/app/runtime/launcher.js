import Vue from 'vue'
import mixin from './mixin'
import debug from './debug'
import { toObject, formatSetup, getRootElement, installPlugins } from './utils'

export default function appLauncher(base, global) {
  const { store, router, ...baseSetup } = toObject(base)

  const {
    el,
    render,
    template,
    title,
    plugins,
    debug: debugNamespace,
    ...globalMixin
  } = formatSetup(global)

  const globalSetup = { el, render, template }

  if (typeof title === 'string') {
    document.title = title
  }

  installPlugins([[debug, debugNamespace]].concat(plugins))

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
