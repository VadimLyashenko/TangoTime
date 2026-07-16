import { doc, getDoc, increment, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const APP_STATE_DOCUMENT_PATH = ['appState', 'default']
const DEFAULT_STATS_LIMIT = 50
const ACTIVITY_FLUSH_DELAY = 60_000
const ACTIVITY_FLUSH_SIZE = 25
const pendingActivity = new Map()
let activityFlushTimer = null
let activityFlushPromise = Promise.resolve()

function getTokyoDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)
    const partValue = (type) =>
        parts.find((part) => part.type === type)?.value || ''

    return `${partValue('year')}-${partValue('month')}-${partValue('day')}`
}

export function recordTrainingActivity(answeredAtIso) {
    return adjustTrainingActivity(answeredAtIso, 1)
}

export function rollbackTrainingActivity(answeredAtIso) {
    return adjustTrainingActivity(answeredAtIso, -1)
}

function adjustTrainingActivity(answeredAtIso, amount) {
    const answeredAt = answeredAtIso ? new Date(answeredAtIso) : new Date()
    const dateKey = getTokyoDateKey(answeredAt)
    const pendingDay = pendingActivity.get(dateKey) || {
        count: 0,
        lastAnsweredAtIso: answeredAt.toISOString(),
    }

    pendingDay.count += amount
    pendingDay.lastAnsweredAtIso = answeredAt.toISOString()

    if (pendingDay.count) {
        pendingActivity.set(dateKey, pendingDay)
    } else {
        pendingActivity.delete(dateKey)
    }

    const pendingCount = [...pendingActivity.values()].reduce(
        (total, day) => total + Math.abs(day.count),
        0,
    )

    if (pendingCount >= ACTIVITY_FLUSH_SIZE) {
        return flushTrainingActivity()
    }

    if (!activityFlushTimer) {
        activityFlushTimer = window.setTimeout(() => {
            activityFlushTimer = null
            flushTrainingActivity().catch(() => {})
        }, ACTIVITY_FLUSH_DELAY)
    }

    return Promise.resolve()
}

export function flushTrainingActivity() {
    if (activityFlushTimer) {
        window.clearTimeout(activityFlushTimer)
        activityFlushTimer = null
    }

    if (!pendingActivity.size) {
        return activityFlushPromise.catch(() => {})
    }

    const activityToSave = new Map(pendingActivity)

    pendingActivity.clear()

    activityFlushPromise = activityFlushPromise.catch(() => {}).then(async () => {
        const dailyActivity = {}

        activityToSave.forEach((day, dateKey) => {
            dailyActivity[dateKey] = {
                count: increment(day.count),
                lastAnsweredAtIso: day.lastAnsweredAtIso,
            }
        })

        try {
            await setDoc(
                doc(db, ...APP_STATE_DOCUMENT_PATH),
                {
                    dailyActivity,
                },
                {
                    merge: true,
                },
            )
        } catch (error) {
            activityToSave.forEach((day, dateKey) => {
                const pendingDay = pendingActivity.get(dateKey) || {
                    count: 0,
                    lastAnsweredAtIso: day.lastAnsweredAtIso,
                }

                pendingDay.count += day.count
                pendingDay.lastAnsweredAtIso = day.lastAnsweredAtIso
                pendingActivity.set(dateKey, pendingDay)
            })

            throw error
        }
    })

    return activityFlushPromise
}

export async function saveTrainingStat(stat) {
    const snapshot = await getDoc(doc(db, ...APP_STATE_DOCUMENT_PATH))
    const data = snapshot.exists() ? snapshot.data() : {}
    const currentStats = Array.isArray(data.trainingStats)
        ? data.trainingStats
        : []
    const createdAtIso = new Date().toISOString()
    const nextStat = {
        id: crypto.randomUUID(),
        ...stat,
        createdAtIso,
    }

    await setDoc(
        doc(db, ...APP_STATE_DOCUMENT_PATH),
        {
            trainingStats: [nextStat, ...currentStats],
            statisticsUpdatedAt: createdAtIso,
        },
        {
            merge: true,
        },
    )
}

export async function loadTrainingStats(maxStats = DEFAULT_STATS_LIMIT) {
    const data = await loadTrainingStatisticsData(maxStats)

    return data.stats
}

export async function loadTrainingStatisticsData(
    maxStats = DEFAULT_STATS_LIMIT,
) {
    const snapshot = await getDoc(doc(db, ...APP_STATE_DOCUMENT_PATH))

    if (!snapshot.exists()) {
        return {
            stats: [],
            dailyActivity: {},
        }
    }

    const data = snapshot.data()
    const stats = Array.isArray(data.trainingStats) ? data.trainingStats : []

    return {
        stats: stats
            .toSorted((firstStat, secondStat) =>
                String(secondStat.createdAtIso || '').localeCompare(
                    String(firstStat.createdAtIso || ''),
                ),
            )
            .slice(0, maxStats),
        dailyActivity:
            data.dailyActivity && typeof data.dailyActivity === 'object'
                ? data.dailyActivity
                : {},
    }
}

export async function deleteTrainingStat(statId) {
    const snapshot = await getDoc(doc(db, ...APP_STATE_DOCUMENT_PATH))

    if (!snapshot.exists()) {
        return
    }

    const data = snapshot.data()
    const currentStats = Array.isArray(data.trainingStats)
        ? data.trainingStats
        : []
    const nextStats = currentStats.filter((stat) => stat.id !== statId)

    await setDoc(
        doc(db, ...APP_STATE_DOCUMENT_PATH),
        {
            trainingStats: nextStats,
            statisticsUpdatedAt: new Date().toISOString(),
        },
        {
            merge: true,
        },
    )
}
