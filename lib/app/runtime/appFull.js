import createStore from './store'
import createRouter from './router'
import createApp from './app'
import { toObject } from './utils'

export default function createAppFull(base, global, module) {
  const { store: baseStore, router: baseRouter, ...baseApp } = toObject(base)
  const { store: globalStore, router: globalRouter, ...globalApp } = toObject(global)
  const { store: moduleStore, router: moduleRouter, ...moduleApp } = toObject(module)

  const store = createStore(baseStore, globalStore, moduleStore)
  const router = createRouter(baseRouter, globalRouter, moduleRouter)

  return createApp({ ...baseApp, store, router }, globalApp, moduleApp)
}
