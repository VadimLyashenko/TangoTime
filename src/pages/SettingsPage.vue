<script setup>
import { onMounted, ref } from 'vue'
import SheetSourceCard from '../components/SheetSourceCard.vue'
import { getSpreadsheetInfo, isGoogleSheetsUrl } from '../services/googleSheets'
import { loadSources, saveSources } from '../services/sourcesStore'

const sheetUrl = ref('')
const errorMessage = ref('')
const loading = ref(false)
const loadingSources = ref(true)
const saving = ref(false)

const sources = ref([])

onMounted(async () => {
    try {
        sources.value = await loadSources()
    } catch (error) {
        errorMessage.value = 'Could not load saved Google Sheets sources.'
    } finally {
        loadingSources.value = false
    }
})

async function addSource() {
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
    sources.value = sources.value.filter((source) => source.id !== sourceId)
    await persistSources()
}

async function toggleTab(sourceId, tabGid) {
    const source = sources.value.find((item) => item.id === sourceId)

    if (!source) {
        return
    }

    const tab = source.tabs.find((item) => item.gid === tabGid)

    if (!tab) {
        return
    }

    tab.selected = !tab.selected

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
                class="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#b7602a]"
            >
                Settings
            </p>

            <h1 class="mb-3 text-4xl font-extrabold tracking-[-0.04em]">
                Google Sheets sources
            </h1>

            <p class="max-w-2xl text-[#6f6258]">
                Add Google Sheets links and choose which tabs should appear as
                training sets.
            </p>
        </div>

        <form class="flex gap-3" @submit.prevent="addSource">
            <input
                v-model="sheetUrl"
                type="url"
                placeholder="Paste Google Sheets link"
                class="min-h-12 flex-1 rounded-2xl border border-[#2c241f]/15 bg-white px-4 text-[#2c241f] outline-none transition placeholder:text-[#9c8d80] focus:border-[#b7602a] focus:ring-4 focus:ring-[#b7602a]/15"
            />

            <button
                type="submit"
                :disabled="loading || loadingSources"
                class="min-h-12 cursor-pointer rounded-2xl bg-[#2c241f] px-6 font-bold text-[#fffaf2] transition hover:bg-[#b7602a] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {{ loading ? 'Loading…' : 'Add sheet' }}
            </button>
        </form>

        <p v-if="errorMessage" class="mt-3 text-sm font-bold text-[#b3261e]">
            {{ errorMessage }}
        </p>

        <div class="mt-8">
            <div class="mb-4 flex items-center gap-3">
                <h2 class="text-xl font-extrabold tracking-[-0.03em]">
                    Added sources
                </h2>

                <span
                    v-if="saving"
                    class="rounded-full bg-[#fff4df] px-3 py-1 text-xs font-bold text-[#b7602a]"
                >
                    Saving…
                </span>
            </div>

            <div
                v-if="loadingSources"
                class="rounded-2xl border border-dashed border-[#2c241f]/20 bg-white/50 p-6 text-[#6f6258]"
            >
                Loading saved sources…
            </div>

            <div
                v-else-if="!sources.length"
                class="rounded-2xl border border-dashed border-[#2c241f]/20 bg-white/50 p-6 text-[#6f6258]"
            >
                No Google Sheets added yet.
            </div>

            <div v-else class="grid gap-4">
                <SheetSourceCard
                    v-for="source in sources"
                    :key="source.id"
                    :source="source"
                    @remove="removeSource(source.id)"
                    @toggle-tab="toggleTab(source.id, $event)"
                />
            </div>
        </div>
    </section>
</template>

<style module>
.card {
    border-radius: 24px;
    background: #fffaf2;
    padding: 32px;
    box-shadow: 0 16px 40px rgb(44 36 31 / 8%);
}
</style>
