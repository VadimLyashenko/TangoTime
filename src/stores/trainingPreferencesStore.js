import { ref, watch } from 'vue'

const STORAGE_KEY = 'tangotime-training-preferences'
const DISPLAY_MODES = ['japanese', 'russian']

const savedPreferences = loadPreferences()

const randomBySet = ref(
    savedPreferences.randomBySet &&
        typeof savedPreferences.randomBySet === 'object'
        ? savedPreferences.randomBySet
        : {},
)
const displayMode = ref(
    DISPLAY_MODES.includes(savedPreferences.displayMode)
        ? savedPreferences.displayMode
        : 'japanese',
)
const autoPlayAnswerAudio = ref(Boolean(savedPreferences.autoPlayAnswerAudio))

watch(
    [randomBySet, displayMode, autoPlayAnswerAudio],
    () => {
        if (typeof window === 'undefined') {
            return
        }

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                randomBySet: randomBySet.value,
                displayMode: displayMode.value,
                autoPlayAnswerAudio: autoPlayAnswerAudio.value,
            }),
        )
    },
    { deep: true },
)

function loadPreferences() {
    if (typeof window === 'undefined') {
        return {}
    }

    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    } catch {
        return {}
    }
}

function isRandomEnabled(setKey) {
    return setKey ? Boolean(randomBySet.value[setKey]) : false
}

function toggleRandomForSet(setKey) {
    if (!setKey) {
        return
    }

    randomBySet.value = {
        ...randomBySet.value,
        [setKey]: !isRandomEnabled(setKey),
    }
}

function toggleDisplayMode() {
    displayMode.value =
        displayMode.value === 'japanese' ? 'russian' : 'japanese'
}

function toggleAutoPlayAnswerAudio() {
    autoPlayAnswerAudio.value = !autoPlayAnswerAudio.value
}

export function useTrainingPreferencesStore() {
    return {
        randomBySet,
        displayMode,
        autoPlayAnswerAudio,
        isRandomEnabled,
        toggleRandomForSet,
        toggleDisplayMode,
        toggleAutoPlayAnswerAudio,
    }
}
