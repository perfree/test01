import { defineStore } from 'pinia'
import type {
  AlertItem,
  AlertLevel,
  Drone,
  FlightTask,
  NoFlyZone,
  Position,
  TaskPriority,
  TaskType,
  TelemetryPoint
} from '@/types'

/** 空域范围（网格单位，1 单位 ≈ 200m） */
export const AREA = { w: 100, h: 60 }
/** 位置移动比例：m/s -> 单位/s */
const POS_SCALE = 0.02
const MAX_ALERTS = 300
const MAX_TRAIL = 40
const MAX_TELEMETRY = 120

const MODELS = ['SkyWing X2', 'AeroFly M600', 'Horizon V8', 'CloudHawk S5', 'StarRover T3']
const OPERATORS = ['张伟', '李娜', '王强', '赵敏', '陈杰', '刘洋']
const TASK_TYPES: TaskType[] = ['电力巡检', '物流配送', '地形测绘', '安防巡逻', '应急救援']
const TASK_PREFIX: Record<TaskType, string> = {
  电力巡检: '输电线路巡检',
  物流配送: '园区物资配送',
  地形测绘: '区域航测建模',
  安防巡逻: '重点区域巡逻',
  应急救援: '应急物资投送'
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
const uid = () => Math.random().toString(36).slice(2, 10)

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const dist = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y)

function randomPos(): Position {
  return { x: rand(4, AREA.w - 4), y: rand(4, AREA.h - 4) }
}

function randomRoute(): Position[] {
  const count = randInt(4, 7)
  const route: Position[] = []
  for (let i = 0; i < count; i++) route.push(randomPos())
  return route
}

function routeDistance(route: Position[]): number {
  let d = 0
  for (let i = 1; i < route.length; i++) d += dist(route[i - 1], route[i])
  return +(d * 0.2).toFixed(1) // 1 单位 ≈ 0.2km
}

let timer: ReturnType<typeof setInterval> | null = null

interface SimState {
  drones: Drone[]
  tasks: FlightTask[]
  alerts: AlertItem[]
  zones: NoFlyZone[]
  telemetry: Record<string, TelemetryPoint[]>
  trendLabels: string[]
  flightTrend: number[]
  running: boolean
  tickCount: number
  totalFlights: number
  totalDistance: number
}

