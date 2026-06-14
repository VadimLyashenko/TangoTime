import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const SOURCES_DOCUMENT_PATH = ['appState', 'default']

export async function loadSources() {
    const snapshot = await getDoc(doc(db, ...SOURCES_DOCUMENT_PATH))

    if (!snapshot.exists()) {
        return []
    }

    const data = snapshot.data()

    return Array.isArray(data.sources) ? data.sources : []
}

export async function saveSources(sources) {
    await setDoc(
        doc(db, ...SOURCES_DOCUMENT_PATH),
        {
            sources,
            updatedAt: new Date().toISOString(),
        },
        {
            merge: true,
        },
    )
}