import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const APP_STATE_DOCUMENT_PATH = ['appState', 'default']
const DEFAULT_STATS_LIMIT = 50

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
    const snapshot = await getDoc(doc(db, ...APP_STATE_DOCUMENT_PATH))

    if (!snapshot.exists()) {
        return []
    }

    const data = snapshot.data()
    const stats = Array.isArray(data.trainingStats) ? data.trainingStats : []

    return stats
        .toSorted((firstStat, secondStat) =>
            String(secondStat.createdAtIso || '').localeCompare(
                String(firstStat.createdAtIso || ''),
            ),
        )
        .slice(0, maxStats)
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
