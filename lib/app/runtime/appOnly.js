import createApp from './launcher'

export default function createAppOnly(base, global, plugins) {
  return createApp(base, global, plugins)
}
