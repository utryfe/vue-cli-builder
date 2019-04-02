import Vue from 'vue'
import Vuex, { Store } from 'vuex'
import { toObject, formatSetup } from './utils'

Vue.use(Vuex)

export default function createStore(base, global, module) {
  const { modules, ...baseSetup } = toObject(base)
  const { created: globalCreated, ...globalSetup } = formatSetup(global)
  const { created: moduleCreated, ...moduleSetup } = formatSetup(module)

  const options = {
    state: {},
    ...toObject(baseSetup),
    ...toObject(globalSetup),
    ...toObject(moduleSetup),
    modules,
  }

  const store = new Store(options)

  if (typeof globalCreated === 'function') {
    globalCreated(store)
  }
  if (typeof moduleCreated === 'function') {
    moduleCreated(store)
  }

  return store
}
