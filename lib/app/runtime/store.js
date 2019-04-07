import Vue from './vue'
import Vuex, { Store } from 'vuex'
import { toObject, formatSetup } from './utils'

Vue.use(Vuex)

export default function createStore(base, global) {
  const { modules = {}, ...baseSetup } = toObject(base)
  const { created, ...globalSetup } = formatSetup(global)

  const excludeInGlobal = ['state', 'mutations', 'actions', 'getters', 'modules']
  for (const prop of excludeInGlobal) {
    if (globalSetup.hasOwnProperty(prop)) {
      console.error(
        `The store properties include of '${excludeInGlobal.join(
          '、'
        )}' defined in the main.js file will not take effect.`
      )
      break
    }
  }

  const options = {
    state: {},
    ...toObject(baseSetup),
    ...toObject(globalSetup, excludeInGlobal),
    modules,
  }

  const store = new Store(options)

  if (typeof created === 'function') {
    created(store)
  }

  return store
}
