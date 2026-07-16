<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getSheetRows } from '../services/googleSheets'
import {
    recordTrainingActivity,
    rollbackTrainingActivity,
} from '../services/trainingStatsStore'
import { parseWordsRowsResult } from '../services/wordsParser'
import { useTrainingPreferencesStore } from '../stores/trainingPreferencesStore'
import { useTrainingSetsStore } from '../stores/trainingSetsStore'

const STORAGE_KEY = 'tangotime-training-sessions'

const { selectedSets, selectedSet, loadingTrainingSets, trainingSetsError } =
    useTrainingSetsStore()
const { displayMode, autoPlayAnswerAudio, isRandomEnabled, toggleRandomForSet } =
    useTrainingPreferencesStore()

const rows = ref([])
const words = ref([])
const skippedRows = ref([])
const loadingRows = ref(false)
const rowsError = ref('')
const sessions = ref(loadSessions())
const historyScrollElement = ref(null)
const activeMistakeHistoryIndex = ref(null)
const currentMistakeCycleIndex = ref(-1)
let activeAudio = null
let activeRequestId = 0

const rowsWarning = computed(() => {
    if (!skippedRows.value.length) {
        return ''
    }

    return `Loaded ${words.value.length} words, skipped ${skippedRows.value.length} rows.`
})

const currentSession = computed(() => {
    const setKey = selectedSet.value?.key
    return setKey ? sessions.value[setKey] || null : null
})

const currentRandomEnabled = computed(() =>
    isRandomEnabled(selectedSet.value?.key),
)

const orderedWords = computed(() => {
    const wordById = new Map(words.value.map((word) => [word.id, word]))
    const ordered = (currentSession.value?.order || [])
        .map((id) => wordById.get(id))
        .filter(Boolean)
    const orderedIds = new Set(ordered.map((word) => word.id))

    return [
        ...ordered,
        ...words.value.filter((word) => !orderedIds.has(word.id)),
    ]
})

const currentWord = computed(() => {
    return (
        orderedWords.value[currentSession.value?.currentWordIndex || 0] || null
    )
})

const isShowingJapanese = computed(() => displayMode.value === 'japanese')

const currentPromptText = computed(() => {
    if (!currentWord.value) {
        return ''
    }

    return isShowingJapanese.value
        ? currentWord.value.japanese
        : currentWord.value.translation
})

const currentAudioUrl = computed(() => {
    return currentWord.value?.audioPath
        ? resolveAudioUrl(currentWord.value.audioPath)
        : ''
})

const result = computed(() => {
    const history = currentSession.value?.history || []
    const correct = history.filter((entry) => entry.correct).length

    return {
        total: orderedWords.value.length,
        correct,
        mistakes: history.length - correct,
        accuracy: history.length
            ? Math.round((correct / history.length) * 100)
            : 0,
    }
})

const mistakeHistoryIndexes = computed(() => {
    return (currentSession.value?.history || []).reduce(
        (indexes, entry, index) => {
            if (!entry.correct) {
                indexes.push(index)
            }

            return indexes
        },
        [],
    )
})

const historyMistakesCount = computed(() => mistakeHistoryIndexes.value.length)

const canUndo = computed(() => Boolean(currentSession.value?.history.length))

const canReset = computed(() => {
    return hasLessonProgress(currentSession.value)
})

const currentAnswerEntry = computed(() => {
    const session = currentSession.value
    const lastEntry = session?.history[session.history.length - 1]

    if (!session?.answerVisible || !currentWord.value || !lastEntry) {
        return null
    }

    return lastEntry.wordId === currentWord.value.id ? lastEntry : null
})

watch(
    () => selectedSet.value?.key,
    (setKey) => {
        resetMistakeNavigation()
        loadRowsForSelectedSet(setKey)
    },
    { immediate: true },
)

watch(
    sessions,
    (value) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
        window.dispatchEvent(
            new CustomEvent('tangotime:training-sessions-updated', {
                detail: {
                    sessions: value,
                },
            }),
        )
    },
    { deep: true },
)

watch(currentRandomEnabled, () => {
    restartCurrentSession()
})

watch(
    () => currentWord.value?.id,
    () => stopActiveAudio(),
)

