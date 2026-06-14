<script setup>
import { useTrainingSetsStore } from '../stores/trainingSetsStore'

const { selectedSets, selectedSet, loadingTrainingSets, trainingSetsError } =
    useTrainingSetsStore()
</script>

<template>
    <section :class="$style.trainingArea">
        <div
            v-if="loadingTrainingSets"
            class="rounded-2xl border border-dashed border-[#2c241f]/20 bg-white/50 p-6 text-[#6f6258]"
        >
            Loading training sets…
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

        <div v-else class="min-h-130 rounded-3xl bg-[#fffaf2] p-8 shadow-[0_16px_40px_rgb(44_36_31/8%)]">
            <div
                class="grid min-h-114 place-items-center rounded-3xl border border-dashed border-[#2c241f]/15 bg-white/60 p-10 text-center text-[#6f6258]"
            >
                Training process will be here.
            </div>
        </div>
    </section>
</template>

<style module>
.trainingArea {
    min-height: 520px;
}
</style>