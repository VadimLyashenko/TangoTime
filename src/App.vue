<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import TrainingPage from './pages/TrainingPage.vue'
import SettingsPage from './pages/SettingsPage.vue'

const route = ref(window.location.hash || '#/')

const currentPage = computed(() => {
    if (route.value === '#/settings') {
        return SettingsPage
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
    <div class="min-h-screen bg-[#f6f1e9] text-[#2c241f]">
        <AppHeader :route="route" />

        <main class="mx-auto w-[min(1200px,calc(100%-48px))] py-10">
            <component :is="currentPage" />
        </main>
    </div>
</template>
