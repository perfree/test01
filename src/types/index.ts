/** 无人机状态 */
export type DroneStatus = 'flying' | 'returning' | 'idle' | 'charging' | 'maintenance' | 'offline'

/** 任务状态 */
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'aborted'

/** 任务类型 */
export type TaskType = '电力巡检' | '物流配送' | '地形测绘' | '安防巡逻' | '应急救援'

/** 任务优先级 */
export type TaskPriority = '高' | '中' | '低'

/** 告警级别 */
export type AlertLevel = 'critical' | 'warning' | 'info'

export interface Position {
  x: number
  y: number
}

export interface Drone {
  id: string
  name: string
  sn: string
  model: string
  status: DroneStatus
  /** 电量 0-100 */
  battery: number
  /** 速度 m/s */
  speed: number
  /** 高度 m */
  altitude: number
  /** 航向 0-360 */
  heading: number
  /** 信号强度 0-100 */
  signal: number
  pos: Position
  home: Position
  /** 累计飞行时长（分钟） */
  flightTime: number
  /** 当前执行任务 */
  taskId?: string
  /** 历史轨迹 */
  trail: Position[]
  updatedAt: number
}

export interface FlightTask {
  id: string
  name: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  droneId?: string
  droneName?: string
  /** 0-100 */
  progress: number
  route: Position[]
  /** 当前航点索引 */
  wpIndex: number
  /** 航线里程 km */
  distance: number
  operator: string
  startTime?: number
  endTime?: number
  createdAt: number
  description?: string
}

export interface AlertItem {
  id: string
  level: AlertLevel
  type: string
  message: string
  droneId?: string
  droneName?: string
  time: number
  handled: boolean
  handleNote?: string
}

export interface NoFlyZone {
  id: string
  name: string
  center: Position
  radius: number
}

export interface TelemetryPoint {
  t: number
  speed: number
  altitude: number
  battery: number
}
