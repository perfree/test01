<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useSimStore } from '@/store/simulation'

const store = useSimStore()

onMounted(() => {
  store.init()
  store.startSimulation()
})

onBeforeUnmount(() => {
  store.stopSimulation()
})
</script>
