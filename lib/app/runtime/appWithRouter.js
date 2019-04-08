import { toObject } from './utils'
import createRouter from './router'
import createApp from './launcher'

export default function createAppWithRouter(base, global, plugins) {
  const { router: baseRouter, ...baseApp } = toObject(base)
  const { router: globalRouter, ...globalApp } = toObject(global)

  const router = createRouter(baseRouter, globalRouter)

  return createApp({ ...baseApp, router }, globalApp, plugins)
}