watch(historyMistakesCount, (mistakesCount) => {
    if (!mistakesCount) {
        resetMistakeNavigation()
        return
    }

    if (currentMistakeCycleIndex.value >= mistakesCount) {
        currentMistakeCycleIndex.value = mistakesCount - 1
    }
})

onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener(
        'tangotime:reset-source-lessons',
        handleResetSourceLessonsEvent,
    )
})

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener(
        'tangotime:reset-source-lessons',
        handleResetSourceLessonsEvent,
    )
    stopActiveAudio()
})

function loadSessions() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    } catch {
        return {}
    }
}

function ensureSession(setKey, loadedWords) {
    const existing = sessions.value[setKey]

    if (existing && existing.shuffled !== currentRandomEnabled.value) {
        sessions.value[setKey] = createSession(
            loadedWords,
            currentRandomEnabled.value,
        )
        return
    }

    const loadedIds = loadedWords.map((word) => word.id)
    const availableIds = new Set(loadedIds)
    const existingOrder = (existing?.order || []).filter((id) =>
        availableIds.has(id),
    )
    const existingIds = new Set(existingOrder)
    const missingIds = loadedIds.filter((id) => !existingIds.has(id))
    const shouldShuffle = existing?.shuffled ?? currentRandomEnabled.value
    const order = existing
        ? [
              ...existingOrder,
              ...(shouldShuffle ? shuffleIds(missingIds) : missingIds),
          ]
        : createWordOrder(loadedIds, shouldShuffle)

    sessions.value[setKey] = {
        currentWordIndex: 0,
        answerVisible: false,
        completed: false,
        shuffled: currentRandomEnabled.value,
        history: [],
        ...existing,
        shuffled: shouldShuffle,
        order,
    }

    backfillHistoryAudio(setKey, loadedWords)

    if (sessions.value[setKey].currentWordIndex >= order.length) {
        sessions.value[setKey].currentWordIndex = Math.max(order.length - 1, 0)
    }
}

function backfillHistoryAudio(setKey, loadedWords) {
    const history = sessions.value[setKey]?.history

    if (!Array.isArray(history) || !history.length) {
        return
    }

    const wordById = new Map(loadedWords.map((word) => [word.id, word]))

    history.forEach((entry) => {
        const word = wordById.get(entry.wordId)

        if (!word) {
            return
        }

        entry.audioPath = entry.audioPath || word.audioPath || ''
        entry.reading = entry.reading || word.reading || ''
        entry.japanese = entry.japanese || word.japanese || ''
        entry.translation = entry.translation || word.translation || ''
    })
}

function restartCurrentSession() {
    const setKey = selectedSet.value?.key

    if (!setKey || !words.value.length) {
        return
    }

    resetMistakeNavigation()
    sessions.value[setKey] = createSession(
        words.value,
        currentRandomEnabled.value,
    )
}

function restartSourceLessons(sourceId) {
    resetMistakeNavigation()

    selectedSets.value
        .filter((set) => set.sourceId === sourceId)
        .forEach((set) => {
            const session = sessions.value[set.key]
            const wordIds =
                set.key === selectedSet.value?.key && words.value.length
                    ? words.value.map((word) => word.id)
                    : session?.order || []

            if (!wordIds.length) {
                return
            }

            sessions.value[set.key] = createSessionFromWordIds(
                wordIds,
                isRandomEnabled(set.key),
            )
        })
}

function undoLastAnswer() {
    const session = currentSession.value

    if (!session?.history.length) {
        return
    }

    const previousEntry = session.history.pop()

    if (previousEntry.activityTracked) {
        rollbackTrainingActivity(previousEntry.answeredAt).catch(() => {})
    }

    const previousWordIndex = orderedWords.value.findIndex(
        (word) => word.id === previousEntry.wordId,
    )

    session.currentWordIndex =
        previousWordIndex >= 0 ? previousWordIndex : session.currentWordIndex
    session.answerVisible = false
    session.completed = false
    resetMistakeNavigation()
}

function createSession(loadedWords, shouldShuffle) {
    const wordIds = loadedWords.map((word) => word.id)

    return createSessionFromWordIds(wordIds, shouldShuffle)
}

function createSessionFromWordIds(wordIds, shouldShuffle) {
    return {
        currentWordIndex: 0,
        answerVisible: false,
        completed: false,
        shuffled: shouldShuffle,
        history: [],
        order: createWordOrder(wordIds, shouldShuffle),
    }
}

