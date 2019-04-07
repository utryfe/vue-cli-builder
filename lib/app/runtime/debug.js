import createDebug, { save, enabled } from 'debug'

const registeredNamespace = {}

function getComponentName(component) {
  const { $options } = component
  const name = $options ? $options.name : ''
  const defaultName = 'AnonymousComponent'
  if (typeof name !== 'string') {
    return defaultName
  }
  return name.trim() || defaultName
}

function getDebug(namespace) {
  if (registeredNamespace.hasOwnProperty(namespace)) {
    return registeredNamespace[namespace]
  }
  return createDebug(namespace)
}

export default {
  install(Vue, namespace) {
    if (process.env.NODE_ENV === 'production') {
      return
    }

    Vue.mixin({
      beforeCreate() {
        if (typeof namespace === 'string' && namespace) {
          save(namespace)
          namespace = ''
        }

        let { $debug } = this

        if (typeof $debug === 'undefined') {
          $debug = getDebug(getComponentName(this))
          this.$debug = $debug
        } else {
          const space = $debug.namespace
          if (typeof space === 'string') {
            $debug.enabled = enabled(space)
          }
        }
      },
    })
  },
}
