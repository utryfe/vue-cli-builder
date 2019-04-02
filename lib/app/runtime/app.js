import Vue from 'vue'
import { toObject, formatSetup, getRootElement } from './utils'

export default function createApp(base, global, module) {
  const { store, router, ...baseSetup } = toObject(base)

  const {
    el: globalEl,
    title: globalTitle,
    render: globalRender,
    template: globalTemplate,
    ...globalMixin
  } = formatSetup(global)

  const {
    el: moduleEl,
    title: moduleTitle,
    render: moduleRender,
    template: moduleTemplate,
    ...moduleMixin
  } = formatSetup(module)

  const globalSetup = { el: globalEl, render: globalRender, template: globalTemplate }
  const moduleSetup = { el: moduleEl, render: moduleRender, template: moduleTemplate }

  const title = typeof moduleTitle === 'string' ? moduleTitle : globalTitle
  if (typeof title === 'string') {
    document.title = title
  }

  const options = {
    mixins: [globalMixin, moduleMixin],
    el: getRootElement(),
    template: '<no-app/>',
    ...toObject(baseSetup),
    ...toObject(globalSetup),
    ...toObject(moduleSetup),
    store,
    router,
  }

  return new Vue(options)
}
