<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTrainingPreferencesStore } from '../stores/trainingPreferencesStore'
import { useTrainingSetsStore } from '../stores/trainingSetsStore'

const TRAINING_SESSIONS_STORAGE_KEY = 'tangotime-training-sessions'

const props = defineProps({
    route: {
        type: String,
        required: true,
    },
})

const logoUrl = `${import.meta.env.BASE_URL}tangotime-logo.png`

const {
    selectedSets,
    selectedSetKey,
    loadingTrainingSets,
    trainingSetsError,
    loadTrainingSets,
} = useTrainingSetsStore()

const { displayMode, isRandomEnabled, toggleRandomForSet, toggleDisplayMode } =
    useTrainingPreferencesStore()
const trainingSessions = ref(loadTrainingSessions())

const displayModeLabel = computed(() =>
    displayMode.value === 'japanese' ? 'Show Japanese' : 'Show Russian',
)

const selectedSetRandomEnabled = computed(() =>
    isRandomEnabled(selectedSetKey.value),
)

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

const activeGroupProgress = computed(() => {
    if (!activeGroup.value) {
        return null
    }

    return activeGroup.value.sets.reduce(
        (progress, set) => {
            const session = trainingSessions.value[set.key]
            const history = Array.isArray(session?.history)
                ? session.history
                : []
            const total = Array.isArray(session?.order)
                ? session.order.length
                : 0

            progress.total += total
            progress.done += history.length
            progress.mistakes += history.filter((entry) => !entry.correct)
                .length

            return progress
        },
        {
            total: 0,
            done: 0,
            mistakes: 0,
        },
    )
})

const shouldShowActiveGroupProgress = computed(() => {
    return Boolean(
        activeGroupProgress.value &&
            (activeGroupProgress.value.total > 0 ||
                activeGroupProgress.value.done > 0),
    )
})

function goHome() {
    window.location.hash = '#/'
}

function goSettings() {
    window.location.hash = '#/settings'
}

