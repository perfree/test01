<template>
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo" @click="$router.push('/dashboard')">
        <span class="logo-icon">✈</span>
        <transition name="fade">
          <div v-if="!collapsed" class="logo-text">
            <div class="logo-title">低空智控</div>
            <div class="logo-sub">UAV OPERATIONS</div>
          </div>
        </transition>
      </div>
      <el-menu :default-active="$route.path" :collapse="collapsed" router class="side-menu">
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>数据大屏</template>
        </el-menu-item>
        <el-menu-item index="/drones">
          <el-icon><Van /></el-icon>
          <template #title>无人机管理</template>
        </el-menu-item>
        <el-menu-item index="/tasks">
          <el-icon><List /></el-icon>
          <template #title>飞行任务</template>
        </el-menu-item>
        <el-menu-item index="/monitor">
          <el-icon><Monitor /></el-icon>
          <template #title>实时监控</template>
        </el-menu-item>
        <el-menu-item index="/alerts">
          <el-icon><Bell /></el-icon>
          <template #title>告警中心</template>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer" @click="collapsed = !collapsed">
        <el-icon>
          <Expand v-if="collapsed" />
          <Fold v-else />
        </el-icon>
      </div>
    </el-aside>

    <el-container>
      <el-header class="header" height="56px">
        <div class="header-left">
          <span class="page-title">{{ $route.meta.title }}</span>
          <el-tag v-if="store.running" type="success" size="small" effect="dark" class="sim-tag">
            <span class="pulse-dot"></span>模拟运行中
          </el-tag>
          <el-tag v-else type="info" size="small" effect="dark" class="sim-tag">已暂停</el-tag>
        </div>
        <div class="header-right">
          <span class="clock hide-sm">{{ clock }}</span>
          <el-badge :value="store.unhandledCount" :hidden="store.unhandledCount === 0" :max="99" class="alert-badge">
            <el-button circle @click="$router.push('/alerts')">
              <el-icon><BellFilled /></el-icon>
            </el-button>
          </el-badge>
          <el-button size="small" :type="store.running ? 'warning' : 'success'" @click="toggleSim">
            {{ store.running ? '暂停模拟' : '恢复模拟' }}
          </el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Bell, BellFilled, DataAnalysis, Expand, Fold, List, Monitor, Van } from '@element-plus/icons-vue'
import { useSimStore } from '@/store/simulation'

const store = useSimStore()
const collapsed = ref(false)
const clock = ref('')

let clockTimer: ReturnType<typeof setInterval>
const updateClock = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  clock.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const onResize = () => {
  collapsed.value = window.innerWidth < 992
}

const toggleSim = () => {
  if (store.running) store.stopSimulation()
  else store.startSimulation()
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  onResize()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  clearInterval(clockTimer)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.layout {
  height: 100vh;
}

.sidebar {
  background: linear-gradient(180deg, #0a1122 0%, #0c1428 100%);
  border-right: 1px solid var(--border-glow);
  display: flex;
  flex-direction: column;
  transition: width 0.25s;
  overflow: hidden;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 14px;
  cursor: pointer;
  border-bottom: 1px solid rgba(0, 229, 255, 0.1);
  min-height: 64px;
}

.logo-icon {
  font-size: 26px;
  color: var(--accent);
  text-shadow: 0 0 12px rgba(0, 229, 255, 0.8);
  flex-shrink: 0;
}

.logo-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #eaf4ff;
  white-space: nowrap;
}

.logo-sub {
  font-size: 10px;
  color: var(--text-dim);
  letter-spacing: 3px;
  white-space: nowrap;
}

.side-menu {
  flex: 1;
  border-right: none;
  background: transparent;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: #8fa3cc;
  --el-menu-hover-bg-color: rgba(0, 229, 255, 0.08);
  --el-menu-active-color: var(--accent);
}

.side-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.15), transparent);
  border-right: 2px solid var(--accent);
}

.sidebar-footer {
  padding: 12px;
  text-align: center;
  color: var(--text-dim);
  cursor: pointer;
  border-top: 1px solid rgba(0, 229, 255, 0.1);
}

.sidebar-footer:hover {
  color: var(--accent);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(10, 17, 34, 0.9);
  border-bottom: 1px solid var(--border-glow);
  padding: 0 16px;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
}

.sim-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
  50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
}

.clock {
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}

.main {
  padding: 0;
  overflow-y: auto;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(0, 229, 255, 0.05), transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(124, 58, 237, 0.06), transparent 50%),
    var(--bg-deep);
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s, transform 0.18s;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
}

.fade-enter-active {
  transition: opacity 0.3s;
}

.fade-enter-from {
  opacity: 0;
}
</style>
