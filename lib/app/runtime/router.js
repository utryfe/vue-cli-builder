import Vue from 'vue'
import VueRouter from 'vue-router'
import { formatSetup, toObject } from './utils'

Vue.use(VueRouter)

/**
 * 根据导航的路由组件，自动设置文档的标题。
 * @param router 路由器。
 */
function setEachRouteDocumentTitle(router) {
  router.afterEach((to) => {
    const components = router.getMatchedComponents(to)
    const component = components.pop()
    if (component) {
      const { title } = component
      if (typeof title === 'string') {
        document.title = title
      }
    }
  })
}

function defaultScrollBehavior() {
  return { x: 0, y: 0 }
}

const defaultSetup = {
  base: '/',
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

  setEachRouteDocumentTitle(router)

  if (typeof created === 'function') {
    created.call(router, router)
  }

  return router
}
