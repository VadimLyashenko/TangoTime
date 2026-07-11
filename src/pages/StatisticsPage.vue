<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
    deleteTrainingStat,
    loadTrainingStats,
} from '../services/trainingStatsStore'

const stats = ref([])
const loading = ref(false)
const error = ref('')
const expandedStatIds = ref(new Set())
const deletingStatId = ref('')
let activeAudio = null

onMounted(() => {
    loadStats()
    window.addEventListener('tangotime:statistics-updated', loadStats)
})

onBeforeUnmount(() => {
    stopActiveAudio()
    window.removeEventListener('tangotime:statistics-updated', loadStats)
})

async function loadStats() {
    loading.value = true
    error.value = ''

    try {
        stats.value = await loadTrainingStats()
        expandedStatIds.value = new Set(
            [...expandedStatIds.value].filter((statId) =>
                stats.value.some((stat) => stat.id === statId),
            ),
        )
    } catch (loadError) {
        error.value =
            loadError.message || 'Could not load saved training statistics.'
    } finally {
        loading.value = false
    }
}

function isStatExpanded(statId) {
    return expandedStatIds.value.has(statId)
}

function toggleStat(statId) {
    const nextExpandedStatIds = new Set(expandedStatIds.value)

    if (nextExpandedStatIds.has(statId)) {
        nextExpandedStatIds.delete(statId)
    } else {
        nextExpandedStatIds.add(statId)
    }

    expandedStatIds.value = nextExpandedStatIds
}

async function removeStat(statId) {
    const confirmed = window.confirm('Delete this saved statistic?')

    if (!confirmed) {
        return
    }

    deletingStatId.value = statId
    error.value = ''

    try {
        await deleteTrainingStat(statId)
        stats.value = stats.value.filter((stat) => stat.id !== statId)
        const nextExpandedStatIds = new Set(expandedStatIds.value)

        nextExpandedStatIds.delete(statId)
        expandedStatIds.value = nextExpandedStatIds
    } catch (deleteError) {
        error.value =
            deleteError.message || 'Could not delete this saved statistic.'
    } finally {
        deletingStatId.value = ''
    }
}

function formatSavedAt(stat) {
    if (!stat.createdAtIso) {
        return stat.localDate || ''
    }

    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        hourCycle: 'h23',
        timeZone: stat.timezone || 'Asia/Tokyo',
    }).format(new Date(stat.createdAtIso))
}

function resolveAudioUrl(audioPath) {
    const trimmedPath = String(audioPath || '').trim()

    if (!trimmedPath) {
        return ''
    }

    if (/^https?:\/\//i.test(trimmedPath)) {
        return trimmedPath
    }

    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
    const relativePath = trimmedPath.replace(/^\/+/, '')

    return new URL(relativePath, baseUrl).href
}

function stopActiveAudio() {
    if (!activeAudio) {
        return
    }

    activeAudio.pause()
    activeAudio.currentTime = 0
    activeAudio = null
}

function playAudio(audioPath) {
    const audioUrl = resolveAudioUrl(audioPath)

    if (!audioUrl) {
        return
    }

    stopActiveAudio()
    activeAudio = new Audio(audioUrl)
    activeAudio.play().catch(() => {
        activeAudio = null
    })
}
</script>

