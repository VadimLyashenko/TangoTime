export function parseWordsRows(rows, language = 'japanese') {
    return parseWordsRowsResult(rows, language).words
}

export function parseWordsRowsResult(rows, language = 'japanese') {
    const skippedRows = []
    const sourceLanguage = language === 'english' ? 'english' : 'japanese'

    const words = rows
        .map((row, index) => {
            const reading = String(row[0] || '').trim()
            const term = String(row[1] || '').trim()
            const translation = String(row[2] || '').trim()
            const example = String(row[3] || '').trim()
            const audioPath = String(row[5] || '').trim()

            return {
                id: `${index}-${reading}-${term}-${translation}`,
                rowNumber: index + 1,
                reading,
                term,
                // Kept for sessions and statistics saved before language support.
                japanese: term,
                translation,
                example,
                audioPath,
                hasReading: Boolean(reading),
                language: sourceLanguage,
            }
        })
        .filter((word) => {
            const valid = word.term && word.translation

            if (!valid) {
                skippedRows.push(word.rowNumber)
            }

            return valid
        })

    return {
        words,
        skippedRows,
    }
}
