<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import SheetSourceCard from '../components/SheetSourceCard.vue'
import { getSpreadsheetInfo, isGoogleSheetsUrl } from '../services/googleSheets'
import { loadSources, saveSources } from '../services/sourcesStore'

const sheetUrl = ref('')
const errorMessage = ref('')
const loading = ref(false)
const loadingSources = ref(true)
const refreshingSources = ref(false)
const saving = ref(false)
const removingSource = ref(false)

const sources = ref([])

const sourceListTransitionName = computed(() =>
    removingSource.value ? 'source-list-instant' : 'source-list',
)

onMounted(async () => {
    try {
        const savedSources = await loadSources()
        const hasSavedErrors = savedSources.some((source) => source.error)

        sources.value = savedSources.map((source) => ({
            ...source,
            error: '',
        }))

        if (hasSavedErrors) {
            await saveSources(sources.value)
        }
    } catch (error) {
        errorMessage.value = 'Could not load saved Google Sheets sources.'
    } finally {
        loadingSources.value = false
    }
})

async function refreshSources() {
    if (refreshingSources.value || saving.value) {
        return
    }

    refreshingSources.value = true
    errorMessage.value = ''

    try {
        const refreshedSources = await Promise.all(
            sources.value.map(refreshSource),
        )

        sources.value = refreshedSources.map((result) => result.source)

        if (refreshedSources.some((result) => result.refreshed)) {
            await persistSources()
        }
    } finally {
        refreshingSources.value = false
    }
}

async function refreshSource(source) {
    try {
        const latestSource = await getSpreadsheetInfo(source.url)
        const selectedTabs = new Map(
            source.tabs.map((tab) => [tab.gid, tab.selected]),
        )

        return {
            refreshed: true,
            source: {
                ...source,
                ...latestSource,
                tabs: latestSource.tabs.map((tab) => ({
                    ...tab,
                    selected: selectedTabs.get(tab.gid) || false,
                })),
                error: '',
            },
        }
    } catch (error) {
        return {
            refreshed: false,
            source: {
                ...source,
                error:
                    error.message ||
                    'Could not refresh this Google Sheets source.',
            },
        }
    }
}

async function addSource() {
    if (saving.value) {
        return
    }

    const value = sheetUrl.value.trim()

    errorMessage.value = ''

    if (!value) {
        errorMessage.value = 'Paste a Google Sheets link.'
        return
    }

    if (!isGoogleSheetsUrl(value)) {
        errorMessage.value =
            'This does not look like a valid Google Sheets link.'
        return
    }

    loading.value = true

    try {
        const source = await getSpreadsheetInfo(value)

        const alreadyAdded = sources.value.some((item) => item.id === source.id)

        if (alreadyAdded) {
            errorMessage.value = 'This Google Sheet is already added.'
            return
        }

        sources.value.push({
            ...source,
            error: '',
        })

        await persistSources()

        sheetUrl.value = ''
    } catch (error) {
        errorMessage.value = error.message || 'Could not add this Google Sheet.'
    } finally {
        loading.value = false
    }
}

async function removeSource(sourceId) {
    if (saving.value) {
        return
    }

    removingSource.value = true
    sources.value = sources.value.filter((source) => source.id !== sourceId)
    await nextTick()
    removingSource.value = false

    await persistSources()
}

async function setTabs(sourceId, { tabGids, selected }) {
    if (saving.value) {
        return
    }

    const source = sources.value.find((item) => item.id === sourceId)

    if (!source) {
        return
    }

    const selectedGids = new Set(tabGids)
    const tabs = source.tabs.filter((tab) => selectedGids.has(tab.gid))

    if (!tabs.length) {
        return
    }

    tabs.forEach((tab) => {
        tab.selected = selected
    })

    await persistSources()
}

async function moveSourceUp(sourceId) {
    if (saving.value) {
        return
    }

    const index = sources.value.findIndex((source) => source.id === sourceId)

    if (index <= 0) {
        return
    }

    const updatedSources = [...sources.value]
    const currentSource = updatedSources[index]

    updatedSources.splice(index, 1)
    updatedSources.splice(index - 1, 0, currentSource)

    sources.value = updatedSources

    await persistSources()
}

