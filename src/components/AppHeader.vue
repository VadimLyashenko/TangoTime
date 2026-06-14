<script setup>
import { computed, watch } from 'vue'
import { useTrainingSetsStore } from '../stores/trainingSetsStore'

const props = defineProps({
    route: {
        type: String,
        required: true,
    },
})

const {
    selectedSets,
    selectedSetKey,
    loadingTrainingSets,
    trainingSetsError,
    loadTrainingSets,
} = useTrainingSetsStore()

const groupedTrainingSets = computed(() => {
    const groups = []

    selectedSets.value.forEach((set) => {
        const existingGroup = groups.find(
            (group) => group.sourceId === set.sourceId,
        )

        if (existingGroup) {
            existingGroup.sets.push(set)
            return
        }

        groups.push({
            sourceId: set.sourceId,
            sourceTitle: set.sourceTitle,
            sets: [set],
        })
    })

    return groups
})

function goHome() {
    window.location.hash = '#/'
}

function goSettings() {
    window.location.hash = '#/settings'
}

function selectTrainingSet(setKey) {
    selectedSetKey.value = setKey
}

watch(
    () => props.route,
    async (route) => {
        if (route === '#/') {
            await loadTrainingSets()
        }
    },
    {
        immediate: true,
    },
)
</script>

<template>
    <header
        class="flex h-20 items-center justify-between border-b border-[#2c241f]/10 bg-[#fffaf2] px-8"
    >
        <button
            type="button"
            class="cursor-pointer border-0 bg-transparent text-2xl font-extrabold text-[#2c241f] transition hover:text-[#b7602a]"
            @click="goHome"
        >
            TangoTime
        </button>

        <div
            v-if="route === '#/'"
            class="mx-8 flex min-w-0 flex-1 justify-center"
        >
            <div class="min-w-0 max-w-190">
                <div
                    v-if="loadingTrainingSets"
                    class="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#6f6258]"
                >
                    Loading sets…
                </div>

                <div
                    v-else-if="!selectedSets.length"
                    class="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#6f6258]"
                >
                    No sets selected
                </div>

                <div
                    v-else
                    class="flex max-w-full gap-3 overflow-x-auto rounded-full bg-white/70 p-1.5"
                >
                    <div
                        v-for="group in groupedTrainingSets"
                        :key="group.sourceId"
                        class="flex shrink-0 items-center gap-2 rounded-full border border-[#2c241f]/10 bg-[#fffaf2] px-2 py-1"
                    >
                        <span
                            class="max-w-36 truncate px-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#b7602a]"
                        >
                            {{ group.sourceTitle }}
                        </span>

                        <div class="flex items-center gap-1">
                            <button
                                v-for="set in group.sets"
                                :key="set.key"
                                type="button"
                                class="shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-sm font-bold transition duration-200 ease-out hover:-translate-y-0.5"
                                :class="
                                    selectedSetKey === set.key
                                        ? 'bg-[#b7602a] text-[#fffaf2] shadow-md shadow-[#b7602a]/25'
                                        : 'bg-white text-[#2c241f] hover:bg-[#fff4df] hover:text-[#b7602a]'
                                "
                                @click="selectTrainingSet(set.key)"
                            >
                                {{ set.tabTitle }}
                            </button>
                        </div>
                    </div>
                </div>

                <p
                    v-if="trainingSetsError"
                    class="mt-1 text-center text-xs font-bold text-[#b3261e]"
                >
                    {{ trainingSetsError }}
                </p>
            </div>
        </div>

        <button
            type="button"
            aria-label="Open settings"
            title="Settings"
            :class="[
                'grid h-11 w-11 cursor-pointer place-items-center rounded-full border text-xl transition',
                route === '#/settings'
                    ? 'border-[#b7602a] bg-[#b7602a] text-[#fffaf2] shadow-md shadow-[#b7602a]/25'
                    : 'border-[#2c241f]/15 bg-white text-[#2c241f] hover:border-[#b7602a]/40 hover:bg-[#fff4df] hover:text-[#b7602a]',
            ]"
            @click="goSettings"
        >
            ⚙
        </button>
    </header>
</template>
