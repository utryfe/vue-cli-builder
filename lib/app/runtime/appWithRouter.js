import createRouter from './router'
import createApp from './app'
import { toObject } from './utils'

export default function createAppWithRouter(base, global, module) {
  const { router: baseRouter, ...baseApp } = toObject(base)
  const { router: globalRouter, ...globalApp } = toObject(global)
  const { router: moduleRouter, ...moduleApp } = toObject(module)

  const router = createRouter(baseRouter, globalRouter, moduleRouter)

  return createApp({ ...baseApp, router }, globalApp, moduleApp)
}
