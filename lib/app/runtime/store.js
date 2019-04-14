import Vue from 'vue'
import Vuex, { Store } from 'vuex'
import { formatSetup, toObject } from './utils'

Vue.use(Vuex)

function checkGlobalSetup(setup, excluded) {
  for (const prop of excluded) {
    if (setup.hasOwnProperty(prop)) {
      console.error(
        `The store properties include of '${excluded.join(
          '、'
        )}' defined in the main.js file will not take effect.`
      )
      break
    }
  }
}

/**
 * 判断参数是否是一个请求服务配置
 * @param callee 要检测的配置参数
 * @returns {boolean}
 */
function isService(callee) {
  return (
    typeof callee === 'string' ||
    (callee !== null && typeof callee === 'object' && typeof callee.url === 'string')
  )
}

/**
 * 获取异步调用器。
 * @param plugin 用于发起请求插件。
 * @returns {call}
 */
function getAsyncCall(plugin) {
  return function call(callee, ...args) {
    let res
    if (typeof callee instanceof Promise) {
      return callee
    } else if (typeof callee === 'function') {
      res = Promise.resolve(callee(...args))
    } else if (plugin && isService(callee)) {
      // 请求返回的本身就是promise，且添加了访问属性的
      // 不要使用Promise.resolve处理
      res = plugin.request(callee, ...args)
    } else {
      res = Promise.resolve(callee)
    }
    // 返回一个Promise
    return res
  }
}

/**
 * 递归将call注入actions的上下文中。
 * @param store 配置对象。
 * @param call 异步call函数。
 * @returns {*}
 */
function injectActionCall(store, call) {
  const { actions, modules } = Object.assign({}, store)
  if (actions && typeof actions === 'object') {
    for (const [type, action] of Object.entries(actions)) {
      if (typeof action === 'function') {
        actions[type] = function(context, payload) {
          return action.call(this, { ...context, call }, payload)
        }
      }
    }
  }
  if (modules && typeof modules === 'object') {
    for (const [name, module] of Object.entries(modules)) {
      modules[name] = injectActionCall(module, call)
    }
  }
  return store
}

/**
 * 创建一个Store实例。
 * @param base 基础配置。
 * @param global 全局配置。
 * @param plugins 启用的内建插件列表。
 * @returns {Store<any>}
 */
export default function createStore(base, global, plugins) {
  const { modules = {}, ...baseSetup } = toObject(base)
  const { created, ...globalSetup } = formatSetup(global)
  const excludeInGlobal = ['state', 'mutations', 'actions', 'getters', 'modules']

  // 因为要保证模块化的正确性，这里不允许从main.js主入口配置中设置store状态相关的配置
  // 根store可以放置在页面（视图）根目录下（也即 '/' 路径下 ）
  checkGlobalSetup(globalSetup, excludeInGlobal)

  const options = {
    state: {},
    ...toObject(baseSetup),
    ...toObject(globalSetup, excludeInGlobal),
    modules,
  }

  // 内建的用于ajax请求的插件不一定被用户允许安装了
  // 这里查找下
  const requestPlugin = plugins.find(({ name }) => name === 'request')

  const store = new Store(
    // store上下文中，我们注入call函数，可用进行promise化，或者根据服务发起请求
    injectActionCall(options, getAsyncCall(requestPlugin))
  )

  // 如果有创建完成的回调函数，那就执行它
  if (typeof created === 'function') {
    created.call(store, store)
  }

  return store
}
