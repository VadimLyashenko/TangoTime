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

const activeGroup = computed(() => {
    return (
        groupedTrainingSets.value.find((group) =>
            group.sets.some((set) => set.key === selectedSetKey.value),
        ) ||
        groupedTrainingSets.value[0] ||
        null
    )
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

function selectGroup(group) {
    const selectedSetBelongsToGroup = group.sets.some(
        (set) => set.key === selectedSetKey.value,
    )

    if (!selectedSetBelongsToGroup) {
        selectTrainingSet(group.sets[0].key)
    }
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
        class="grid min-h-20 grid-cols-[180px_minmax(0,1fr)_180px] items-center border-b border-[#2c241f]/10 bg-[#fffaf2] px-8 py-3"
    >
        <button
            type="button"
            class="justify-self-start cursor-pointer border-0 bg-transparent text-2xl font-extrabold text-[#2c241f] transition hover:text-[#b7602a]"
            @click="goHome"
        >
            TangoTime
        </button>

        <div v-if="route === '#/'" class="mx-8 min-w-0">
            <div
                v-if="loadingTrainingSets"
                class="text-center text-sm font-bold text-[#6f6258]"
            >
                Loading sets...
            </div>

            <div
                v-else-if="!selectedSets.length"
                class="text-center text-sm font-bold text-[#6f6258]"
            >
                No sets selected
            </div>

            <div v-else class="grid gap-2">
                <nav
                    aria-label="Google Sheets sources"
                    class="flex flex-wrap justify-center gap-x-5 gap-y-1"
                >
                    <button
                        v-for="group in groupedTrainingSets"
                        :key="group.sourceId"
                        type="button"
                        class="cursor-pointer border-b-2 bg-transparent px-1 py-1 text-xs font-extrabold uppercase tracking-[0.08em] transition duration-200 hover:-translate-y-0.5 active:translate-y-0"
                        :class="
                            activeGroup?.sourceId === group.sourceId
                                ? 'border-[#b7602a] text-[#b7602a]'
                                : 'border-transparent text-[#8a7b70] hover:text-[#2c241f]'
                        "
                        @click="selectGroup(group)"
                    >
                        {{ group.sourceTitle }}
                    </button>
                </nav>

                <Transition name="set-row" mode="out-in">
                    <nav
                        v-if="activeGroup"
                        :key="activeGroup.sourceId"
                        aria-label="Training sets"
                        class="flex flex-wrap justify-center gap-1.5"
                    >
                        <button
                            v-for="set in activeGroup.sets"
                            :key="set.key"
                            type="button"
                            class="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-bold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                            :class="
                                selectedSetKey === set.key
                                    ? 'border-[#b7602a] bg-[#b7602a] text-[#fffaf2] shadow-sm shadow-[#b7602a]/20'
                                    : 'border-[#2c241f]/10 bg-white text-[#2c241f] hover:border-[#b7602a]/35 hover:bg-[#fff4df] hover:text-[#b7602a]'
                            "
                            @click="selectTrainingSet(set.key)"
                        >
                            {{ set.tabTitle }}
                        </button>
                    </nav>
                </Transition>
            </div>

            <p
                v-if="trainingSetsError"
                class="mt-1 text-center text-xs font-bold text-[#b3261e]"
            >
                {{ trainingSetsError }}
            </p>
        </div>

        <button
            type="button"
            aria-label="Open settings"
            title="Settings"
            :class="[
                'grid h-11 w-11 cursor-pointer place-items-center justify-self-end rounded-full border text-xl transition duration-200 hover:rotate-12 active:scale-90',
                route === '#/settings'
                    ? 'border-[#b7602a] bg-[#b7602a] text-[#fffaf2] shadow-md shadow-[#b7602a]/25'
                    : 'border-[#2c241f]/15 bg-white text-[#2c241f] hover:border-[#b7602a]/40 hover:bg-[#fff4df] hover:text-[#b7602a]',
            ]"
            @click="goSettings"
        >
            &#9881;
        </button>
    </header>
</template>

<style scoped>
.set-row-enter-active,
.set-row-leave-active {
    transition:
        opacity 180ms ease,
        transform 180ms ease;
}

.set-row-enter-from {
    opacity: 0;
    transform: translateX(12px);
}

.set-row-leave-to {
    opacity: 0;
    transform: translateX(-12px);
}
</style>
