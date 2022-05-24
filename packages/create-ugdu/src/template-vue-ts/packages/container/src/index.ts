import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import routes from 'routes'

import App from '@container/app.vue'

const router = createRouter(
  {
    history: createWebHistory(),
    routes
  }
)

const app = createApp(App)
app.use(router)

export default {
  mount () {
    app.mount('#app')
  },
  unmount () {
    app.unmount()
  }
}
