<script setup>
defineProps({
    route: {
        type: String,
        required: true,
    },
})

function goHome() {
    window.location.hash = '#/'
}

function goSettings() {
    window.location.hash = '#/settings'
}
</script>

<template>
    <header
        class="flex h-[72px] items-center justify-between border-b border-[#2c241f]/10 bg-[#fffaf2] px-8"
    >
        <button
            type="button"
            class="cursor-pointer border-0 bg-transparent text-2xl font-extrabold text-[#2c241f]"
            @click="goHome"
        >
            TangoTime
        </button>

        <button
            type="button"
            aria-label="Open settings"
            title="Settings"
            :class="[
                'grid h-11 w-11 cursor-pointer place-items-center rounded-full border text-xl transition',
                route === '#/settings'
                    ? 'border-[#2c241f] bg-[#2c241f] text-[#fffaf2]'
                    : 'border-[#2c241f]/15 bg-white text-[#2c241f] hover:bg-[#2c241f] hover:text-[#fffaf2]',
            ]"
            @click="goSettings"
        >
            ⚙
        </button>
    </header>
</template>
