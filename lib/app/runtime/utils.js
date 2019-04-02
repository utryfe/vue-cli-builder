export function getRootElement() {
  let elem = document.getElementById('app')
  if (!elem) {
    elem = document.createElement('div')

    const body = document.body
    const nodes = body.childNodes
    let i = 0
    let node

    while ((node = nodes[i++])) {
      if (node.nodeType === 1) {
        body.insertBefore(elem, node)
        return
      }
    }
    body.appendChild(elem)
  }

  return elem
}

export function toObject(foo) {
  const obj = {}
  for (const [key, value] of Object.entries(Object.assign({}, foo))) {
    if (typeof value !== 'undefined') {
      obj[key] = value
    }
  }
  return obj
}

export function formatSetup(setup) {
  return typeof setup === 'function' ? { created: setup } : toObject(setup)
}
