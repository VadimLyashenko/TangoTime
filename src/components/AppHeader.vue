<script setup>
import { computed, watch } from 'vue'
import { useTrainingSetsStore } from '../stores/trainingSetsStore'

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

function goHome() {
    window.location.hash = '#/'
}

function goSettings() {
    window.location.hash = '#/settings'
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
</script>

<template>
    <header
        class="grid min-h-20 grid-cols-[180px_minmax(0,1fr)_180px] items-center border-b border-[#2b3a50] bg-[#151f30] px-8 py-3"
    >
        <button
            type="button"
            class="group flex cursor-pointer items-center gap-2.5 justify-self-start border-0 bg-transparent text-2xl font-extrabold text-[#f3f6fa] transition hover:text-[#78a6ff]"
            @click="goHome"
        >
            <img
                :src="logoUrl"
                alt=""
                class="h-10 w-10 object-contain transition duration-200 group-hover:-rotate-3 group-hover:scale-105"
            />
            <span>TangoTime</span>
        </button>

        <div v-if="route === '#/'" class="mx-8 min-w-0">
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

            <div v-else class="grid gap-2">
                <nav
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

                <Transition name="set-row" mode="out-in">
                    <nav
                        v-if="activeGroup"
                        :key="activeGroup.sourceId"
                        aria-label="Training sets"
                        class="flex flex-wrap justify-center gap-1.5"
                    >
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
                    </nav>
                </Transition>
            </div>

            <p
                v-if="trainingSetsError"
                class="mt-1 text-center text-xs font-bold text-[#f06a67]"
            >
                {{ trainingSetsError }}
            </p>
        </div>

        <button
            type="button"
            aria-label="Open settings"
            title="Settings"
            :class="[
                'col-start-3 grid h-12 w-12 cursor-pointer place-items-center justify-self-end border-0 bg-transparent text-3xl transition duration-200 hover:rotate-12 active:scale-90',
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
    </header>
</template>

<style scoped>
.set-row-enter-active,
.set-row-leave-active {
    transition:
        opacity 180ms ease,
        transform 180ms ease;
}

.set-row-enter-from {
    opacity: 0;
    transform: translateX(12px);
}

.set-row-leave-to {
    opacity: 0;
    transform: translateX(-12px);
}
</style>