export const useSimStore = defineStore('simulation', {
  state: (): SimState => ({
    drones: [],
    tasks: [],
    alerts: [],
    zones: [],
    telemetry: {},
    trendLabels: [],
    flightTrend: [],
    running: false,
    tickCount: 0,
    totalFlights: 0,
    totalDistance: 0
  }),

  getters: {
    flyingCount: (s) => s.drones.filter((d) => d.status === 'flying' || d.status === 'returning').length,
    onlineCount: (s) => s.drones.filter((d) => d.status !== 'offline').length,
    unhandledAlerts: (s) => s.alerts.filter((a) => !a.handled),
    unhandledCount(): number {
      return this.unhandledAlerts.length
    },
    criticalCount(): number {
      return this.unhandledAlerts.filter((a) => a.level === 'critical').length
    },
    runningTasks: (s) => s.tasks.filter((t) => t.status === 'running'),
    getDrone: (s) => (id: string) => s.drones.find((d) => d.id === id)
  },

  actions: {
    /** 初始化 Mock 数据 */
    init() {
      const now = Date.now()
      // 禁飞区
      this.zones = [
        { id: uid(), name: '机场净空区', center: { x: 22, y: 44 }, radius: 9 },
        { id: uid(), name: '政府核心区', center: { x: 68, y: 18 }, radius: 7 },
        { id: uid(), name: '军事管理区', center: { x: 84, y: 46 }, radius: 6 }
      ]
      // 无人机
      const statuses: Drone['status'][] = ['flying', 'flying', 'flying', 'flying', 'flying', 'flying', 'idle', 'idle', 'idle', 'idle', 'charging', 'charging', 'maintenance', 'idle', 'flying', 'idle', 'charging', 'idle', 'maintenance', 'idle', 'flying', 'idle', 'offline', 'idle']
      this.drones = statuses.map((status, i) => {
        const home = randomPos()
        const pos = status === 'flying' ? randomPos() : { ...home }
        return {
          id: `D${1001 + i}`,
          name: `无人机-${String(i + 1).padStart(2, '0')}`,
          sn: `SN-${randInt(100000, 999999)}`,
          model: pick(MODELS),
          status,
          battery: status === 'charging' ? rand(20, 80) : status === 'offline' ? 0 : rand(35, 100),
          speed: status === 'flying' ? rand(8, 18) : 0,
          altitude: status === 'flying' ? rand(60, 120) : 0,
          heading: rand(0, 360),
          signal: status === 'offline' ? 0 : rand(70, 100),
          pos,
          home,
          flightTime: rand(50, 800),
          trail: [],
          updatedAt: now
        }
      })
      // 任务
      this.tasks = []
      for (let i = 0; i < 14; i++) {
        const type = pick(TASK_TYPES)
        const route = randomRoute()
        const statusRoll = Math.random()
        const status: FlightTask['status'] =
          statusRoll < 0.35 ? 'running' : statusRoll < 0.55 ? 'pending' : statusRoll < 0.85 ? 'completed' : 'paused'
        const created = now - randInt(1, 48) * 3600_000
        this.tasks.push({
          id: `T${2400 + i}`,
          name: `${TASK_PREFIX[type]}-${String(i + 1).padStart(3, '0')}`,
          type,
          status,
          priority: pick<TaskPriority>(['高', '中', '中', '低']),
          progress: status === 'completed' ? 100 : status === 'running' ? randInt(10, 80) : status === 'paused' ? randInt(10, 60) : 0,
          route,
          wpIndex: 1,
          distance: routeDistance(route),
          operator: pick(OPERATORS),
          startTime: status !== 'pending' ? created + 600_000 : undefined,
          endTime: status === 'completed' ? created + randInt(2, 5) * 3600_000 : undefined,
          createdAt: created,
          description: '系统自动生成的演示任务'
        })
      }
      // 给执行中的任务分配飞行中的无人机
      const flyingDrones = this.drones.filter((d) => d.status === 'flying')
      this.tasks.filter((t) => t.status === 'running').forEach((t, i) => {
        const d = flyingDrones[i % flyingDrones.length]
        if (d) {
          t.droneId = d.id
          t.droneName = d.name
          d.taskId = t.id
          d.pos = { ...t.route[0] }
        }
      })
      // 历史告警
      this.alerts = []
      for (let i = 0; i < 18; i++) {
        const d = pick(this.drones)
        const tpl = pick(ALERT_TEMPLATES)
        this.alerts.push({
          id: uid(),
          level: tpl.level,
          type: tpl.type,
          message: tpl.message(d.name),
          droneId: d.id,
          droneName: d.name,
          time: now - randInt(2, 600) * 60_000,
          handled: Math.random() < 0.5
        })
      }
      this.alerts.sort((a, b) => b.time - a.time)
      // 24 小时飞行架次趋势
      this.trendLabels = []
      this.flightTrend = []
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now - i * 3600_000)
        this.trendLabels.push(`${String(d.getHours()).padStart(2, '0')}时`)
        this.flightTrend.push(randInt(4, 26))
      }
      this.totalFlights = this.flightTrend.reduce((a, b) => a + b, 0)
      this.totalDistance = +rand(800, 1500).toFixed(1)
    },

    startSimulation() {
      if (timer) return
      this.running = true
      timer = setInterval(() => this.tick(), 1000)
    },

    stopSimulation() {
      if (timer) clearInterval(timer)
      timer = null
      this.running = false
    },

    /** 模拟引擎主循环：每秒钟推进一次 */
    tick() {
      const now = Date.now()
      this.tickCount++

      for (const d of this.drones) {
        if (d.status === 'flying') {
          const task = this.tasks.find((t) => t.id === d.taskId && t.status === 'running')
          if (task) {
            this.moveAlongRoute(d, task)
          } else {
            this.wander(d)
          }
          this.consumeFlight(d, now)
        } else if (d.status === 'returning') {
          this.moveTowards(d, d.home)
          this.consumeFlight(d, now)
          if (dist(d.pos, d.home) < 0.5) {
            d.status = d.battery < 35 ? 'charging' : 'idle'
            d.speed = 0
            d.altitude = 0
            this.pushAlert('info', '返航完成', `${d.name} 已安全返航着陆`, d)
          }
        } else if (d.status === 'charging') {
          d.battery = clamp(d.battery + rand(0.4, 1), 0, 100)
          if (d.battery >= 100) {
            d.status = 'idle'
            this.pushAlert('info', '充电完成', `${d.name} 已充满电，转入待机`, d)
          }
          d.updatedAt = now
        } else if (d.status === 'idle' && Math.random() < 0.002) {
          // 偶发离线
          d.status = 'offline'
          d.signal = 0
          this.pushAlert('critical', '失联告警', `${d.name} 信号丢失，设备离线`, d)
        } else if (d.status === 'offline' && Math.random() < 0.01) {
          d.status = 'idle'
          d.signal = rand(60, 90)
          this.pushAlert('info', '恢复在线', `${d.name} 已恢复连接`, d)
        }
      }

      // 自动调度：待执行任务 + 空闲无人机
      if (Math.random() < 0.08) {
        const pending = this.tasks.find((t) => t.status === 'pending')
        const idle = this.drones.find((d) => d.status === 'idle' && d.battery > 50)
        if (pending && idle) this.startTask(pending.id)
      }
      // 偶尔生成新任务，保持演示数据流动
      if (this.tasks.filter((t) => t.status === 'pending' || t.status === 'running').length < 5 && Math.random() < 0.02) {
        const type = pick(TASK_TYPES)
        this.createTask({
          name: `${TASK_PREFIX[type]}-${String(randInt(100, 999))}`,
          type,
          priority: pick<TaskPriority>(['高', '中', '低']),
          operator: pick(OPERATORS),
          waypointCount: randInt(4, 7),
          description: '系统自动生成的演示任务'
        })
      }
      // 随机环境告警
      if (Math.random() < 0.015) {
        const d = pick(this.drones.filter((x) => x.status === 'flying'))
        if (d) {
          const tpl = pick(ALERT_TEMPLATES)
          this.pushAlert(tpl.level, tpl.type, tpl.message(d.name), d)
        }
      }
      // 趋势数据滚动
      if (this.tickCount % 30 === 0) {
        this.flightTrend.push(randInt(4, 26))
        this.flightTrend.shift()
        const d = new Date(now)
        this.trendLabels.push(`${String(d.getHours()).padStart(2, '0')}时`)
        this.trendLabels.shift()
      }
      // 告警上限
      if (this.alerts.length > MAX_ALERTS) this.alerts.length = MAX_ALERTS
    },

    moveAlongRoute(d: Drone, task: FlightTask) {
      const target = task.route[task.wpIndex]
      if (!target) return
      this.moveTowards(d, target)
      if (dist(d.pos, target) < 0.5) {
        task.wpIndex++
        task.progress = Math.min(99, Math.round((task.wpIndex / (task.route.length - 1)) * 100))
        if (task.wpIndex >= task.route.length) {
          // 任务完成
          task.status = 'completed'
          task.progress = 100
          task.endTime = Date.now()
          d.taskId = undefined
          d.status = 'returning'
          this.totalFlights++
          this.totalDistance = +(this.totalDistance + task.distance).toFixed(1)
          this.pushAlert('info', '任务完成', `${d.name} 已完成「${task.name}」，自动返航`, d)
        }
      } else {
        task.progress = Math.min(99, Math.round(((task.wpIndex - 1) / (task.route.length - 1)) * 100 + rand(0, 2)))
      }
    },

    /** 无任务的自由巡航 */
    wander(d: Drone) {
      if (!d.trail.length || dist(d.pos, d.trail[d.trail.length - 1]) < 0.01) {
        // 保持当前方向
      }
      const target = (d as any)._wanderTarget as Position | undefined
      if (!target || dist(d.pos, target) < 0.5) {
        ;(d as any)._wanderTarget = randomPos()
      }
      this.moveTowards(d, (d as any)._wanderTarget)
    },

    moveTowards(d: Drone, target: Position) {
      const step = d.speed * POS_SCALE
      const dx = target.x - d.pos.x
      const dy = target.y - d.pos.y
      const len = Math.hypot(dx, dy)
      if (len < 0.001) return
      const move = Math.min(step, len)
      d.pos.x = clamp(d.pos.x + (dx / len) * move, 0, AREA.w)
      d.pos.y = clamp(d.pos.y + (dy / len) * move, 0, AREA.h)
      d.heading = (Math.atan2(dy, dx) * 180) / Math.PI
    },

    consumeFlight(d: Drone, now: number) {
      d.speed = clamp(d.speed + rand(-0.6, 0.6), 6, 22)
      d.altitude = clamp(d.altitude + rand(-2, 2), 40, 150)
      d.battery = clamp(d.battery - rand(0.04, 0.12), 0, 100)
      d.signal = clamp(d.signal + rand(-3, 3), 20, 100)
      d.flightTime += 1 / 60
      d.updatedAt = now
      // 轨迹
      d.trail.push({ ...d.pos })
      if (d.trail.length > MAX_TRAIL) d.trail.shift()
      // 遥测历史
      const list = (this.telemetry[d.id] ||= [])
      list.push({ t: now, speed: +d.speed.toFixed(1), altitude: Math.round(d.altitude), battery: +d.battery.toFixed(1) })
      if (list.length > MAX_TELEMETRY) list.shift()
      // 低电量
      if (d.battery < 20 && !(d as any)._lowBattWarned) {
        ;(d as any)._lowBattWarned = true
        this.pushAlert('critical', '低电量告警', `${d.name} 电量低于 20%（${Math.round(d.battery)}%），请立即返航`, d)
      }
      if (d.battery < 8 && d.status === 'flying') {
        d.status = 'returning'
        d.taskId = undefined
        this.pushAlert('critical', '强制返航', `${d.name} 电量过低，已触发自动返航`, d)
      }
      if (d.battery > 30) (d as any)._lowBattWarned = false
      // 信号弱
      if (d.signal < 35 && Math.random() < 0.1) {
        this.pushAlert('warning', '信号微弱', `${d.name} 链路信号强度仅 ${Math.round(d.signal)}%`, d)
      }
      // 禁飞区检测
      const inZone = this.zones.find((z) => dist(d.pos, z.center) < z.radius)
      if (inZone && !(d as any)._inZone) {
        ;(d as any)._inZone = true
        this.pushAlert('critical', '禁飞区入侵', `${d.name} 进入「${inZone.name}」禁飞空域`, d)
      } else if (!inZone) {
        ;(d as any)._inZone = false
      }
    },

    pushAlert(level: AlertLevel, type: string, message: string, drone?: Drone) {
      this.alerts.unshift({
        id: uid(),
        level,
        type,
        message,
        droneId: drone?.id,
        droneName: drone?.name,
        time: Date.now(),
        handled: false
      })
    },

    // ---------- 任务操作 ----------
    createTask(payload: { name: string; type: TaskType; priority: TaskPriority; operator: string; waypointCount: number; description?: string }) {
      const route = randomRoute().slice(0, clamp(payload.waypointCount, 3, 8))
      const task: FlightTask = {
        id: `T${randInt(3000, 9999)}`,
        name: payload.name,
        type: payload.type,
        status: 'pending',
        priority: payload.priority,
        progress: 0,
        route,
        wpIndex: 1,
        distance: routeDistance(route),
        operator: payload.operator,
        createdAt: Date.now(),
        description: payload.description
      }
      this.tasks.unshift(task)
      return task
    },

    updateTask(id: string, payload: Partial<FlightTask>) {
      const t = this.tasks.find((x) => x.id === id)
      if (t) Object.assign(t, payload)
    },

    deleteTask(id: string) {
      const t = this.tasks.find((x) => x.id === id)
      if (t?.droneId) {
        const d = this.getDrone(t.droneId)
        if (d && d.taskId === id) d.taskId = undefined
      }
      this.tasks = this.tasks.filter((x) => x.id !== id)
    },

    startTask(id: string) {
      const t = this.tasks.find((x) => x.id === id)
      if (!t) return false
      if (t.status === 'paused') {
        t.status = 'running'
        return true
      }
      if (t.status !== 'pending') return false
      const drone = this.drones.find((d) => d.status === 'idle' && d.battery > 30)
      if (!drone) return false
      t.status = 'running'
      t.droneId = drone.id
      t.droneName = drone.name
      t.startTime = Date.now()
      t.wpIndex = 1
      drone.status = 'flying'
      drone.taskId = t.id
      drone.pos = { ...t.route[0] }
      drone.trail = [{ ...drone.pos }]
      drone.speed = rand(10, 16)
      drone.altitude = rand(70, 110)
      this.pushAlert('info', '任务下发', `「${t.name}」已下发给 ${drone.name} 执行`, drone)
      return true
    },

    pauseTask(id: string) {
      const t = this.tasks.find((x) => x.id === id)
      if (t && t.status === 'running') t.status = 'paused'
    },

    abortTask(id: string) {
      const t = this.tasks.find((x) => x.id === id)
      if (!t || t.status === 'completed' || t.status === 'aborted') return
      t.status = 'aborted'
      t.endTime = Date.now()
      if (t.droneId) {
        const d = this.getDrone(t.droneId)
        if (d && d.taskId === id) {
          d.taskId = undefined
          d.status = 'returning'
        }
      }
    },

    // ---------- 无人机指令 ----------
    droneCommand(id: string, cmd: 'takeoff' | 'return' | 'charge' | 'maintain' | 'resume') {
      const d = this.getDrone(id)
      if (!d) return { ok: false, msg: '无人机不存在' }
      switch (cmd) {
        case 'takeoff':
          if (d.status !== 'idle') return { ok: false, msg: '仅待机状态可起飞' }
          if (d.battery < 30) return { ok: false, msg: '电量不足 30%，无法起飞' }
          d.status = 'flying'
          d.speed = rand(10, 15)
          d.altitude = rand(60, 100)
          this.pushAlert('info', '指令下发', `${d.name} 已起飞，进入自由巡航`, d)
          return { ok: true, msg: `${d.name} 已起飞` }
        case 'return':
          if (d.status !== 'flying') return { ok: false, msg: '仅飞行中可返航' }
          d.status = 'returning'
          d.taskId = undefined
          this.pushAlert('info', '指令下发', `已向 ${d.name} 下发返航指令`, d)
          return { ok: true, msg: `已指令 ${d.name} 返航` }
        case 'charge':
          if (d.status !== 'idle') return { ok: false, msg: '仅待机状态可充电' }
          d.status = 'charging'
          return { ok: true, msg: `${d.name} 开始充电` }
        case 'maintain':
          if (d.status !== 'idle' && d.status !== 'offline') return { ok: false, msg: '仅待机/离线可转维护' }
          d.status = 'maintenance'
          return { ok: true, msg: `${d.name} 已转入维护` }
        case 'resume':
          if (d.status !== 'maintenance') return { ok: false, msg: '仅维护中可恢复' }
          d.status = 'idle'
          return { ok: true, msg: `${d.name} 已恢复待机` }
        default:
          return { ok: false, msg: '未知指令' }
      }
    },

    // ---------- 告警操作 ----------
    handleAlert(id: string, note?: string) {
      const a = this.alerts.find((x) => x.id === id)
      if (a) {
        a.handled = true
        a.handleNote = note || '已确认'
      }
    },

    handleAllAlerts() {
      this.alerts.forEach((a) => {
        if (!a.handled) {
          a.handled = true
          a.handleNote = '批量处理'
        }
      })
    },

    clearHandledAlerts() {
      this.alerts = this.alerts.filter((a) => !a.handled)
    }
  }
})

const ALERT_TEMPLATES: { level: AlertLevel; type: string; message: (name: string) => string }[] = [
  { level: 'warning', type: '强风预警', message: (n) => `${n} 所在空域出现 6 级阵风，请注意飞行安全` },
  { level: 'warning', type: '电量预警', message: (n) => `${n} 电量消耗速率异常，请关注续航` },
  { level: 'warning', type: '偏离航线', message: (n) => `${n} 偏离预定航线 120m，已自动纠偏` },
  { level: 'critical', type: '电机温度高', message: (n) => `${n} 2 号电机温度 78℃，超过安全阈值` },
  { level: 'critical', type: 'GPS 丢星', message: (n) => `${n} GPS 卫星数低于 6 颗，定位精度下降` },
  { level: 'info', type: '空域申请', message: (n) => `${n} 的临时空域申请已获批` },
  { level: 'info', type: '固件更新', message: (n) => `${n} 有新版本固件 V2.4.1 可升级` },
  { level: 'warning', type: '障碍物接近', message: (n) => `${n} 前方 80m 检测到障碍物，已执行规避` }
]
