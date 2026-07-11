<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { saveTrainingStat } from '../services/trainingStatsStore'
import { useTrainingPreferencesStore } from '../stores/trainingPreferencesStore'
import { useTrainingSetsStore } from '../stores/trainingSetsStore'

const TRAINING_SESSIONS_STORAGE_KEY = 'tangotime-training-sessions'
const SOURCE_TABS_HIDDEN_STORAGE_KEY = 'tangotime-source-tabs-hidden'

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

const {
    displayMode,
    autoPlayAnswerAudio,
    toggleDisplayMode,
    toggleAutoPlayAnswerAudio,
} = useTrainingPreferencesStore()
const trainingSessions = ref(loadTrainingSessions())
const sourceTabsHidden = ref(loadSourceTabsHidden())
const savingStatistics = ref(false)
const statisticsSaveStatus = ref('')

const displayModeLabel = computed(() =>
    displayMode.value === 'japanese' ? 'Show Japanese' : 'Show Russian',
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

const activeGroupStatistics = computed(() => {
    if (!activeGroup.value) {
        return null
    }

    const sets = activeGroup.value.sets.map((set) => {
        const session = trainingSessions.value[set.key]
        const history = Array.isArray(session?.history)
            ? session.history
            : []
        const total = Array.isArray(session?.order) ? session.order.length : 0
        const mistakes = history.filter((entry) => !entry.correct)

        return {
            key: set.key,
            tabTitle: set.tabTitle,
            total,
            done: history.length,
            correct: history.length - mistakes.length,
            mistakes: mistakes.length,
            mistakeWords: mistakes.map((entry) => ({
                setKey: set.key,
                tabTitle: set.tabTitle,
                wordId: entry.wordId || '',
                reading: entry.reading || '',
                japanese: entry.japanese || '',
                translation: entry.translation || '',
                audioPath: entry.audioPath || '',
                answeredAt: entry.answeredAt || null,
            })),
        }
    })

    const totals = sets.reduce(
        (progress, set) => {
            progress.total += set.total
            progress.done += set.done
            progress.correct += set.correct
            progress.mistakes += set.mistakes

            return progress
        },
        {
            total: 0,
            done: 0,
            correct: 0,
            mistakes: 0,
        },
    )

    return {
        sourceId: activeGroup.value.sourceId,
        sourceTitle: activeGroup.value.sourceTitle,
        timezone: 'Asia/Tokyo',
        localDate: new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Tokyo',
        }).format(new Date()),
        totals: {
            ...totals,
            accuracy: totals.done
                ? Math.round((totals.correct / totals.done) * 100)
                : 0,
        },
        sets,
        mistakeWords: sets.flatMap((set) => set.mistakeWords),
    }
})

const canSaveActiveGroupStatistics = computed(() => {
    return Boolean(
        activeGroupStatistics.value?.totals.done && !savingStatistics.value,
    )
})

const shouldShowActiveGroupProgress = computed(() => {
    return Boolean(
        activeGroupProgress.value &&
            (activeGroupProgress.value.total > 0 ||
                activeGroupProgress.value.done > 0),
    )
})

const headerIsCompact = computed(
    () => props.route === '#/' && sourceTabsHidden.value,
)

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

async function saveActiveGroupStatistics() {
    if (!canSaveActiveGroupStatistics.value || !activeGroupStatistics.value) {
        return
    }

    savingStatistics.value = true
    statisticsSaveStatus.value = ''

    try {
        await saveTrainingStat(activeGroupStatistics.value)
        statisticsSaveStatus.value = 'saved'
        window.dispatchEvent(new CustomEvent('tangotime:statistics-updated'))
    } catch {
        statisticsSaveStatus.value = 'error'
    } finally {
        savingStatistics.value = false
    }
}

function toggleSourceTabs() {
    sourceTabsHidden.value = !sourceTabsHidden.value
}

