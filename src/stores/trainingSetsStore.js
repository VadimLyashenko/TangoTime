import { computed, ref, watch } from 'vue'
import { loadSources } from '../services/sourcesStore'

const SELECTED_SET_STORAGE_KEY = 'tangotime-selected-set-key'

const sources = ref([])
const loadingTrainingSets = ref(false)
const trainingSetsError = ref('')
const selectedSetKey = ref(loadSelectedSetKey())

const selectedSets = computed(() => {
    return sources.value.flatMap((source) => {
        const selectedTabs = source.tabs.filter((tab) => tab.selected)

        if (source.testMode && selectedTabs.length) {
            return [
                {
                    key: `${source.id}:test`,
                    sourceId: source.id,
                    sourceTitle: source.title,
                    sourceUrl: source.url,
                    tabTitle: 'Test',
                    mode: 'test',
                    tabTitles: selectedTabs.map((tab) => tab.title),
                },
            ]
        }

        return selectedTabs.map((tab) => ({
            key: `${source.id}:${tab.gid}`,
            sourceId: source.id,
            sourceTitle: source.title,
            sourceUrl: source.url,
            tabGid: tab.gid,
            tabTitle: tab.title,
            mode: 'tab',
            tabTitles: [tab.title],
        }))
    })
})

const selectedSet = computed(() => {
    return (
        selectedSets.value.find((set) => set.key === selectedSetKey.value) ||
        null
    )
})

async function loadTrainingSets() {
    loadingTrainingSets.value = true
    trainingSetsError.value = ''

    try {
        sources.value = await loadSources()

        const selectedSetExists = selectedSets.value.some(
            (set) => set.key === selectedSetKey.value,
        )

        if (!selectedSetExists) {
            selectedSetKey.value = selectedSets.value[0]?.key || ''
        }
    } catch (error) {
        trainingSetsError.value = 'Could not load training sets.'
    } finally {
        loadingTrainingSets.value = false
    }
}

function loadSelectedSetKey() {
    try {
        return localStorage.getItem(SELECTED_SET_STORAGE_KEY) || ''
    } catch {
        return ''
    }
}

function saveSelectedSetKey(setKey) {
    try {
        if (setKey) {
            localStorage.setItem(SELECTED_SET_STORAGE_KEY, setKey)
            return
        }

        localStorage.removeItem(SELECTED_SET_STORAGE_KEY)
    } catch {
        // Ignore storage failures so training still works in restricted modes.
    }
}

watch(selectedSetKey, saveSelectedSetKey)

export function useTrainingSetsStore() {
    return {
        sources,
        selectedSets,
        selectedSet,
        selectedSetKey,
        loadingTrainingSets,
        trainingSetsError,
        loadTrainingSets,
    }
}
