import debug from 'debug'
import { debugToken } from '../utils'

const defaultLevel = process.env.NODE_ENV === 'production' ? 'error' : '*'
const levels = ['debug', 'log', 'info', 'warn', 'error']
const prefix = 'vue'
const prevTimestamp = {}
const print = debug('')

let preservedNamespaces = ''

function disableDebug() {
  if (!preservedNamespaces) {
    preservedNamespaces = getCurrentDebugNamespaces()
    debug.enable('')
  }
  console.debug('All debug output has been suspend.')
}

function enableDebug() {
  const namespaces = preservedNamespaces || getCurrentDebugNamespaces().join(',')
  preservedNamespaces = ''
  setCurrentDebugNamespaces(namespaces)
  setCurrentDebugLevel(getCurrentDebugLevel())
}

function setCurrentDebugNamespaces(namespaces) {
  const level = getCurrentDebugLevel()
  const split = (typeof namespaces === 'string' ? namespaces : '')
    .split(/[\s,]+/)
    .map((name) => name.trim().replace(/:/g, ''))
    .filter((name) => !!name)

  if (!split.length) {
    split.push('*')
  }
  debug['enable'](
    [...new Set(split)].map((name) => `${prefix}:${level}:${name}`).join(',')
  )
  preservedNamespaces = ''
  console.debug(`Debug namespaces switched to '${split.join(', ')}'.`)
}

function getCurrentDebugNamespaces() {
  const namespaces = debug.load() || ''
  const splitReg = /:([^:]+)$/
  const names = []
  for (const space of namespaces.split(',')) {
    const [, name] = splitReg.exec(space) || []
    if (name) {
      names.push(name)
    }
  }
  return names
}

function getCurrentDebugLevel() {
  try {
    const level = localStorage.getItem('debug_level')
    if (['*'].concat(levels).includes(level)) {
      return level
    }
  } catch (e) {}
  return defaultLevel
}

function setCurrentDebugLevel(level) {
  try {
    if (getCurrentDebugLevel() !== level) {
      if (['*'].concat(levels).includes(level)) {
        localStorage.setItem('debug_level', level)
        const names = preservedNamespaces
          ? preservedNamespaces.split(',')
          : getCurrentDebugNamespaces()
        debug.enable(
          [...new Set(names.map(({ name }) => `${prefix}:${level}:${name}`))].join(',')
        )
        preservedNamespaces = ''
      } else {
        console.debug(
          `Debug level should be equal to one of the allowed values:\n[ ${levels
            .concat(['*'])
            .join(', ')} ]`
        )
        return
      }
    }

    console.debug(`Debug level switched to '${level}'.`)
  } catch (e) {}
}

function createDebug(name, level) {
  const $debug = function(...args) {
    const namespace = `${prefix}:${level}:${name}`
    print.enabled = debug['enabled'](namespace)
    if (print.enabled) {
      print.prev = prevTimestamp[namespace] || Date.now()
      prevTimestamp[namespace] = Date.now()
      print.color = debug['selectColor'](namespace)
      print.namespace = namespace
      print.log = console[level]
      print(...args)
    }
  }
  Object.defineProperty($debug, 'token', {
    value: debugToken,
  })
  return $debug
}

function getComponentDebug(name) {
  return levels.reduce(($debug, level) => {
    Object.defineProperty($debug, level, {
      value: createDebug(name, level),
    })
    return $debug
  }, createDebug(name, 'debug'))
}

function getComponentName(component) {
  const { $options } = component
  const defaultName = 'AnonymousComponent'
  const name = $options ? $options.name : ''
  if (typeof name !== 'string') {
    return defaultName
  }
  return name.trim().replace(/[\s,:]/g, '') || defaultName
}

if (typeof window.$debug === 'undefined') {
  const $debug = (namespaces, level) => {
    if (typeof level === 'string') {
      setCurrentDebugLevel(level)
    }
    if (typeof namespaces === 'string') {
      setCurrentDebugNamespaces(namespaces)
    }
  }

  Object.defineProperties($debug, {
    enable: {
      value: enableDebug,
    },
    disable: {
      value: disableDebug,
    },
    setLevel: {
      value: setCurrentDebugLevel,
    },
  })

  window.$debug = $debug
}

export default {
  name: 'debug',
  install(Vue, namespaces) {
    if (typeof namespaces === 'string') {
      setCurrentDebugNamespaces(namespaces)
    }
    Object.defineProperty(Vue.prototype, '$debug', {
      get() {
        return getComponentDebug(getComponentName(this))
      },
    })
  },
}
