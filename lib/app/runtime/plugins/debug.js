import debug from 'debug'

const defaultLevel = process.env.NODE_ENV === 'production' ? 'error' : '*'
const token = Math.floor(Math.random() * 10e10)
const registeredNamespaces = {}
const levels = ['log', 'info', 'warn', 'error']
const prefix = 'vue'

function getCurrentDebugLevel() {
  try {
    const level = localStorage.getItem('debug_level')
    if (level === '*' || levels.includes(level)) {
      return level
    }
  } catch (e) {}
  return defaultLevel
}

function setCurrentDebugLevel(level) {
  try {
    if (getCurrentDebugLevel() === level) {
      return
    }
    if (level === '*' || levels.includes(level)) {
      localStorage.setItem('debug_level', level)
      debug.enable(
        [
          ...new Set(
            Object.values(registeredNamespaces).map(
              ({ name }) => `${prefix}:${level}:${name}`
            )
          ),
        ].join(',')
      )
      console.info(`debug level switched to '${level}'.`)
    } else {
      console.warn(
        `debug level should be equal to one of the allowed values:\n[ ${levels
          .concat('*')
          .join(', ')} ]`
      )
    }
  } catch (e) {}
}

function setCurrentDebugNamespaces(namespaces) {
  const level = getCurrentDebugLevel()
  const split = (typeof namespaces === 'string' ? namespaces : '')
    .split(/[\s,]+/)
    .map((space) => space.trim())
    .filter((space) => !!space)

  if (!split.length) {
    split.push('*')
  }
  debug.enable(
    [...new Set(split)].map((space) => `${prefix}:${level}:${space}`).join(',')
  )
}

function clearDebug() {
  debug.enable('')
  console.info('all debug output has been suspend.')
}

function isDebugEnabled(namespace) {
  if (typeof namespace === 'string') {
    return debug.enabled(namespace)
  }
  return false
}

function createDebug(namespace, name) {
  if (registeredNamespaces.hasOwnProperty(namespace)) {
    return registeredNamespaces[namespace].$debug
  }
  const echo = debug(namespace)
  const $debug = (...args) => echo(...args)
  registeredNamespaces[namespace] = { name, $debug }

  const descriptor = {
    configurable: false,
    enumerable: false,
    writable: false,
  }
  Object.defineProperties($debug, {
    token: {
      ...descriptor,
      value: token,
    },
    namespace: {
      ...descriptor,
      value: namespace,
    },
    enabled: {
      configurable: false,
      enumerable: false,
      set(val) {
        echo.enabled = !!val
      },
      get() {
        return !!echo.enabled
      },
    },
    destroy: {
      ...descriptor,
      value() {
        delete registeredNamespaces[namespace]
        echo.destroy()
      },
    },
  })

  return $debug
}

function getComponentName(component) {
  const { $options } = component
  const defaultName = 'AnonymousComponent'
  const name = $options ? $options.name : ''
  if (typeof name !== 'string') {
    return defaultName
  }
  return name.trim() || defaultName
}

function setComponentDebug(component) {
  const { $debug } = component
  if (typeof $debug === 'undefined') {
    const name = getComponentName(component)

    component.$debug = levels.reduce(($debug, level) => {
      Object.defineProperty($debug, level, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: createDebug(`${prefix}:${level}:${name}`, name),
      })
      return $debug
    }, createDebug(`${prefix}:${defaultLevel}:${name}`, name))
    //
  } else if ($debug && $debug.token === token) {
    $debug.enabled = isDebugEnabled($debug.namespace)

    levels.forEach((level) => {
      $debug[level].enabled = isDebugEnabled($debug[level].namespace)
    })
  }
}

function removeComponentDebug(component) {
  const { $debug } = component
  if ($debug && $debug.token === token) {
    $debug.destroy()
    levels.forEach((level) => {
      $debug[level].destroy()
    })
  }
}

// exposed
if (typeof window.$debug === 'undefined') {
  const $debug = (namespaces, level) => {
    setCurrentDebugLevel(level)
    if (typeof namespaces === 'string') {
      setCurrentDebugNamespaces(namespaces)
    }
  }
  $debug.setLevel = setCurrentDebugLevel
  $debug.enable = setCurrentDebugNamespaces
  $debug.disable = clearDebug

  window.$debug = $debug
}

// Vue Plugin
export default {
  name: 'debug',
  install(Vue, namespaces) {
    setCurrentDebugNamespaces(namespaces)

    Vue.mixin({
      beforeCreate() {
        setComponentDebug(this)
      },
      destroyed() {
        removeComponentDebug(this)
      },
    })
  },
}
