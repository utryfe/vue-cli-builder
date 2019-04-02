import Vue from 'vue'
import VueRouter from 'vue-router'
import { toObject, formatSetup } from './utils'

Vue.use(VueRouter)

function defaultScrollBehavior() {
  return { x: 0, y: 0 }
}

const defaultSetup = {
  mode: 'hash',
  fallback: true,
  caseSensitive: false,
  scrollBehavior: defaultScrollBehavior,
}

export default function createRouter(base, global, module) {
  const { routes, ...baseSetup } = toObject(base)
  const { created: globalCreated, ...globalSetup } = formatSetup(global)
  const { created: moduleCreated, ...moduleSetup } = formatSetup(module)

  const options = {
    ...defaultSetup,
    ...toObject(baseSetup),
    ...toObject(globalSetup),
    ...toObject(moduleSetup),
    routes,
  }

  const router = new VueRouter(options)

  if (typeof globalCreated === 'function') {
    globalCreated(router)
  }
  if (typeof moduleCreated === 'function') {
    moduleCreated(router)
  }

  return router
}
