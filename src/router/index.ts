import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layout/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '数据大屏' } },
        { path: 'drones', name: 'Drones', component: () => import('@/views/DroneList.vue'), meta: { title: '无人机管理' } },
        { path: 'tasks', name: 'Tasks', component: () => import('@/views/TaskManage.vue'), meta: { title: '飞行任务' } },
        { path: 'monitor', name: 'Monitor', component: () => import('@/views/Monitor.vue'), meta: { title: '实时监控' } },
        { path: 'alerts', name: 'Alerts', component: () => import('@/views/AlertCenter.vue'), meta: { title: '告警中心' } }
      ]
    }
  ]
})

router.afterEach((to) => {
  document.title = `${to.meta.title ? to.meta.title + ' · ' : ''}低空无人机运营管理平台`
})

export default router
