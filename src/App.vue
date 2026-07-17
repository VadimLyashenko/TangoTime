<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import TrainingPage from './pages/TrainingPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import StatisticsPage from './pages/StatisticsPage.vue'

const route = ref(window.location.hash || '#/')

const currentPage = computed(() => {
    if (route.value === '#/settings') {
        return SettingsPage
    }

    if (route.value === '#/statistics') {
        return StatisticsPage
    }

    return TrainingPage
})

function syncRoute() {
    route.value = window.location.hash || '#/'
}

onMounted(() => {
    if (!window.location.hash) {
        window.location.hash = '#/'
    }

    window.addEventListener('hashchange', syncRoute)
    syncRoute()
})

onBeforeUnmount(() => {
    window.removeEventListener('hashchange', syncRoute)
})
</script>

<template>
    <div class="min-h-screen bg-[#111827] text-[#f3f6fa]">
        <AppHeader :route="route" />

        <main class="mx-auto w-full max-w-[1700px] px-3 py-3 sm:px-4 sm:py-4">
            <component :is="currentPage" />
        </main>
    </div>
</template>
