import App from './App.vue'
import router from './router'
import store from './store'

import createApp from '../../app'

createApp({
  title: '首页',
  App,
  router,
  store,
})
