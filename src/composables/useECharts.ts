import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * ECharts 封装：自动初始化、响应 resize、组件卸载时销毁。
 * 在 onMounted 之前调用 setOption 会缓存，挂载后自动应用。
 */
export function useECharts() {
  const el = ref<HTMLElement | null>(null)
  let chart: echarts.ECharts | null = null
  let pending: echarts.EChartsOption | null = null

  const resizeHandler = () => chart?.resize()

  onMounted(() => {
    if (!el.value) return
    chart = echarts.init(el.value)
    if (pending) {
      chart.setOption(pending, true)
      pending = null
    }
    window.addEventListener('resize', resizeHandler)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resizeHandler)
    chart?.dispose()
    chart = null
  })

  const setOption = (option: echarts.EChartsOption) => {
    if (chart) chart.setOption(option, true)
    else pending = option
  }

  return { el, setOption }
}