function hasLessonProgress(session) {
    if (!session) {
        return false
    }

    return (
        session.currentWordIndex > 0 ||
        session.answerVisible ||
        session.completed ||
        session.history.length > 0
    )
}

function createWordOrder(wordIds, shouldShuffle) {
    return shouldShuffle ? shuffleIds(wordIds) : [...wordIds]
}

function shuffleIds(wordIds) {
    const shuffledIds = [...wordIds]

    for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        const currentId = shuffledIds[index]

        shuffledIds[index] = shuffledIds[swapIndex]
        shuffledIds[swapIndex] = currentId
    }

    return shuffledIds
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

function playCurrentAudio() {
    if (!currentAudioUrl.value) {
        return
    }

    playAudioUrl(currentAudioUrl.value)
}

function playAudioUrl(audioUrl) {
    stopActiveAudio()
    activeAudio = new Audio(audioUrl)
    activeAudio.play().catch(() => {
        activeAudio = null
    })
}

function getHistoryAudioUrl(entry) {
    const audioPath =
        entry.audioPath ||
        orderedWords.value.find((word) => word.id === entry.wordId)?.audioPath

    return audioPath ? resolveAudioUrl(audioPath) : ''
}

function playHistoryAudio(entry) {
    const audioUrl = getHistoryAudioUrl(entry)

    if (!audioUrl) {
        return
    }

    playAudioUrl(audioUrl)
}

function resetMistakeNavigation() {
    activeMistakeHistoryIndex.value = null
    currentMistakeCycleIndex.value = -1
}

async function scrollToNextMistake() {
    const mistakeIndexes = mistakeHistoryIndexes.value

    if (!mistakeIndexes.length) {
        return
    }

    currentMistakeCycleIndex.value =
        (currentMistakeCycleIndex.value + 1) % mistakeIndexes.length
    activeMistakeHistoryIndex.value =
        mistakeIndexes[currentMistakeCycleIndex.value]

    await nextTick()

    const container = historyScrollElement.value
    const target = container?.querySelector(
        `[data-history-index="${activeMistakeHistoryIndex.value}"]`,
    )

    if (!container || !target) {
        return
    }

    const targetOffset =
        target.offsetTop - container.clientHeight / 2 + target.clientHeight / 2

    container.scrollTo({
        top: Math.max(targetOffset, 0),
        behavior: 'smooth',
    })
}

async function loadRowsForSelectedSet(setKey) {
    const requestId = ++activeRequestId
    const set = selectedSets.value.find((item) => item.key === setKey)

    rows.value = []
    words.value = []
    skippedRows.value = []
    rowsError.value = ''

    if (!set) {
        loadingRows.value = false
        return
    }

    loadingRows.value = true

    try {
        const loadedResult = await loadWordsForSet(set)

        if (requestId !== activeRequestId) {
            return
        }

        rows.value = loadedResult.rows
        words.value = loadedResult.words
        skippedRows.value = loadedResult.skippedRows
        ensureSession(setKey, loadedResult.words)
    } catch (error) {
        if (requestId === activeRequestId) {
            rowsError.value =
                error.message || 'Could not load words from this training set.'
        }
    } finally {
        if (requestId === activeRequestId) {
            loadingRows.value = false
        }
    }
}

async function loadWordsForSet(set) {
    if (set.mode === 'test') {
        return loadTestWords(set)
    }

    return loadTabWords(set.sourceId, set.tabTitle)
}

async function loadTabWords(sourceId, tabTitle) {
    const loadedRows = await getSheetRows(sourceId, tabTitle)
    const result = parseWordsRowsResult(loadedRows)

    return {
        rows: loadedRows,
        words: result.words,
        skippedRows: result.skippedRows,
    }
}

async function loadTestWords(set) {
    const tabTitles = Array.isArray(set.tabTitles) ? set.tabTitles : []
    const tabResults = await Promise.all(
        tabTitles.map(async (tabTitle) => {
            const result = await loadTabWords(set.sourceId, tabTitle)

            return {
                tabTitle,
                ...result,
            }
        }),
    )

    return tabResults.reduce(
        (combinedResult, tabResult) => {
            combinedResult.rows.push(...tabResult.rows)
            combinedResult.words.push(
                ...tabResult.words.map((word) => ({
                    ...word,
                    id: `${tabResult.tabTitle}:${word.id}`,
                    tabTitle: tabResult.tabTitle,
                })),
            )
            combinedResult.skippedRows.push(...tabResult.skippedRows)

            return combinedResult
        },
        {
            rows: [],
            words: [],
            skippedRows: [],
        },
    )
}