<template>
    <section>
        <div
            v-if="loading"
            class="border border-dashed border-[#2b3a50] bg-[#182235] p-6 text-[#9eadc1]"
        >
            Loading statistics...
        </div>

        <div
            v-else-if="error"
            class="border border-[#f06a67]/35 bg-[#2a202b] p-6 font-bold text-[#f58a87]"
        >
            {{ error }}
        </div>

        <div
            v-else-if="!stats.length"
            class="border border-dashed border-[#2b3a50] bg-[#182235] p-6 text-[#9eadc1]"
        >
            Saved training results will appear here.
        </div>

        <div v-else class="grid gap-4">
            <article
                v-for="stat in stats"
                :key="stat.id"
                class="border border-[#2b3a50] bg-[#182235]"
            >
                <header
                    class="flex flex-wrap items-center justify-between gap-3 border-b border-[#2b3a50] px-3 py-3"
                >
                    <div class="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            :aria-label="
                                isStatExpanded(stat.id)
                                    ? 'Collapse statistic'
                                    : 'Expand statistic'
                            "
                            :title="
                                isStatExpanded(stat.id)
                                    ? 'Collapse statistic'
                                    : 'Expand statistic'
                            "
                            class="grid h-8 w-8 shrink-0 cursor-pointer place-items-center bg-transparent text-[#c9d5e5] transition hover:text-white active:scale-95"
                            @click="toggleStat(stat.id)"
                        >
                            <svg
                                aria-hidden="true"
                                class="h-5 w-5 transition-transform duration-150"
                                :class="
                                    isStatExpanded(stat.id) ? 'rotate-90' : ''
                                "
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <path
                                    d="M9 6l6 6-6 6"
                                    stroke="currentColor"
                                    stroke-width="2.4"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </button>

                        <div class="min-w-0">
                            <div class="flex min-w-0 items-center gap-2">
                                <h2
                                    class="truncate text-lg font-extrabold text-[#f3f6fa]"
                                >
                                    {{ stat.sourceTitle }}
                                </h2>
                                <span
                                    v-if="stat.testMode"
                                    class="shrink-0 rounded border border-[#4f8cff]/55 bg-[#4f8cff]/12 px-1.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-[0.08em] text-[#78a6ff]"
                                >
                                    Test
                                </span>
                            </div>
                            <p class="mt-0.5 text-xs font-bold text-[#8291a7]">
                                {{ formatSavedAt(stat) }}
                            </p>
                        </div>
                    </div>

                    <div
                        class="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs font-extrabold uppercase tracking-[0.08em]"
                    >
                        <p class="text-[#8291a7]">
                            Done
                            <strong class="ml-1 text-[#c9d5e5]">
                                {{ stat.totals?.done || 0 }} /
                                {{ stat.totals?.total || 0 }}
                            </strong>
                        </p>
                        <p class="text-[#8291a7]">
                            Correct
                            <strong class="ml-1 text-[#55c98b]">
                                {{ stat.totals?.correct || 0 }}
                            </strong>
                        </p>
                        <p class="text-[#8291a7]">
                            Mistakes
                            <strong class="ml-1 text-[#f58a87]">
                                {{ stat.totals?.mistakes || 0 }}
                            </strong>
                        </p>
                        <p class="text-[#8291a7]">
                            Accuracy
                            <strong class="ml-1 text-[#4f8cff]">
                                {{ stat.totals?.accuracy || 0 }}%
                            </strong>
                        </p>
                        <button
                            type="button"
                            aria-label="Delete statistic"
                            title="Delete statistic"
                            :disabled="deletingStatId === stat.id"
                            class="grid h-7 w-7 cursor-pointer place-items-center border border-[#f06a67]/45 bg-[#141e2f] text-[#f58a87] transition hover:border-[#f06a67] hover:text-[#ff8a86] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                            @click="removeStat(stat.id)"
                        >
                            <span
                                v-if="deletingStatId === stat.id"
                                aria-hidden="true"
                                class="text-[0.65rem] leading-none"
                            >
                                ...
                            </span>
                            <svg
                                v-else
                                aria-hidden="true"
                                class="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <path
                                    d="M7 7l10 10M17 7L7 17"
                                    stroke="currentColor"
                                    stroke-width="2.4"
                                    stroke-linecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                </header>

                <div
                    v-if="isStatExpanded(stat.id)"
                    class="grid gap-4 px-5 py-4 lg:grid-cols-[260px_1fr]"
                >
                    <div>
                        <h3
                            class="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#8291a7]"
                        >
                            Lessons
                        </h3>
                        <div class="grid gap-2">
                            <div
                                v-for="set in stat.sets || []"
                                :key="set.key"
                                class="border border-[#2b3a50] bg-[#141e2f] px-3 py-2 text-sm"
                            >
                                <p class="font-extrabold text-[#f3f6fa]">
                                    {{ set.tabTitle }}
                                </p>
                                <p class="mt-1 text-xs font-bold text-[#8291a7]">
                                    {{ set.done }} / {{ set.total }}
                                    <span class="text-[#2b3a50]">|</span>
                                    <span class="text-[#f58a87]">
                                        {{ set.mistakes }}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3
                            class="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#8291a7]"
                        >
                            Mistake words
                        </h3>

                        <p
                            v-if="!stat.mistakeWords?.length"
                            class="border border-[#2b3a50] bg-[#141e2f] p-4 text-sm font-semibold text-[#55c98b]"
                        >
                            No mistakes saved for this result.
                        </p>

                        <div v-else class="grid gap-1">
                            <div
                                v-for="(word, index) in stat.mistakeWords"
                                :key="`${word.setKey}-${word.wordId}-${index}`"
                                class="grid grid-cols-[28px_minmax(80px,0.7fr)_minmax(100px,0.8fr)_minmax(0,1.6fr)] items-center gap-2 border border-[#f06a67]/15 bg-[#f06a67]/6 px-3 py-2"
                            >
                                <button
                                    v-if="word.audioPath"
                                    type="button"
                                    aria-label="Play mistake audio"
                                    title="Play audio"
                                    class="grid h-7 w-7 cursor-pointer place-items-center bg-transparent text-[#8fb6ff] transition hover:text-white active:scale-95"
                                    @click="playAudio(word.audioPath)"
                                >
                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 24 24"
                                        class="h-5 w-5"
                                        fill="none"
                                    >
                                        <path
                                            d="M5 9.5h3L12 6v12l-4-3.5H5z"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linejoin="round"
                                        />
                                        <path
                                            d="M16 9.5a4 4 0 0 1 0 5"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                        />
                                    </svg>
                                </button>
                                <span v-else aria-hidden="true"></span>

                                <strong
                                    class="japanese-text truncate text-xl font-normal text-[#f3f6fa]"
                                    :title="word.japanese"
                                >
                                    {{ word.japanese }}
                                </strong>
                                <span
                                    class="japanese-text truncate text-lg text-[#c9d5e5]"
                                    :title="word.reading"
                                >
                                    {{ word.reading }}
                                </span>
                                <span
                                    class="truncate text-sm font-bold text-[#c9d5e5]"
                                    :title="word.translation"
                                >
                                    {{ word.translation }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        </div>
    </section>
</template>
