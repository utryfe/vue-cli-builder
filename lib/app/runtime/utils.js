import Vue from './vue'

export function getRootElement(el) {
  let elem = el || document.getElementById('app')
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
      ;[plugin, options] = plugin
    }
    if (typeof plugin.install === 'function' || typeof plugin === 'function') {
      Vue.use(plugin, options)
    }
  }
}
