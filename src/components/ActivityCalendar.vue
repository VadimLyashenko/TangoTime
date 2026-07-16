<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
    dailyActivity: {
        type: Object,
        default: () => ({}),
    },
    stats: {
        type: Array,
        default: () => [],
    },
})

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const todayKey = getTokyoDateKey(new Date())
const [currentYear, currentMonth] = todayKey.split('-').map(Number)
const visibleMonth = ref(new Date(Date.UTC(currentYear, currentMonth - 1, 1)))
const selectedDateKey = ref('')
const isCollapsed = ref(false)

const monthTitle = computed(() =>
    new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(visibleMonth.value),
)

const statsByDate = computed(() => {
    const groupedStats = new Map()

    props.stats.forEach((stat) => {
        const dateKey = resolveStatDateKey(stat)

        if (!dateKey) {
            return
        }

        const dayStats = groupedStats.get(dateKey) || []

        dayStats.push(stat)
        groupedStats.set(dateKey, dayStats)
    })

    return groupedStats
})

const calendarDays = computed(() => {
    const year = visibleMonth.value.getUTCFullYear()
    const month = visibleMonth.value.getUTCMonth()
    const firstWeekday = (visibleMonth.value.getUTCDay() + 6) % 7
    const firstDate = new Date(Date.UTC(year, month, 1 - firstWeekday))
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const visibleDayCount =
        Math.ceil((firstWeekday + daysInMonth) / 7) * 7

    return Array.from({ length: visibleDayCount }, (_, index) => {
        const date = new Date(firstDate)

        date.setUTCDate(firstDate.getUTCDate() + index)

        const dateKey = formatUtcDateKey(date)
        const activity = props.dailyActivity[dateKey]

        return {
            dateKey,
            day: date.getUTCDate(),
            inCurrentMonth: date.getUTCMonth() === month,
            isToday: dateKey === todayKey,
            repeatedWords:
                typeof activity === 'number'
                    ? Math.max(activity, 0)
                    : Math.max(Number(activity?.count || 0), 0),
            savedStats: statsByDate.value.get(dateKey) || [],
        }
    })
})

const selectedStats = computed(
    () => statsByDate.value.get(selectedDateKey.value) || [],
)

const selectedDateTitle = computed(() => {
    if (!selectedDateKey.value) {
        return ''
    }

    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeZone: 'UTC',
    }).format(new Date(`${selectedDateKey.value}T00:00:00Z`))
})

function formatUtcDateKey(date) {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function getTokyoDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)
    const value = (type) =>
        parts.find((part) => part.type === type)?.value || ''

    return `${value('year')}-${value('month')}-${value('day')}`
}

function resolveStatDateKey(stat) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(stat.localDate || ''))) {
        return stat.localDate
    }

    if (!stat.createdAtIso) {
        return ''
    }

    return getTokyoDateKey(new Date(stat.createdAtIso))
}

function changeMonth(offset) {
    visibleMonth.value = new Date(
        Date.UTC(
            visibleMonth.value.getUTCFullYear(),
            visibleMonth.value.getUTCMonth() + offset,
            1,
        ),
    )
    selectedDateKey.value = ''
}

function selectDay(day) {
    if (!day.inCurrentMonth) {
        return
    }

    selectedDateKey.value =
        selectedDateKey.value === day.dateKey ? '' : day.dateKey
}

function formatStatTime(stat) {
    if (!stat.createdAtIso) {
        return ''
    }

    return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: stat.timezone || 'Asia/Tokyo',
    }).format(new Date(stat.createdAtIso))
}
</script>

