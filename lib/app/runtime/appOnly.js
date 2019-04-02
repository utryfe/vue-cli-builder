import createApp from './app'

export default function createAppOnly(base, global, module) {
  return createApp(base, global, module)
}