function loadSourceTabsHidden() {
    return localStorage.getItem(SOURCE_TABS_HIDDEN_STORAGE_KEY) === 'true'
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

watch(sourceTabsHidden, (isHidden) => {
    localStorage.setItem(SOURCE_TABS_HIDDEN_STORAGE_KEY, String(isHidden))
})
</script>

<template>
    <header
        :class="[
            'grid grid-cols-[32px_minmax(0,1fr)_auto] items-center border-b border-[#2b3a50] bg-[#151f30] px-3 py-3',
            headerIsCompact ? 'min-h-16' : 'min-h-20',
        ]"
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

        <div v-if="route === '#/'" class="mx-1 min-w-0">
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

            <div
                v-else
                :class="['grid', sourceTabsHidden ? 'gap-1' : 'gap-2']"
            >
                <Transition name="source-tabs">
                    <nav
                        v-if="!sourceTabsHidden"
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
                </Transition>

                <Transition name="set-row" mode="out-in">
                    <div
                        v-if="activeGroup"
                        :key="activeGroup.sourceId"
                        role="navigation"
                        aria-label="Training sets"
                        class="flex flex-wrap justify-center gap-1.5"
                    >
                        <button
                            type="button"
                            aria-label="Toggle source tabs"
                            :title="
                                sourceTabsHidden
                                    ? 'Show source tabs'
                                    : 'Hide source tabs'
                            "
                            class="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md border border-[#2b3a50] bg-[#1b273a] transition duration-200 active:scale-95"
                            :class="
                                sourceTabsHidden
                                    ? 'text-[#4f8cff]'
                                    : 'text-[#c9d5e5] hover:border-[#4f8cff]/60 hover:bg-[#21314a] hover:text-white'
                            "
                            @click="toggleSourceTabs"
                        >
                            <svg
                                aria-hidden="true"
                                class="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <path
                                    d="M5 7h14M5 12h14"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                />
                                <path
                                    :d="
                                        sourceTabsHidden
                                            ? 'M8 16l4 4 4-4'
                                            : 'M8 19l4-4 4 4'
                                    "
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </button>

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
                    </div>
                </Transition>

                <div
                    v-if="shouldShowActiveGroupProgress"
                    class="flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#8291a7]"
                >
                    <p>
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

                    <button
                        type="button"
                        aria-label="Reset current source lessons"
                        title="Reset current source lessons"
                        class="grid h-6 w-6 cursor-pointer place-items-center rounded border border-[#2b3a50] bg-[#1b273a] text-base text-[#c9d5e5] transition duration-200 hover:border-[#4f8cff]/60 hover:bg-[#21314a] hover:text-white active:scale-95"
                        @click="resetActiveSourceLessons"
                    >
                        <span aria-hidden="true" class="leading-none"
                            >&#8634;</span
                        >
                    </button>

                    <button
                        type="button"
                        aria-label="Save source statistics"
                        :title="
                            statisticsSaveStatus === 'saved'
                                ? 'Statistics saved'
                                : statisticsSaveStatus === 'error'
                                  ? 'Could not save statistics'
                                  : 'Save source statistics'
                        "
                        :disabled="!canSaveActiveGroupStatistics"
                        :class="[
                            'grid h-6 w-6 cursor-pointer place-items-center rounded border bg-[#1b273a] text-sm transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35',
                            statisticsSaveStatus === 'saved'
                                ? 'border-[#55c98b]/70 text-[#55c98b]'
                                : statisticsSaveStatus === 'error'
                                  ? 'border-[#f06a67]/70 text-[#f58a87]'
                                  : 'border-[#2b3a50] text-[#c9d5e5] hover:border-[#4f8cff]/60 hover:bg-[#21314a] hover:text-white',
                        ]"
                        @click="saveActiveGroupStatistics"
                    >
                        <span
                            v-if="savingStatistics"
                            aria-hidden="true"
                            class="text-[0.65rem] leading-none"
                        >
                            ...
                        </span>
                        <span
                            v-else-if="statisticsSaveStatus === 'error'"
                            aria-hidden="true"
                            class="text-sm font-extrabold leading-none"
                        >
                            !
                        </span>
                        <svg
                            v-else-if="statisticsSaveStatus === 'saved'"
                            aria-hidden="true"
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M5 12.5l4.5 4.5L19 7"
                                stroke="currentColor"
                                stroke-width="2.6"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <svg
                            v-else
                            aria-hidden="true"
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M12 5v14M5 12h14"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                            />
                        </svg>
                    </button>
                </div>
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
                v-if="route === '#/'"
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
                v-if="route === '#/'"
                type="button"
                aria-label="Toggle answer audio"
                :title="
                    autoPlayAnswerAudio
                        ? 'Answer audio on'
                        : 'Answer audio off'
                "
                :class="[
                    'grid h-12 w-12 cursor-pointer place-items-center border-0 bg-transparent transition duration-200 active:scale-90',
                    autoPlayAnswerAudio
                        ? 'text-[#4f8cff]'
                        : 'text-[#c9d5e5] hover:text-white',
                ]"
                @click="toggleAutoPlayAnswerAudio"
            >
                <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    class="h-7 w-7"
                    fill="none"
                >
                    <path
                        d="M4 9.5h3.2L12 5.8v12.4l-4.8-3.7H4z"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linejoin="round"
                    />
                    <path
                        d="M16 9a4.5 4.5 0 0 1 0 6"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                    <path
                        d="M18.7 6.5a8 8 0 0 1 0 11"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                </svg>
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

.source-tabs-enter-active,
.source-tabs-leave-active {
    max-height: 48px;
    overflow: hidden;
    transition:
        max-height 140ms ease,
        opacity 120ms ease,
        transform 140ms ease;
}

.source-tabs-enter-from,
.source-tabs-leave-to {
    max-height: 0;
    opacity: 0;
    transform: translateY(-6px);
}

.source-tabs-enter-to,
.source-tabs-leave-from {
    max-height: 48px;
    opacity: 1;
    transform: translateY(0);
}
</style>
