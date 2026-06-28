<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getSheetRows } from '../services/googleSheets'
import { parseWordsRowsResult } from '../services/wordsParser'
import { useTrainingPreferencesStore } from '../stores/trainingPreferencesStore'
import { useTrainingSetsStore } from '../stores/trainingSetsStore'

const STORAGE_KEY = 'tangotime-training-sessions'

const { selectedSets, selectedSet, loadingTrainingSets, trainingSetsError } =
    useTrainingSetsStore()
const { displayMode, isRandomEnabled } = useTrainingPreferencesStore()

const rows = ref([])
const loadingRows = ref(false)
const rowsError = ref('')
const sessions = ref(loadSessions())
let activeRequestId = 0

const parsedRows = computed(() => parseWordsRowsResult(rows.value))
const words = computed(() => parsedRows.value.words)
const skippedRows = computed(() => parsedRows.value.skippedRows)
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

const currentPromptLabel = computed(() => {
    if (!currentWord.value) {
        return ''
    }

    if (!isShowingJapanese.value) {
        return 'Russian'
    }

    return currentWord.value.hasReading ? 'Kanji' : 'Kana only'
})

const currentPromptText = computed(() => {
    if (!currentWord.value) {
        return ''
    }

    return isShowingJapanese.value
        ? currentWord.value.japanese
        : currentWord.value.translation
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

watch(
    () => selectedSet.value?.key,
    (setKey) => loadRowsForSelectedSet(setKey),
    { immediate: true },
)

watch(
    sessions,
    (value) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    },
    { deep: true },
)

watch(currentRandomEnabled, () => {
    restartCurrentSession()
})

onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
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

    if (sessions.value[setKey].currentWordIndex >= order.length) {
        sessions.value[setKey].currentWordIndex = Math.max(order.length - 1, 0)
    }
}

function restartCurrentSession() {
    const setKey = selectedSet.value?.key

    if (!setKey || !words.value.length) {
        return
    }

    sessions.value[setKey] = createSession(
        words.value,
        currentRandomEnabled.value,
    )
}

