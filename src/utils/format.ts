import type { AlertLevel, DroneStatus, TaskStatus } from '@/types'

const pad = (n: number) => String(n).padStart(2, '0')

export function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 分钟 -> "3h 25m" */
export function fmtDuration(min: number): string {
  if (min < 60) return `${Math.floor(min)}min`
  return `${Math.floor(min / 60)}h ${Math.floor(min % 60)}m`
}

export const DRONE_STATUS_MAP: Record<DroneStatus, { label: string; color: string; tag: 'primary' | 'success' | 'info' | 'warning' | 'danger' }> = {
  flying: { label: '飞行中', color: '#00e5ff', tag: 'primary' },
  returning: { label: '返航中', color: '#38bdf8', tag: 'primary' },
  idle: { label: '待机', color: '#94a3b8', tag: 'info' },
  charging: { label: '充电中', color: '#22c55e', tag: 'success' },
  maintenance: { label: '维护中', color: '#f59e0b', tag: 'warning' },
  offline: { label: '离线', color: '#64748b', tag: 'danger' }
}

export const TASK_STATUS_MAP: Record<TaskStatus, { label: string; tag: 'primary' | 'success' | 'info' | 'warning' | 'danger' }> = {
  pending: { label: '待执行', tag: 'info' },
  running: { label: '执行中', tag: 'primary' },
  paused: { label: '已暂停', tag: 'warning' },
  completed: { label: '已完成', tag: 'success' },
  aborted: { label: '已终止', tag: 'danger' }
}

export const ALERT_LEVEL_MAP: Record<AlertLevel, { label: string; color: string; tag: 'primary' | 'success' | 'info' | 'warning' | 'danger' }> = {
  critical: { label: '严重', color: '#f43f5e', tag: 'danger' },
  warning: { label: '警告', color: '#f59e0b', tag: 'warning' },
  info: { label: '提示', color: '#38bdf8', tag: 'info' }
}

export function batteryColor(battery: number): string {
  if (battery > 50) return '#22c55e'
  if (battery > 20) return '#f59e0b'
  return '#f43f5e'
}
