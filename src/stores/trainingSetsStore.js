import { computed, ref } from 'vue'
import { loadSources } from '../services/sourcesStore'

const sources = ref([])
const loadingTrainingSets = ref(false)
const trainingSetsError = ref('')
const selectedSetKey = ref('')

const selectedSets = computed(() => {
    return sources.value.flatMap((source) =>
        source.tabs
            .filter((tab) => tab.selected)
            .map((tab) => ({
                key: `${source.id}:${tab.gid}`,
                sourceId: source.id,
                sourceTitle: source.title,
                sourceUrl: source.url,
                tabGid: tab.gid,
                tabTitle: tab.title,
            })),
    )
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