function createSession(loadedWords, shouldShuffle) {
    const wordIds = loadedWords.map((word) => word.id)

    return {
        currentWordIndex: 0,
        answerVisible: false,
        completed: false,
        shuffled: shouldShuffle,
        history: [],
        order: createWordOrder(wordIds, shouldShuffle),
    }
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

async function loadRowsForSelectedSet(setKey) {
    const requestId = ++activeRequestId
    const set = selectedSets.value.find((item) => item.key === setKey)

    rows.value = []
    rowsError.value = ''

    if (!set) {
        loadingRows.value = false
        return
    }

    loadingRows.value = true

    try {
        const loadedRows = await getSheetRows(set.sourceId, set.tabTitle)

        if (requestId !== activeRequestId) {
            return
        }

        rows.value = loadedRows
        ensureSession(setKey, parseWordsRowsResult(loadedRows).words)
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

    session.answerVisible = true
    session.history.push({
        wordId: currentWord.value.id,
        reading: currentWord.value.reading,
        japanese: currentWord.value.japanese,
        translation: currentWord.value.translation,
        correct,
    })
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

    if (
        event.key.toLowerCase() === 'e' &&
        !currentSession.value?.answerVisible
    ) {
        checkAnswer(false)
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
            <div
                class="mb-5 flex items-end justify-between gap-4 border-b border-[#2b3a50] pb-5"
            >
                <div class="min-w-0">
                    <h1 class="truncate text-3xl font-extrabold text-[#f3f6fa]">
                        {{ selectedSet.tabTitle }}
                    </h1>
                    <p
                        class="mt-1 truncate text-sm font-semibold text-[#9eadc1]"
                    >
                        {{ selectedSet.sourceTitle }}
                    </p>
                </div>

                <div class="shrink-0 text-sm font-bold text-[#9eadc1]">
                    {{ words.length }} words
                </div>
            </div>

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
                class="grid min-h-150 grid-cols-[minmax(0,1fr)_440px] border-y border-[#2b3a50]"
            >
                <main
                    class="grid place-items-center border-r border-[#2b3a50] bg-[#141e2f] px-12 py-10"
                >
                    <div
                        v-if="currentSession.completed"
                        class="w-full max-w-180 text-center"
                    >
                        <p
                            class="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#4f8cff]"
                        >
                            Session complete
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

                    <div v-else class="w-full max-w-240 text-center">
                        <p
                            class="mb-8 text-sm font-extrabold uppercase tracking-[0.12em] text-[#4f8cff]"
                        >
                            {{ currentSession.currentWordIndex + 1 }} /
                            {{ orderedWords.length }}
                        </p>

                        <Transition name="word-card" mode="out-in">
                            <div :key="currentWord.id" class="mb-8">
                                <p
                                    class="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-[#8291a7]"
                                >
                                    {{ currentPromptLabel }}
                                </p>
                                <h2
                                    :class="[
                                        'text-[#f3f6fa]',
                                        isShowingJapanese
                                            ? 'japanese-text text-[10rem] leading-none'
                                            : 'mx-auto max-w-180 text-7xl font-extrabold leading-tight',
                                    ]"
                                >
                                    {{ currentPromptText }}
                                </h2>
                            </div>
                        </Transition>

                        <div class="mb-8 min-h-28">
                            <Transition name="answer">
                                <div
                                    v-if="currentSession.answerVisible"
                                    class="min-h-28 border-t border-[#2b3a50] pt-6"
                                >
                                    <template v-if="isShowingJapanese">
                                        <p
                                            v-if="currentWord.reading"
                                            class="japanese-text mb-3 text-4xl text-[#c9d5e5]"
                                        >
                                            {{ currentWord.reading }}
                                        </p>
                                        <p
                                            class="text-2xl font-bold text-[#9eadc1]"
                                        >
                                            {{ currentWord.translation }}
                                        </p>
                                    </template>
                                    <template v-else>
                                        <p
                                            class="japanese-text mb-3 text-5xl text-[#f3f6fa]"
                                        >
                                            {{ currentWord.japanese }}
                                        </p>
                                        <p
                                            v-if="currentWord.reading"
                                            class="japanese-text text-3xl text-[#c9d5e5]"
                                        >
                                            {{ currentWord.reading }}
                                        </p>
                                    </template>
                                </div>
                            </Transition>
                        </div>

                        <div class="flex justify-center gap-3">
                            <template v-if="!currentSession.answerVisible">
                                <button
                                    type="button"
                                    class="cursor-pointer rounded-md bg-[#4f8cff] px-7 py-3 font-bold text-[#0f1726] transition duration-200 hover:-translate-y-0.5 hover:bg-[#6b9fff] hover:shadow-lg hover:shadow-[#4f8cff]/20 active:translate-y-0 active:scale-95"
                                    @click="checkAnswer(true)"
                                >
                                    Correct
                                </button>
                                <button
                                    type="button"
                                    class="cursor-pointer rounded-md border border-[#f06a67]/65 bg-transparent px-7 py-3 font-bold text-[#f58a87] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f06a67]/10 hover:shadow-lg hover:shadow-[#f06a67]/10 active:translate-y-0 active:scale-95"
                                    @click="checkAnswer(false)"
                                >
                                    Mistake
                                </button>
                            </template>

                            <button
                                v-else
                                type="button"
                                class="cursor-pointer rounded-md bg-[#4f8cff] px-7 py-3 font-bold text-[#0f1726] transition duration-200 hover:-translate-y-0.5 hover:bg-[#6b9fff] hover:shadow-lg hover:shadow-[#4f8cff]/20 active:translate-y-0 active:scale-95"
                                @click="goToNextWord"
                            >
                                {{
                                    currentSession.currentWordIndex ===
                                    orderedWords.length - 1
                                        ? 'Show result'
                                        : 'Next'
                                }}
                            </button>
                        </div>

                        <p class="mt-5 text-sm font-semibold text-[#8291a7]">
                            Space = correct / next | E = mistake
                        </p>
                    </div>
                </main>

                <aside class="overflow-hidden bg-[#182235]">
                    <div class="border-b border-[#2b3a50] px-5 py-4">
                        <h2 class="text-base font-extrabold text-[#f3f6fa]">
                            History
                        </h2>
                    </div>

                    <div
                        class="grid grid-cols-[minmax(90px,0.75fr)_minmax(90px,0.75fr)_minmax(0,1.35fr)] gap-4 border-b border-[#2b3a50] bg-[#141e2f] px-5 py-2.5 text-[0.68rem] font-extrabold uppercase tracking-widest text-[#6f8098]"
                    >
                        <span>Japanese</span>
                        <span>Reading</span>
                        <span>Translation</span>
                    </div>

                    <div class="max-h-142 overflow-y-auto">
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
                                class="grid grid-cols-[minmax(90px,0.75fr)_minmax(90px,0.75fr)_minmax(0,1.35fr)] items-center gap-4 border-b px-5 py-3 transition-colors"
                                :class="
                                    entry.correct
                                        ? 'border-[#55c98b]/15 bg-[#55c98b]/5.5 hover:bg-[#55c98b]/9'
                                        : 'border-[#f06a67]/15 bg-[#f06a67]/6 hover:bg-[#f06a67]/10'
                                "
                            >
                                <div class="min-w-0">
                                    <strong
                                        class="japanese-text block truncate text-xl font-normal text-[#f3f6fa]"
                                    >
                                        {{ entry.japanese }}
                                    </strong>
                                </div>

                                <span
                                    class="japanese-text min-w-0 truncate text-sm text-[#aebbd0]"
                                >
                                    {{ entry.reading || '-' }}
                                </span>

                                <p
                                    class="min-w-0 truncate text-sm font-semibold text-[#aebbd0]"
                                    :title="entry.translation"
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
:global(.history-enter-active) {
    transition:
        opacity 220ms ease,
        transform 220ms ease;
}

:global(.word-card-enter-from) {
    opacity: 0;
    transform: translateX(18px);
}

:global(.word-card-leave-to) {
    opacity: 0;
    transform: translateX(-18px);
}

:global(.answer-enter-from),
:global(.answer-leave-to) {
    opacity: 0;
    transform: translateY(8px);
}

:global(.history-enter-from) {
    opacity: 0;
    transform: translateX(14px);
}
</style>
