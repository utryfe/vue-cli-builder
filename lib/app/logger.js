const chalk = require('chalk')

const logger = require('../utils/logger')
const emitter = require('../utils/emitter')

const { getDirName, isDirectory, relativePath } = require('../utils/file')

const cwd = process.cwd()

function getRelativePathUnderCwd(pathname) {
  return relativePath(cwd, pathname).replace(/^\.\//, '')
}

const warnings = []
const errors = []
emitter.on('after-compile', () => {
  if (!warnings.length && !errors.length) {
    return
  }
  const printWarnings = warnings.concat()
  const printErrors = errors.concat()
  warnings.length = 0
  errors.length = 0

  setImmediate(() => {
    let log
    while ((log = printWarnings.shift())) {
      logger.warn(chalk['yellow'](typeof log === 'string' ? log : log.message))
    }
    while ((log = printErrors.shift())) {
      logger.error(chalk['red'](typeof log === 'string' ? log : log.message))
    }
    console.log()
  })
})

//
module.exports = exports = {
  getRelativePathUnderCwd,

  warn(w) {
    if (typeof w === 'string' || (w && w.message)) {
      warnings.push(w)
    }
  },

  error(e) {
    if (typeof e === 'string' || (e && e.message)) {
      errors.push(e)
    }
  },

  logIgnoredNamedViewRoutes(modulePath, ignoredRoutes) {
    if (ignoredRoutes.length) {
      exports.warn(
        `The ${chalk['bold']['cyan'](
          getRelativePathUnderCwd(modulePath)
        )} directory contains a ${chalk['bold']['cyan'](
          process.env.ut_build_router_view_symbol || '@'
        )} symbol which is used as the named router view.\nThese routes under the directory will be ignored:\n${
          //
          ignoredRoutes.join('\n')
        }\n`
      )
    }
  },

  logIgnoredUnknownRoutes(modulePath, ignoredRoutes) {
    if (ignoredRoutes.length) {
      exports.warn(
        `The ${chalk['bold']['cyan'](
          getRelativePathUnderCwd(modulePath)
        )} directory is used for match the unknown route.\nThese routes under the directory will be ignored:\n${
          //
          ignoredRoutes.join('\n')
        }\n`
      )
    }
  },

  logIgnoredDynamicRoutes(route, dynamicRoutes) {
    if (dynamicRoutes.length > 1) {
      const { absRoutePath } = route
      exports.warn(
        `There are multiple dynamic routes under ${chalk['bold']['cyan'](
          getRelativePathUnderCwd(route.pathname)
        )}, and only the first one (*) will take effect.\n${dynamicRoutes
          .map((item, index) => {
            const mark = index ? '   ' : chalk['bold']['yellow'](' * ')
            return `${mark}${chalk['cyan'](
              getRelativePathUnderCwd(item.pathname)
            )} (${item.absRoutePath || `${absRoutePath !== '/' ? absRoutePath : ''}/`})`
          })
          .join('\n')}\n`
      )
    }
  },

  logIgnoredIndexRoute(route, indexPath) {
    const { pathname } = route
    exports.warn(
      `There already have an index component named by ${chalk['bold']['cyan'](
        getRelativePathUnderCwd(route.component.bundle)
      )} under the ${chalk['bold']['cyan'](
        getRelativePathUnderCwd(pathname)
      )} directory.\nThese routes under the directory ${chalk['bold']['cyan'](
        getRelativePathUnderCwd(getDirName(indexPath))
      )} will be ignored:\n${chalk['cyan'](getRelativePathUnderCwd(indexPath))}\n`
    )
  },

  logIgnoredUnknownRoute(route, unknownRoute) {
    const { pathname, unknown } = route
    const unknownPath = unknownRoute.pathname
    exports.warn(
      `There already have an component named by ${chalk['bold']['cyan'](
        getRelativePathUnderCwd(unknown.pathname)
      )} under the ${chalk['bold']['cyan'](
        getRelativePathUnderCwd(pathname)
      )} directory and used for match the unknown path.\nThese routes under the directory ${chalk[
        'bold'
      ]['cyan'](
        getRelativePathUnderCwd(getDirName(unknownPath))
      )} will be ignored:\n${chalk['cyan'](getRelativePathUnderCwd(unknownPath))}\n`
    )
  },

  logInvalidEmbeddedRoute(route) {
    const relPath = route.filePath || getRelativePathUnderCwd(route.pathname)
    exports.warn(
      `There is no root route defined under ${chalk['bold']['cyan'](
        isDirectory(relPath, true) ? relPath : relPath.replace(/[\\/][^\\/]+$/, '')
      )} directory where contains some sub-routes in sub-directories.`
    )
  },

  logInvalidNestedRoutes(route) {
    const { components } = route
    exports.warn(
      `Named route view under ${chalk['bold']['cyan'](
        getRelativePathUnderCwd(route.pathname)
      )} will not take effect for non-embedded routing.\n${Object.keys(components)
        .filter((item) => item !== 'default')
        .map((item) => chalk['cyan'](getRelativePathUnderCwd(components[item].bundle)))
        .join('\n')}\n`
    )
  },

  logIgnoredBundles(bundles) {
    if (bundles.length) {
      exports.warn(
        `As a result of the route has been ignored, these bundles will also be ignored:\n${bundles
          .map((bundle) => chalk['cyan'](getRelativePathUnderCwd(bundle)))
          .join('\n')}\n`
      )
    }
  },
}
