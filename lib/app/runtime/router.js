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

export default function createRouter(base, global) {
  const { routes = [], ...baseSetup } = toObject(base)
  const { created, ...globalSetup } = formatSetup(global)

  const options = {
    ...defaultSetup,
    ...toObject(baseSetup),
    ...toObject(globalSetup),
    routes,
  }

  const router = new VueRouter(options)

  router.afterEach((to) => {
    const [component] = router.getMatchedComponents(to)
    if (component) {
      const { title } = component
      if (typeof title === 'string') {
        document.title = title
      }
    }
  })

  if (typeof created === 'function') {
    created.call(router, router)
  }

  return router
}