function goStatistics() {
    window.location.hash = '#/statistics'
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

function resetActiveSourceLessons() {
    if (!activeGroup.value) {
        return
    }

    window.dispatchEvent(
        new CustomEvent('tangotime:reset-source-lessons', {
            detail: {
                sourceId: activeGroup.value.sourceId,
            },
        }),
    )
}

function loadTrainingSessions() {
    try {
        return (
            JSON.parse(
                localStorage.getItem(TRAINING_SESSIONS_STORAGE_KEY),
            ) || {}
        )
    } catch {
        return {}
    }
}

function syncTrainingSessions(event) {
    trainingSessions.value = event.detail?.sessions || loadTrainingSessions()
}

onMounted(() => {
    window.addEventListener(
        'tangotime:training-sessions-updated',
        syncTrainingSessions,
    )
})

onBeforeUnmount(() => {
    window.removeEventListener(
        'tangotime:training-sessions-updated',
        syncTrainingSessions,
    )
})

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
        class="grid min-h-20 grid-cols-[64px_minmax(0,1fr)_180px] items-center border-b border-[#2b3a50] bg-[#151f30] px-6 py-3"
    >
        <button
            type="button"
            class="group flex cursor-pointer items-center gap-2.5 justify-self-start border-0 bg-transparent text-2xl font-extrabold text-[#f3f6fa] transition hover:text-[#78a6ff]"
            @click="goHome"
        >
            <img
                :src="logoUrl"
                alt=""
                class="h-9 w-9 object-contain transition duration-200 group-hover:-rotate-3 group-hover:scale-105"
            />
        </button>

        <div v-if="route === '#/'" class="mx-3 min-w-0">
            <div
                v-if="loadingTrainingSets"
                class="text-center text-sm font-bold text-[#9eadc1]"
            >
                Loading sets...
            </div>

            <div
                v-else-if="!selectedSets.length"
                class="text-center text-sm font-bold text-[#9eadc1]"
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
                        class="cursor-pointer border-b-2 bg-transparent px-1 py-1 text-xs font-extrabold uppercase tracking-[0.08em] transition duration-200"
                        :class="
                            activeGroup?.sourceId === group.sourceId
                                ? 'border-[#4f8cff] text-[#f3f6fa]'
                                : 'border-transparent text-[#8291a7] hover:text-[#dbe6f5]'
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
                            class="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-bold transition duration-200 active:scale-95"
                            :class="
                                selectedSetKey === set.key
                                    ? 'border-[#4f8cff] bg-[#4f8cff] text-[#0f1726] shadow-sm shadow-[#4f8cff]/20'
                                    : 'border-[#2b3a50] bg-[#1b273a] text-[#c9d5e5] hover:border-[#4f8cff]/60 hover:bg-[#21314a] hover:text-white'
                            "
                            @click="selectTrainingSet(set.key)"
                        >
                            {{ set.tabTitle }}
                        </button>
                    </nav>
                </Transition>

                <p
                    v-if="shouldShowActiveGroupProgress"
                    class="text-center text-xs font-extrabold uppercase tracking-[0.08em] text-[#8291a7]"
                >
                    Done
                    <span class="text-[#c9d5e5]">
                        {{ activeGroupProgress.done }} /
                        {{ activeGroupProgress.total }}
                    </span>
                    <span class="mx-1 text-[#2b3a50]">|</span>
                    Mistakes
                    <span
                        :class="
                            activeGroupProgress.mistakes
                                ? 'text-[#f58a87]'
                                : 'text-[#55c98b]'
                        "
                    >
                        {{ activeGroupProgress.mistakes }}
                    </span>
                </p>
            </div>

            <p
                v-if="trainingSetsError"
                class="mt-1 text-center text-xs font-bold text-[#f06a67]"
            >
                {{ trainingSetsError }}
            </p>
        </div>

        <div class="col-start-3 flex justify-self-end">
            <button
                type="button"
                aria-label="Reset current source lessons"
                title="Reset current source lessons"
                :disabled="route !== '#/' || !activeGroup"
                class="grid h-12 w-12 cursor-pointer place-items-center border-0 bg-transparent text-3xl text-[#c9d5e5] transition duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35 hover:text-white"
                @click="resetActiveSourceLessons"
            >
                <span aria-hidden="true" class="text-3xl leading-none"
                    >&#8634;</span
                >
            </button>

            <button
                type="button"
                aria-label="Toggle random order"
                :disabled="!selectedSetKey"
                :title="
                    selectedSetRandomEnabled ? 'Random on' : 'Random off'
                "
                :class="[
                    'grid h-12 w-12 cursor-pointer place-items-center border-0 bg-transparent text-3xl transition duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35',
                    selectedSetRandomEnabled
                        ? 'text-[#4f8cff]'
                        : 'text-[#c9d5e5] hover:text-white',
                ]"
                @click="toggleRandomForSet(selectedSetKey)"
            >
                <span aria-hidden="true" class="text-3xl leading-none"
                    >&#8644;</span
                >
            </button>

            <button
                type="button"
                aria-label="Toggle display mode"
                :title="displayModeLabel"
                :class="[
                    'grid h-12 w-12 cursor-pointer place-items-center border-0 bg-transparent text-2xl font-extrabold transition duration-200 active:scale-90',
                    displayMode === 'russian'
                        ? 'text-[#4f8cff]'
                        : 'text-[#c9d5e5] hover:text-white',
                ]"
                @click="toggleDisplayMode"
            >
                <span
                    v-if="displayMode === 'japanese'"
                    aria-hidden="true"
                    class="japanese-text text-[1.65rem] leading-none"
                    >&#12354;</span
                >
                <span v-else aria-hidden="true" class="text-xl leading-none">
                    Ru
                </span>
            </button>

            <button
                type="button"
                aria-label="Open statistics"
                title="Statistics"
                :class="[
                    'grid h-12 w-12 cursor-pointer place-items-center border-0 bg-transparent text-3xl transition duration-200 active:scale-90',
                    route === '#/statistics'
                        ? 'text-[#4f8cff]'
                        : 'text-[#c9d5e5] hover:text-white',
                ]"
                @click="goStatistics"
            >
                <span aria-hidden="true" class="text-3xl leading-none"
                    >&#9638;</span
                >
            </button>

            <button
                type="button"
                aria-label="Open settings"
                title="Settings"
                :class="[
                    'grid h-12 w-12 cursor-pointer place-items-center border-0 bg-transparent text-3xl transition duration-200 hover:rotate-12 active:scale-90',
                    route === '#/settings'
                        ? 'text-[#4f8cff]'
                        : 'text-[#c9d5e5] hover:text-white',
                ]"
                @click="goSettings"
            >
                <span aria-hidden="true" class="text-3xl leading-none"
                    >&#9881;</span
                >
            </button>
        </div>
    </header>
</template>

<style scoped>
.set-row-enter-active,
.set-row-leave-active {
    transition: opacity 180ms ease;
}

.set-row-enter-from,
.set-row-leave-to {
    opacity: 0;
}
</style>
