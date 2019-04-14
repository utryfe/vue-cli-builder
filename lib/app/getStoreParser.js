const { existsSync, joinPath } = require('../utils/file')
const { randomSequence } = require('../utils/common')

//
module.exports = (storeConfigPath) => {
  return (store, parent, root) => {
    const { pathname, relativePath, children } = store
    if (!parent) {
      const tag = `<${randomSequence(10e6)}>`
      Object.assign(store, {
        state: {},
        modules: {},
        storePropName: `${tag}[Store]${tag}`,
      })
    }

    if (!children) {
      return
    }

    // 子模块
    const moduleStore = joinPath(pathname, storeConfigPath)
    if (!existsSync(moduleStore)) {
      return
    }

    const storePropName = root.storePropName

    if (!parent) {
      const modules = store.modules
      delete store.modules
      store[storePropName] = { bundle: moduleStore, namespace: '/' }
      store.modules = modules
      return
    }

    const paths = relativePath.split('/')
    let modules = root.modules

    for (const [index, path] of Object.entries(paths)) {
      if (!modules[path]) {
        const storeSetup = { namespaced: true, state: {}, modules: {} }
        modules[path] = storeSetup

        if (+index === paths.length - 1) {
          // 调整对象属性顺序
          const modules = storeSetup.modules
          delete storeSetup.modules
          storeSetup[storePropName] = {
            bundle: moduleStore,
            namespace: relativePath,
          }
          storeSetup.modules = modules
          continue
        }
      }

      modules = modules[path].modules
    }
  }
}
