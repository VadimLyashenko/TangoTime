<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getSheetRows } from '../services/googleSheets'
import { parseWordsRows } from '../services/wordsParser'
import { useTrainingSetsStore } from '../stores/trainingSetsStore'

const STORAGE_KEY = 'tangotime-training-sessions'

const { selectedSets, selectedSet, loadingTrainingSets, trainingSetsError } =
    useTrainingSetsStore()

const rows = ref([])
const loadingRows = ref(false)
const rowsError = ref('')
const sessions = ref(loadSessions())
let activeRequestId = 0

const words = computed(() => parseWordsRows(rows.value))

const currentSession = computed(() => {
    const setKey = selectedSet.value?.key
    return setKey ? sessions.value[setKey] || null : null
})

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
    const availableIds = new Set(loadedWords.map((word) => word.id))
    const existingOrder = (existing?.order || []).filter((id) =>
        availableIds.has(id),
    )
    const existingIds = new Set(existingOrder)
    const order = [
        ...existingOrder,
        ...loadedWords
            .map((word) => word.id)
            .filter((id) => !existingIds.has(id)),
    ]

    sessions.value[setKey] = {
        currentWordIndex: 0,
        answerVisible: false,
        completed: false,
        shuffled: false,
        history: [],
        ...existing,
        order,
    }

    if (sessions.value[setKey].currentWordIndex >= order.length) {
        sessions.value[setKey].currentWordIndex = Math.max(order.length - 1, 0)
    }
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
        ensureSession(setKey, parseWordsRows(loadedRows))
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
            class="rounded-2xl border border-dashed border-[#2c241f]/20 bg-white/50 p-6 text-[#6f6258]"
        >
            Loading training sets...
        </div>

        <div
            v-else-if="trainingSetsError"
            class="rounded-2xl border border-[#b3261e]/20 bg-[#fff3f1] p-6 font-bold text-[#b3261e]"
        >
            {{ trainingSetsError }}
        </div>

        <div
            v-else-if="!selectedSets.length"
            class="rounded-2xl border border-dashed border-[#2c241f]/20 bg-white/50 p-6 text-[#6f6258]"
        >
            No training sets selected yet. Open settings and choose tabs first.
        </div>

        <div
            v-else-if="!selectedSet"
            class="rounded-2xl border border-dashed border-[#2c241f]/20 bg-white/50 p-6 text-[#6f6258]"
        >
            Choose a training set in the header.
        </div>

        <div
            v-else
            class="min-h-130 rounded-3xl bg-[#fffaf2] p-8 shadow-[0_16px_40px_rgb(44_36_31/8%)]"
        >
            <div class="mb-6 flex items-center justify-between gap-4">
                <div class="min-w-0">
                    <h1 class="truncate text-2xl font-extrabold text-[#2c241f]">
                        {{ selectedSet.tabTitle }}
                    </h1>
                    <p class="truncate text-sm font-semibold text-[#6f6258]">
                        {{ selectedSet.sourceTitle }}
                    </p>
                </div>

                <div
                    class="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#6f6258]"
                >
                    {{ words.length }} words
                </div>
            </div>

            <div
                v-if="loadingRows"
                class="grid min-h-114 place-items-center rounded-3xl border border-dashed border-[#2c241f]/15 bg-white/60 p-10 text-[#6f6258]"
            >
                Loading words...
            </div>

            <div
                v-else-if="rowsError"
                class="grid min-h-114 place-items-center rounded-3xl border border-[#b3261e]/20 bg-[#fff3f1] p-10 text-center font-bold text-[#b3261e]"
            >
                {{ rowsError }}
            </div>

            <div
                v-else-if="!words.length || !currentSession"
                class="grid min-h-114 place-items-center rounded-3xl border border-dashed border-[#2c241f]/15 bg-white/60 p-10 text-[#6f6258]"
            >
                This tab has no words.
            </div>

            <div
                v-else
                class="grid min-h-114 grid-cols-[minmax(0,1fr)_320px] gap-6"
            >
                <main
                    class="grid place-items-center rounded-3xl border border-[#2c241f]/10 bg-white/70 p-10"
                >
                    <div
                        v-if="currentSession.completed"
                        class="w-full max-w-180 text-center"
                    >
                        <p
                            class="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#b7602a]"
                        >
                            Session complete
                        </p>
                        <h2 class="mb-8 text-5xl font-extrabold text-[#2c241f]">
                            {{ result.accuracy }}%
                        </h2>
                        <div class="grid grid-cols-3 gap-3">
                            <div class="rounded-2xl bg-[#fffaf2] p-4">
                                <strong class="block text-2xl text-[#2c241f]">{{
                                    result.total
                                }}</strong>
                                <span class="text-sm font-bold text-[#6f6258]"
                                    >Total words</span
                                >
                            </div>
                            <div class="rounded-2xl bg-[#edf7ed] p-4">
                                <strong class="block text-2xl text-[#2f6b3c]">{{
                                    result.correct
                                }}</strong>
                                <span class="text-sm font-bold text-[#2f6b3c]"
                                    >Correct</span
                                >
                            </div>
                            <div class="rounded-2xl bg-[#fff0ee] p-4">
                                <strong class="block text-2xl text-[#a33a32]">{{
                                    result.mistakes
                                }}</strong>
                                <span class="text-sm font-bold text-[#a33a32]"
                                    >Mistakes</span
                                >
                            </div>
                        </div>
                    </div>

                    <div v-else class="w-full max-w-180 text-center">
                        <p
                            class="mb-6 text-sm font-extrabold uppercase tracking-[0.12em] text-[#b7602a]"
                        >
                            {{ currentSession.currentWordIndex + 1 }} /
                            {{ orderedWords.length }}
                        </p>

                        <div class="mb-8">
                            <p
                                class="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#9c8d80]"
                            >
                                {{
                                    currentWord.hasReading
                                        ? 'Kanji'
                                        : 'Kana only'
                                }}
                            </p>
                            <h2 class="text-7xl font-extrabold text-[#2c241f]">
                                {{ currentWord.japanese }}
                            </h2>
                        </div>

                        <div
                            class="mb-8 min-h-28 rounded-3xl bg-[#fffaf2] p-6 transition"
                            :class="
                                currentSession.answerVisible
                                    ? 'opacity-100'
                                    : 'opacity-0'
                            "
                        >
                            <p
                                v-if="currentWord.reading"
                                class="mb-3 text-3xl font-extrabold text-[#2c241f]"
                            >
                                {{ currentWord.reading }}
                            </p>
                            <p class="text-xl font-bold text-[#6f6258]">
                                {{ currentWord.translation }}
                            </p>
                        </div>

                        <div class="flex justify-center gap-3">
                            <template v-if="!currentSession.answerVisible">
                                <button
                                    type="button"
                                    class="cursor-pointer rounded-2xl bg-[#b7602a] px-6 py-3 font-bold text-[#fffaf2] transition hover:bg-[#9d4f22]"
                                    @click="checkAnswer(true)"
                                >
                                    Correct
                                </button>
                                <button
                                    type="button"
                                    class="cursor-pointer rounded-2xl bg-[#a33a32] px-6 py-3 font-bold text-white transition hover:bg-[#862e28]"
                                    @click="checkAnswer(false)"
                                >
                                    Mistake
                                </button>
                            </template>

                            <button
                                v-else
                                type="button"
                                class="cursor-pointer rounded-2xl bg-[#2c241f] px-6 py-3 font-bold text-[#fffaf2] transition hover:bg-[#4a3d35]"
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

                        <p class="mt-5 text-sm font-semibold text-[#9c8d80]">
                            Space = correct / next · E = mistake
                        </p>
                    </div>
                </main>

                <aside
                    class="overflow-hidden rounded-3xl border border-[#2c241f]/10 bg-white/70"
                >
                    <h2
                        class="border-b border-[#2c241f]/10 px-5 py-4 text-lg font-extrabold text-[#2c241f]"
                    >
                        History
                    </h2>
                    <div class="max-h-104 overflow-y-auto p-3">
                        <p
                            v-if="!currentSession.history.length"
                            class="p-4 text-center text-sm font-semibold text-[#9c8d80]"
                        >
                            Checked words will appear here.
                        </p>

                        <div
                            v-for="(entry, index) in currentSession.history"
                            :key="`${entry.wordId}-${index}`"
                            class="mb-2 rounded-xl p-3"
                            :class="
                                entry.correct ? 'bg-[#edf7ed]' : 'bg-[#fff0ee]'
                            "
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <strong
                                        class="block text-lg text-[#2c241f]"
                                    >
                                        {{ entry.japanese }}
                                    </strong>
                                    <span
                                        v-if="entry.reading"
                                        class="text-sm font-semibold text-[#6f6258]"
                                    >
                                        {{ entry.reading }}
                                    </span>
                                </div>
                                <span
                                    class="font-extrabold"
                                    :class="
                                        entry.correct
                                            ? 'text-[#2f6b3c]'
                                            : 'text-[#a33a32]'
                                    "
                                >
                                    {{ entry.correct ? 'Correct' : 'Mistake' }}
                                </span>
                            </div>
                            <p class="mt-1 text-sm font-bold text-[#6f6258]">
                                {{ entry.translation }}
                            </p>
                        </div>
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
</style>