async function moveSourceDown(sourceId) {
    if (saving.value) {
        return
    }

    const index = sources.value.findIndex((source) => source.id === sourceId)

    if (index === -1 || index >= sources.value.length - 1) {
        return
    }

    const updatedSources = [...sources.value]
    const currentSource = updatedSources[index]

    updatedSources.splice(index, 1)
    updatedSources.splice(index + 1, 0, currentSource)

    sources.value = updatedSources

    await persistSources()
}

async function persistSources() {
    saving.value = true

    try {
        await saveSources(sources.value)
    } catch (error) {
        errorMessage.value = 'Could not save Google Sheets sources.'
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <section :class="$style.card">
        <div class="mb-8">
            <p
                class="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#4f8cff]"
            >
                Settings
            </p>

            <h1 class="mb-3 text-4xl font-extrabold tracking-[-0.04em]">
                Google Sheets sources
            </h1>

            <p class="max-w-2xl text-[#9eadc1]">
                Add Google Sheets links and choose which tabs should appear as
                training sets.
            </p>
        </div>

        <form class="flex gap-3" @submit.prevent="addSource">
            <input
                v-model="sheetUrl"
                type="url"
                placeholder="Paste Google Sheets link"
                :disabled="loading || loadingSources || saving"
                class="min-h-12 flex-1 rounded-md border border-[#2b3a50] bg-[#141e2f] px-4 text-[#f3f6fa] outline-none transition placeholder:text-[#6f8098] focus:border-[#4f8cff] focus:ring-4 focus:ring-[#4f8cff]/12 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <button
                type="submit"
                :disabled="loading || loadingSources || saving"
                class="min-h-12 cursor-pointer rounded-md bg-[#4f8cff] px-6 font-bold text-[#0f1726] transition hover:bg-[#6b9fff] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {{ loading ? 'Loading...' : 'Add sheet' }}
            </button>
        </form>

        <p v-if="errorMessage" class="mt-3 text-sm font-bold text-[#f06a67]">
            {{ errorMessage }}
        </p>

        <div class="mt-8">
            <div class="mb-4 flex items-center gap-3">
                <h2 class="text-xl font-extrabold tracking-[-0.03em]">
                    Added sources
                </h2>

                <button
                    type="button"
                    :disabled="loadingSources || refreshingSources || saving"
                    class="grid h-8 w-8 cursor-pointer place-items-center rounded-md border border-[#2b3a50] bg-[#141e2f] text-[#9eadc1] transition hover:border-[#4f8cff]/60 hover:bg-[#21314a] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Refresh sources"
                    title="Refresh sources"
                    @click="refreshSources"
                >
                    <span
                        aria-hidden="true"
                        class="text-xl leading-none"
                        :class="refreshingSources ? 'animate-spin' : ''"
                    >
                        &#8635;
                    </span>
                </button>

                <span
                    class="rounded-sm bg-[#4f8cff]/12 px-3 py-1 text-xs font-bold text-[#78a6ff] transition-opacity"
                    :class="saving ? 'opacity-100' : 'opacity-0'"
                >
                    Saving...
                </span>
            </div>

            <div
                v-if="loadingSources"
                class="border border-dashed border-[#2b3a50] bg-[#141e2f] p-6 text-[#9eadc1]"
            >
                Loading saved sources...
            </div>

            <div
                v-else-if="!sources.length"
                class="border border-dashed border-[#2b3a50] bg-[#141e2f] p-6 text-[#9eadc1]"
            >
                No Google Sheets added yet.
            </div>

            <TransitionGroup
                v-else
                :name="sourceListTransitionName"
                tag="div"
                class="relative grid gap-4"
            >
                <SheetSourceCard
                    v-for="(source, index) in sources"
                    :key="source.id"
                    :source="source"
                    :can-move-up="index > 0"
                    :can-move-down="index < sources.length - 1"
                    :disabled="saving"
                    @remove="removeSource(source.id)"
                    @set-tabs="setTabs(source.id, $event)"
                    @move-up="moveSourceUp(source.id)"
                    @move-down="moveSourceDown(source.id)"
                />
            </TransitionGroup>
        </div>
    </section>
</template>

<style module>
.card {
    padding: 8px 0 40px;
}

:global(.source-list-move) {
    transition: transform 180ms ease;
}

:global(.source-list-enter-active) {
    transition: opacity 180ms ease;
}

:global(.source-list-enter-from) {
    opacity: 0;
}
</style>
