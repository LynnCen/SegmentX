import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'workspace',
      component: () => import('@/views/Workspace.vue'),
    },
  ],
})

export default router
