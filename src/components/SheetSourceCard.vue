<script setup>
import { ref } from 'vue'

const props = defineProps({
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

const emit = defineEmits(['remove', 'set-tabs', 'move-up', 'move-down'])
const lastSelectedTabIndex = ref(null)

function selectTabs(tab, tabIndex, event) {
    const selected = event.currentTarget.checked
    const tabs = event.shiftKey ? getTabsInRange(tabIndex) : [tab]

    lastSelectedTabIndex.value = tabIndex

    emit('set-tabs', {
        tabGids: tabs.map((item) => item.gid),
        selected,
    })
}

function getTabsInRange(tabIndex) {
    if (lastSelectedTabIndex.value === null) {
        return [props.source.tabs[tabIndex]]
    }

    const start = Math.min(lastSelectedTabIndex.value, tabIndex)
    const end = Math.max(lastSelectedTabIndex.value, tabIndex)

    return props.source.tabs.slice(start, end + 1)
}
</script>

<template>
    <article class="rounded-md border border-[#2b3a50] bg-[#182235] p-5">
        <div class="flex items-start justify-between gap-4">
            <div class="flex min-w-0 items-center gap-4">
                <h2
                    class="max-w-72 shrink-0 truncate text-xl font-extrabold tracking-[-0.03em] text-[#f3f6fa]"
                >
                    {{ source.title }}
                </h2>

                <a
                    :href="source.url"
                    :title="source.url"
                    target="_blank"
                    rel="noreferrer"
                    class="block min-w-0 max-w-105 truncate text-sm font-semibold text-[#9eadc1] underline decoration-[#4f8cff]/35 underline-offset-4 transition hover:text-[#78a6ff]"
                >
                    {{ source.url }}
                </a>
            </div>

            <div class="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    :disabled="disabled || !canMoveUp"
                    class="grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-[#2b3a50] bg-[#141e2f] text-sm font-extrabold text-[#c9d5e5] transition hover:border-[#4f8cff]/60 hover:bg-[#21314a] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    title="Move up"
                    @click="emit('move-up')"
                >
                    &uarr;
                </button>

                <button
                    type="button"
                    :disabled="disabled || !canMoveDown"
                    class="grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-[#2b3a50] bg-[#141e2f] text-sm font-extrabold text-[#c9d5e5] transition hover:border-[#4f8cff]/60 hover:bg-[#21314a] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    title="Move down"
                    @click="emit('move-down')"
                >
                    &darr;
                </button>

                <button
                    type="button"
                    :disabled="disabled"
                    class="cursor-pointer rounded-md border border-[#f06a67]/45 bg-transparent px-4 py-2 text-sm font-bold text-[#f58a87] transition hover:bg-[#f06a67]/10 disabled:cursor-not-allowed disabled:opacity-35"
                    @click="emit('remove')"
                >
                    Remove
                </button>
            </div>
        </div>

        <div class="mt-5">
            <div
                v-if="!source.tabs.length"
                class="border border-dashed border-[#2b3a50] bg-[#141e2f] p-4 text-sm text-[#9eadc1]"
            >
                No tabs found.
            </div>

            <div v-else class="flex flex-wrap gap-2">
                <label
                    v-for="(tab, index) in source.tabs"
                    :key="tab.gid"
                    class="flex h-8 cursor-pointer select-none items-center gap-2 rounded-md border border-[#2b3a50] bg-[#141e2f] px-3 text-xs font-bold text-[#c9d5e5] transition hover:border-[#4f8cff]/60 hover:bg-[#21314a]"
                    :class="
                        tab.selected
                            ? 'border-[#4f8cff] bg-[#4f8cff]/12 text-[#f3f6fa]'
                            : ''
                    "
                >
                    <input
                        type="checkbox"
                        :checked="tab.selected"
                        :disabled="disabled"
                        class="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#4f8cff] disabled:cursor-not-allowed"
                        @click="selectTabs(tab, index, $event)"
                    />

                    <span class="max-w-30 truncate">
                        {{ tab.title }}
                    </span>
                </label>
            </div>
        </div>

        <p v-if="source.error" class="mt-4 text-sm font-bold text-[#f06a67]">
            {{ source.error }}
        </p>
    </article>
</template>
