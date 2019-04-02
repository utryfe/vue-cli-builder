import createStore from './store'
import createApp from './app'
import { toObject } from './utils'

export default function createAppWithStore(base, global, module) {
  const { store: baseStore, ...baseApp } = toObject(base)
  const { store: globalStore, ...globalApp } = toObject(global)
  const { store: moduleStore, ...moduleApp } = toObject(module)

  const store = createStore(baseStore, globalStore, moduleStore)

  return createApp({ ...baseApp, store }, globalApp, moduleApp)
}
