<script setup>
defineProps({
    source: {
        type: Object,
        required: true,
    },
    canMoveUp: {
        type: Boolean,
        default: true,
    },
    canMoveDown: {
        type: Boolean,
        default: true,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['remove', 'toggle-tab', 'move-up', 'move-down'])

function toggleTab(tabGid) {
    emit('toggle-tab', tabGid)
}
</script>

<template>
    <article class="rounded-3xl border border-[#2c241f]/10 bg-white p-5">
        <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
                <h2
                    class="mb-2 text-xl font-extrabold tracking-[-0.03em] text-[#2c241f]"
                >
                    {{ source.title }}
                </h2>

                <a
                    :href="source.url"
                    target="_blank"
                    rel="noreferrer"
                    class="block max-w-190 truncate text-sm font-semibold text-[#6f6258] underline decoration-[#b7602a]/30 underline-offset-4 transition hover:text-[#b7602a]"
                >
                    {{ source.url }}
                </a>
            </div>

            <div class="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    :disabled="disabled || !canMoveUp"
                    class="grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-[#2c241f]/10 bg-[#fffaf2] text-sm font-extrabold text-[#2c241f] transition hover:border-[#b7602a]/40 hover:bg-[#fff4df] disabled:cursor-not-allowed disabled:opacity-35"
                    title="Move up"
                    @click="emit('move-up')"
                >
                    ↑
                </button>

                <button
                    type="button"
                    :disabled="disabled || !canMoveDown"
                    class="grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-[#2c241f]/10 bg-[#fffaf2] text-sm font-extrabold text-[#2c241f] transition hover:border-[#b7602a]/40 hover:bg-[#fff4df] disabled:cursor-not-allowed disabled:opacity-35"
                    title="Move down"
                    @click="emit('move-down')"
                >
                    ↓
                </button>

                <button
                    type="button"
                    :disabled="disabled"
                    class="cursor-pointer rounded-xl bg-[#ffe7de] px-4 py-2 text-sm font-bold text-[#9d321d] transition hover:bg-[#ffd4c6] disabled:cursor-not-allowed disabled:opacity-35"
                    @click="emit('remove')"
                >
                    Remove
                </button>
            </div>
        </div>

        <div class="mt-5">
            <p class="mb-3 text-sm font-extrabold text-[#2c241f]">Tabs</p>

            <div
                v-if="!source.tabs.length"
                class="rounded-2xl border border-dashed border-[#2c241f]/20 bg-[#fffaf2] p-4 text-sm text-[#6f6258]"
            >
                No tabs found.
            </div>

            <div v-else class="flex flex-wrap gap-2">
                <label
                    v-for="tab in source.tabs"
                    :key="tab.gid"
                    class="flex h-8 cursor-pointer items-center gap-2 rounded-full border border-[#2c241f]/10 bg-[#fffaf2] px-3 text-xs font-bold text-[#2c241f] transition hover:border-[#b7602a]/40 hover:bg-[#fff4df]"
                    :class="
                        tab.selected ? 'border-[#b7602a]/60 bg-[#fff4df]' : ''
                    "
                >
                    <input
                        type="checkbox"
                        :checked="tab.selected"
                        :disabled="disabled"
                        class="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#b7602a] disabled:cursor-not-allowed"
                        @change="toggleTab(tab.gid)"
                    />

                    <span class="max-w-30 truncate">
                        {{ tab.title }}
                    </span>
                </label>
            </div>
        </div>

        <p v-if="source.error" class="mt-4 text-sm font-bold text-[#b3261e]">
            {{ source.error }}
        </p>
    </article>
</template>