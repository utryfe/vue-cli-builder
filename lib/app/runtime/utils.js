import Vue from 'vue'

Vue.config.productionTip = false

export const debugToken = Math.floor(Math.random() * 10e10)

export function isElement(value) {
  return (
    value !== null &&
    typeof value == 'object' &&
    typeof value.tagName === 'string' &&
    value.nodeType === 1
  )
}

export function getRootElement(el) {
  if (typeof el === 'string') {
    el = el.trim()
    if (/^#[\w-]+$/.test(el)) {
      el = document.getElementById(el.substring(1))
    } else if (document.querySelector) {
      el = document.querySelector(el)
    }
  }

  let elem = isElement(el) ? el : document.getElementById('app')
  if (!elem) {
    elem = document.createElement('div')

    const body = document.body
    const nodes = body.childNodes
    let i = 0
    let node

    while ((node = nodes[i++])) {
      if (node.nodeType === 1) {
        body.insertBefore(elem, node)
        return elem
      }
    }
    body.appendChild(elem)
  }

  return elem
}

export function toObject(foo, exclude) {
  const obj = {}
  for (const [key, value] of Object.entries(Object.assign({}, foo))) {
    if (typeof value !== 'undefined' && (!exclude || !exclude.includes(key))) {
      obj[key] = value
    }
  }
  return obj
}

export function formatSetup(setup, exclude) {
  return typeof setup === 'function' ? { created: setup } : toObject(setup, exclude)
}

/**
 * 安装Vue插件。
 * @param plugins 插件列表。
 */
export function installPlugins(plugins) {
  if (!Array.isArray(plugins)) {
    plugins = [plugins]
  }
  for (let plugin of plugins) {
    if (!plugin) {
      continue
    }
    let options
    if (Array.isArray(plugin)) {
      // 解析插件配置参数
      // 插件可以有多个配置参数
      ;[plugin, ...options] = plugin
    }
    if (typeof plugin.install === 'function' || typeof plugin === 'function') {
      // 满足插件格式，才应用该插件
      Vue.use(plugin, ...options)
    }
  }
}