function checkAnswer(correct) {
    const session = currentSession.value

    if (
        !currentWord.value ||
        !session ||
        session.answerVisible ||
        session.completed
    ) {
        return
    }

    const answeredAt = new Date().toISOString()

    session.answerVisible = true
    session.history.push({
        wordId: currentWord.value.id,
        reading: currentWord.value.reading,
        japanese: currentWord.value.japanese,
        translation: currentWord.value.translation,
        audioPath: currentWord.value.audioPath,
        answeredAt,
        activityTracked: true,
        correct,
    })

    recordTrainingActivity(answeredAt).catch(() => {})

    if (autoPlayAnswerAudio.value) {
        playCurrentAudio()
    }
}

function goToNextWord() {
    const session = currentSession.value

    if (!session?.answerVisible || session.completed) {
        return
    }

    if (session.currentWordIndex >= orderedWords.value.length - 1) {
        session.completed = true
        return
    }

    session.currentWordIndex += 1
    session.answerVisible = false
}

function markCurrentAnswer(correct) {
    if (!currentAnswerEntry.value) {
        return
    }

    currentAnswerEntry.value.correct = correct
}

function handleKeydown(event) {
    if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
    ) {
        return
    }

    if (event.code === 'Space') {
        event.preventDefault()

        if (currentSession.value?.answerVisible) {
            goToNextWord()
        } else {
            checkAnswer(true)
        }

        return
    }

    if (event.key.toLowerCase() === 'e') {
        if (currentSession.value?.answerVisible) {
            markCurrentAnswer(false)
            return
        }

        checkAnswer(false)
    }

    if (event.key.toLowerCase() === 'a') {
        event.preventDefault()
        playCurrentAudio()
    }
}

function handleResetClick() {
    restartCurrentSession()
}

function handleResetSourceLessonsEvent(event) {
    const sourceId = event.detail?.sourceId

    if (!sourceId) {
        return
    }

    const hasProgress = selectedSets.value.some(
        (set) =>
            set.sourceId === sourceId &&
            hasLessonProgress(sessions.value[set.key]),
    )

    if (!hasProgress) {
        return
    }

    const confirmed = window.confirm(
        'Reset progress for all selected lessons in this source?',
    )

    if (confirmed) {
        restartSourceLessons(sourceId)
    }
}
</script>