<template>
    <section class="mb-5 border border-[#2b3a50] bg-[#182235]">
        <header
            class="flex items-center justify-between border-b border-[#2b3a50] px-4 py-3"
        >
            <div class="flex min-w-0 items-center gap-2">
                <button
                    type="button"
                    :aria-label="
                        isCollapsed ? 'Expand calendar' : 'Collapse calendar'
                    "
                    :title="
                        isCollapsed ? 'Expand calendar' : 'Collapse calendar'
                    "
                    class="grid h-8 w-8 shrink-0 cursor-pointer place-items-center bg-transparent text-[#c9d5e5] transition hover:text-white active:scale-95"
                    @click="isCollapsed = !isCollapsed"
                >
                    <svg
                        aria-hidden="true"
                        class="h-5 w-5 transition-transform duration-150"
                        :class="isCollapsed ? '' : 'rotate-90'"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <path
                            d="M9 6l6 6-6 6"
                            stroke="currentColor"
                            stroke-width="2.4"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </button>

                <h2 class="truncate text-base font-extrabold text-[#f3f6fa]">
                    {{ monthTitle }}
                </h2>
            </div>

            <div v-if="!isCollapsed" class="flex items-center gap-2">
                <button
                    type="button"
                    aria-label="Previous month"
                    title="Previous month"
                    class="grid h-8 w-8 cursor-pointer place-items-center border border-[#2b3a50] bg-[#141e2f] text-[#c9d5e5] transition hover:border-[#4f8cff] hover:text-white active:scale-95"
                    @click="changeMonth(-1)"
                >
                    <svg
                        aria-hidden="true"
                        class="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <path
                            d="M15 6l-6 6 6 6"
                            stroke="currentColor"
                            stroke-width="2.4"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </button>
                <button
                    type="button"
                    aria-label="Next month"
                    title="Next month"
                    class="grid h-8 w-8 cursor-pointer place-items-center border border-[#2b3a50] bg-[#141e2f] text-[#c9d5e5] transition hover:border-[#4f8cff] hover:text-white active:scale-95"
                    @click="changeMonth(1)"
                >
                    <svg
                        aria-hidden="true"
                        class="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <path
                            d="M9 6l6 6-6 6"
                            stroke="currentColor"
                            stroke-width="2.4"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </button>
            </div>
        </header>

        <div
            v-show="!isCollapsed"
            class="grid grid-cols-7 border-b border-[#2b3a50] bg-[#141e2f]"
        >
            <div
                v-for="weekday in WEEKDAYS"
                :key="weekday"
                class="px-2 py-2 text-center text-[0.65rem] font-extrabold uppercase text-[#8291a7]"
            >
                {{ weekday }}
            </div>
        </div>

        <div v-show="!isCollapsed" class="grid grid-cols-7">
            <button
                v-for="day in calendarDays"
                :key="day.dateKey"
                type="button"
                :disabled="!day.inCurrentMonth"
                class="relative min-h-20 border-b border-r border-[#2b3a50] p-2 text-left transition last:border-r-0 disabled:cursor-default"
                :class="[
                    day.inCurrentMonth
                        ? 'cursor-pointer bg-[#182235] hover:bg-[#1c2940]'
                        : 'bg-[#111a29] text-[#4f5d70]',
                    day.repeatedWords
                        ? 'border-[#55c98b]/35 bg-[#55c98b]/14 hover:bg-[#55c98b]/20'
                        : '',
                    selectedDateKey === day.dateKey
                        ? 'outline-2 -outline-offset-2 outline-[#4f8cff]'
                        : '',
                ]"
                @click="selectDay(day)"
            >
                <span
                    class="grid h-6 w-6 place-items-center text-xs font-extrabold"
                    :class="
                        day.isToday
                            ? 'bg-[#4f8cff] text-[#0f1827]'
                            : day.inCurrentMonth
                              ? 'text-[#c9d5e5]'
                              : 'text-[#4f5d70]'
                    "
                >
                    {{ day.day }}
                </span>

                <span
                    v-if="day.repeatedWords"
                    class="mt-2 block text-xs font-extrabold text-[#74d9a4]"
                >
                    {{ day.repeatedWords }}
                    {{ day.repeatedWords === 1 ? 'word' : 'words' }}
                </span>

                <span
                    v-if="day.savedStats.length"
                    class="absolute right-2 top-2 flex items-center gap-1 text-xs font-extrabold text-[#8fb6ff]"
                    :title="`${day.savedStats.length} saved result${day.savedStats.length === 1 ? '' : 's'}`"
                >
                    <svg
                        aria-hidden="true"
                        class="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <path
                            d="M6 5.5C6 4.1 8.7 3 12 3s6 1.1 6 2.5S15.3 8 12 8 6 6.9 6 5.5Z"
                            stroke="currentColor"
                            stroke-width="1.8"
                        />
                        <path
                            d="M6 5.5v6C6 12.9 8.7 14 12 14s6-1.1 6-2.5v-6M6 11.5v6C6 18.9 8.7 20 12 20s6-1.1 6-2.5v-6"
                            stroke="currentColor"
                            stroke-width="1.8"
                        />
                    </svg>
                    {{ day.savedStats.length }}
                </span>
            </button>
        </div>

        <div
            v-if="!isCollapsed && selectedStats.length"
            class="border-t border-[#2b3a50] bg-[#141e2f] px-4 py-3"
        >
            <h3
                class="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#8291a7]"
            >
                Saved on {{ selectedDateTitle }}
            </h3>

            <div class="grid gap-1.5">
                <div
                    v-for="stat in selectedStats"
                    :key="stat.id"
                    class="grid items-center gap-2 border border-[#2b3a50] bg-[#182235] px-3 py-2 text-xs sm:grid-cols-[minmax(140px,1fr)_auto_auto_auto_auto]"
                >
                    <div class="min-w-0">
                        <strong class="truncate text-sm text-[#f3f6fa]">
                            {{ stat.sourceTitle }}
                        </strong>
                        <span
                            v-if="stat.testMode"
                            class="ml-2 text-[0.65rem] font-extrabold uppercase text-[#78a6ff]"
                        >
                            Test
                        </span>
                    </div>
                    <span class="font-bold text-[#8291a7]">
                        {{ formatStatTime(stat) }}
                    </span>
                    <span class="font-bold text-[#c9d5e5]">
                        {{ stat.totals?.done || 0 }} done
                    </span>
                    <span class="font-bold text-[#f58a87]">
                        {{ stat.totals?.mistakes || 0 }} mistakes
                    </span>
                    <span class="font-extrabold text-[#4f8cff]">
                        {{ stat.totals?.accuracy || 0 }}%
                    </span>
                </div>
            </div>
        </div>
    </section>
</template>
