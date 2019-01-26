//
module.exports = function(config) {
  config.plugins.delete('copy')
  config.plugins.delete('prefetch')
  config.plugins.delete('preload')
  config.plugins.delete('html')
  config.plugins.delete('dll')
  config.plugins.delete('named-chunks')
}