<template>
    <section :class="$style.trainingArea">
        <div
            v-if="loadingTrainingSets"
            class="border border-dashed border-[#2b3a50] bg-[#182235] p-6 text-[#9eadc1]"
        >
            Loading training sets...
        </div>

        <div
            v-else-if="trainingSetsError"
            class="border border-[#f06a67]/35 bg-[#2a202b] p-6 font-bold text-[#f58a87]"
        >
            {{ trainingSetsError }}
        </div>

        <div
            v-else-if="!selectedSets.length"
            class="border border-dashed border-[#2b3a50] bg-[#182235] p-6 text-[#9eadc1]"
        >
            No training sets selected yet. Open settings and choose tabs first.
        </div>

        <div
            v-else-if="!selectedSet"
            class="border border-dashed border-[#2b3a50] bg-[#182235] p-6 text-[#9eadc1]"
        >
            Choose a training set in the header.
        </div>

        <div v-else class="min-h-130">
            <p
                v-if="rowsWarning && !loadingRows && !rowsError"
                class="mb-5 border border-[#f2c94c]/30 bg-[#2a281d] px-4 py-3 text-sm font-bold text-[#f2c94c]"
            >
                {{ rowsWarning }}
            </p>

            <div
                v-if="loadingRows"
                class="grid min-h-150 place-items-center border border-dashed border-[#2b3a50] bg-[#182235] p-10 text-[#9eadc1]"
            >
                Loading words...
            </div>

            <div
                v-else-if="rowsError"
                class="grid min-h-150 place-items-center border border-[#f06a67]/35 bg-[#2a202b] p-10 text-center font-bold text-[#f58a87]"
            >
                {{ rowsError }}
            </div>

            <div
                v-else-if="!words.length || !currentSession"
                class="grid min-h-150 place-items-center border border-dashed border-[#2b3a50] bg-[#182235] p-10 text-[#9eadc1]"
            >
                This tab has no words.
            </div>

            <div
                v-else
                class="grid min-h-150 grid-cols-[minmax(0,1fr)_520px] border-y border-[#2b3a50]"
            >
                <main
                    class="flex border-r border-[#2b3a50] bg-[#141e2f] px-8 py-4"
                >
                    <div
                        v-if="currentSession.completed"
                        class="m-auto w-full max-w-180 text-center"
                    >
                        <p
                            class="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#4f8cff]"
                        >
                            Lesson complete
                        </p>
                        <h2 class="mb-8 text-6xl font-extrabold text-[#f3f6fa]">
                            {{ result.accuracy }}%
                        </h2>
                        <div class="grid grid-cols-3 gap-3">
                            <div
                                class="border border-[#2b3a50] bg-[#182235] p-4"
                            >
                                <strong class="block text-2xl text-[#f3f6fa]">{{
                                    result.total
                                }}</strong>
                                <span class="text-sm font-bold text-[#9eadc1]"
                                    >Total words</span
                                >
                            </div>
                            <div
                                class="border border-[#55c98b]/25 bg-[#172b29] p-4"
                            >
                                <strong class="block text-2xl text-[#55c98b]">{{
                                    result.correct
                                }}</strong>
                                <span class="text-sm font-bold text-[#55c98b]"
                                    >Correct</span
                                >
                            </div>
                            <div
                                class="border border-[#f06a67]/25 bg-[#2a202b] p-4"
                            >
                                <strong class="block text-2xl text-[#f06a67]">{{
                                    result.mistakes
                                }}</strong>
                                <span class="text-sm font-bold text-[#f06a67]"
                                    >Mistakes</span
                                >
                            </div>
                        </div>
                    </div>

                    <div
                        v-else
                        class="mx-auto flex w-full max-w-240 self-stretch text-center"
                    >
                        <div class="flex min-h-0 w-full flex-col">
                            <Transition name="word-card" mode="out-in">
                                <div :key="currentWord.id">
                                    <h2
                                        :class="[
                                            'text-[#f3f6fa]',
                                            isShowingJapanese
                                                ? 'japanese-text text-[12rem] leading-none'
                                                : 'mx-auto max-w-220 text-7xl font-extrabold leading-tight',
                                        ]"
                                    >
                                        {{ currentPromptText }}
                                    </h2>
                                </div>
                            </Transition>

                            <div class="min-h-0 flex-1 pt-8">
                                <Transition name="answer">
                                    <div
                                        v-if="currentSession.answerVisible"
                                        class="flex h-full w-full flex-col items-center justify-center border-t border-[#2b3a50] py-6"
                                    >
                                        <template v-if="isShowingJapanese">
                                            <p
                                                v-if="currentWord.reading"
                                                class="japanese-text mb-4 text-6xl text-[#d8e2f0]"
                                            >
                                                {{ currentWord.reading }}
                                            </p>
                                            <p
                                                class="text-5xl font-bold leading-tight text-[#c9d5e5]"
                                            >
                                                {{ currentWord.translation }}
                                            </p>
                                        </template>
                                        <template v-else>
                                            <p
                                                class="japanese-text mb-6 text-8xl text-[#f3f6fa]"
                                            >
                                                {{ currentWord.japanese }}
                                            </p>
                                            <p
                                                v-if="currentWord.reading"
                                                class="japanese-text text-6xl text-[#d8e2f0]"
                                            >
                                                {{ currentWord.reading }}
                                            </p>
                                        </template>

                                        <div
                                            v-if="currentWord.example"
                                            class="mt-7 max-h-36 w-full max-w-200 overflow-y-auto border-l-2 border-[#4f8cff]/60 bg-[#182235]/75 px-5 py-3 text-left text-lg leading-relaxed whitespace-pre-line text-[#b8c5d8]"
                                        >
                                            {{ currentWord.example }}
                                        </div>
                                    </div>
                                </Transition>
                            </div>

                            <div class="flex justify-center gap-3">
                                <button
                                    v-if="currentAudioUrl"
                                    type="button"
                                    aria-label="Play audio"
                                    title="Play audio (A)"
                                    class="grid h-10 w-10 cursor-pointer place-items-center bg-transparent text-[#8fb6ff] transition duration-100 hover:text-white active:scale-95"
                                    @click="playCurrentAudio"
                                >
                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 24 24"
                                        class="h-8 w-8"
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

                                <template v-if="!currentSession.answerVisible">
                                    <button
                                        type="button"
                                        class="cursor-pointer rounded-md border border-[#f06a67]/65 bg-transparent px-5 py-2 text-sm font-bold text-[#f58a87] transition duration-100 hover:bg-[#f06a67]/10 hover:shadow-lg hover:shadow-[#f06a67]/10 active:scale-95"
                                        @click="checkAnswer(false)"
                                    >
                                        Mistake
                                    </button>
                                    <button
                                        type="button"
                                        class="cursor-pointer rounded-md bg-[#4f8cff] px-5 py-2 text-sm font-bold text-[#0f1726] transition duration-100 hover:bg-[#6b9fff] hover:shadow-lg hover:shadow-[#4f8cff]/20 active:scale-95"
                                        @click="checkAnswer(true)"
                                    >
                                        Correct
                                    </button>
                                </template>

                                <template v-else>
                                    <button
                                        type="button"
                                        :disabled="
                                            !currentAnswerEntry ||
                                            currentAnswerEntry.correct === false
                                        "
                                        class="cursor-pointer rounded-md border border-[#f06a67]/65 bg-transparent px-5 py-2 text-sm font-bold text-[#f58a87] transition duration-100 hover:bg-[#f06a67]/10 hover:shadow-lg hover:shadow-[#f06a67]/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:shadow-none"
                                        @click="markCurrentAnswer(false)"
                                    >
                                        Mistake
                                    </button>
                                    <button
                                        type="button"
                                        class="cursor-pointer rounded-md bg-[#4f8cff] px-5 py-2 text-sm font-bold text-[#0f1726] transition duration-100 hover:bg-[#6b9fff] hover:shadow-lg hover:shadow-[#4f8cff]/20 active:scale-95"
                                        @click="goToNextWord"
                                    >
                                        {{
                                            currentSession.currentWordIndex ===
                                            orderedWords.length - 1
                                                ? 'Show result'
                                                : 'Next'
                                        }}
                                    </button>
                                </template>
                            </div>
                        </div>
                    </div>
                </main>

                <aside class="overflow-hidden bg-[#182235]">
                    <div
                        class="flex items-center justify-between gap-3 border-b border-[#2b3a50] px-5 py-4"
                    >
                        <div class="flex min-w-0 items-center gap-3">
                            <h2
                                class="text-base font-extrabold text-[#f3f6fa]"
                            >
                                History
                            </h2>
                            <span
                                class="shrink-0 text-sm font-extrabold text-[#4f8cff]"
                            >
                                {{ currentSession.currentWordIndex + 1 }} /
                                {{ orderedWords.length }}
                            </span>
                            <button
                                type="button"
                                aria-label="Go to next mistake"
                                title="Go to next mistake"
                                :disabled="!historyMistakesCount"
                                class="inline-flex shrink-0 cursor-pointer items-baseline border-0 bg-transparent p-0 text-[#f06a67] transition hover:text-[#ff8a86] active:scale-95 disabled:cursor-default disabled:text-[#5f3b46] disabled:opacity-60"
                                @click="scrollToNextMistake"
                            >
                                <span
                                    class="text-sm font-extrabold leading-none"
                                    style="font-weight: 800"
                                >
                                    {{ historyMistakesCount }}
                                </span>
                            </button>
                        </div>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                aria-label="Toggle random order"
                                :title="
                                    currentRandomEnabled
                                        ? 'Random on'
                                        : 'Random off'
                                "
                                :class="[
                                    'grid h-8 w-8 cursor-pointer place-items-center border border-[#2b3a50] bg-[#141e2f] text-xl font-bold transition hover:border-[#4f8cff]/70 hover:text-white active:scale-95',
                                    currentRandomEnabled
                                        ? 'text-[#4f8cff]'
                                        : 'text-[#c9d5e5]',
                                ]"
                                @click="toggleRandomForSet(selectedSet.key)"
                            >
                                <span aria-hidden="true" class="leading-none"
                                    >&#8644;</span
                                >
                            </button>
                            <button
                                type="button"
                                aria-label="Undo last answer"
                                title="Undo last answer"
                                :disabled="!canUndo"
                                class="grid h-8 w-8 cursor-pointer place-items-center border border-[#2b3a50] bg-[#141e2f] text-xl font-bold text-[#c9d5e5] transition hover:border-[#4f8cff]/70 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[#2b3a50] disabled:hover:text-[#c9d5e5]"
                                @click="undoLastAnswer"
                            >
                                <span aria-hidden="true" class="leading-none"
                                    >&#8630;</span
                                >
                            </button>
                            <button
                                type="button"
                                aria-label="Reset lesson"
                                title="Reset lesson"
                                :disabled="!canReset"
                                class="grid h-8 w-8 cursor-pointer place-items-center border border-[#2b3a50] bg-[#141e2f] text-xl font-bold text-[#c9d5e5] transition hover:border-[#4f8cff]/70 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[#2b3a50] disabled:hover:text-[#c9d5e5]"
                                @click="handleResetClick"
                            >
                                <span aria-hidden="true" class="leading-none"
                                    >&#8635;</span
                                >
                            </button>
                        </div>
                    </div>

                    <div
                        ref="historyScrollElement"
                        class="max-h-142 overflow-y-auto"
                    >
                        <p
                            v-if="!currentSession.history.length"
                            class="p-6 text-center text-sm font-semibold text-[#8291a7]"
                        >
                            Checked words will appear here.
                        </p>

                        <TransitionGroup name="history">
                            <div
                                v-for="(entry, index) in currentSession.history"
                                :key="`${entry.wordId}-${index}`"
                                :data-history-index="index"
                                class="grid grid-cols-[24px_minmax(70px,0.55fr)_minmax(110px,0.95fr)_minmax(0,1.35fr)] items-center gap-1.5 border-b px-4 py-2 transition-colors"
                                :class="[
                                    entry.correct
                                        ? 'border-[#55c98b]/15 bg-[#55c98b]/5.5 hover:bg-[#55c98b]/9'
                                        : 'border-[#f06a67]/15 bg-[#f06a67]/6 hover:bg-[#f06a67]/10',
                                    activeMistakeHistoryIndex === index
                                        ? 'shadow-[inset_3px_0_0_#f06a67]'
                                        : '',
                                ]"
                            >
                                <button
                                    v-if="getHistoryAudioUrl(entry)"
                                    type="button"
                                    aria-label="Play history audio"
                                    title="Play audio"
                                    class="grid h-6 w-6 cursor-pointer place-items-center bg-transparent text-[#8fb6ff] transition duration-100 hover:text-white active:scale-95"
                                    @click="playHistoryAudio(entry)"
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

                                <div class="min-w-0">
                                    <strong
                                        class="japanese-text block truncate text-xl font-normal text-[#f3f6fa]"
                                        :title="entry.japanese"
                                    >
                                        {{ entry.japanese }}
                                    </strong>
                                </div>

                                <span
                                    class="japanese-text min-w-0 truncate text-lg text-[#aebbd0]"
                                    :title="entry.reading || '-'"
                                >
                                    {{ entry.reading || '-' }}
                                </span>

                                <p
                                    class="min-w-0 truncate pl-2 text-sm font-semibold text-[#aebbd0]"
                                    :title="entry.translation || '-'"
                                >
                                    {{ entry.translation }}
                                </p>
                            </div>
                        </TransitionGroup>
                    </div>
                </aside>
            </div>
        </div>
    </section>
</template>

<style module>
.trainingArea {
    min-height: 520px;
}

:global(.word-card-enter-active),
:global(.word-card-leave-active),
:global(.answer-enter-active),
:global(.answer-leave-active),
:global(.history-enter-active),
:global(.history-leave-active) {
    transition: opacity 90ms ease;
}

:global(.word-card-enter-from),
:global(.word-card-leave-to),
:global(.answer-enter-from),
:global(.answer-leave-to),
:global(.history-enter-from),
:global(.history-leave-to) {
    opacity: 0;
}
</style>
