export function parseWordsRows(rows) {
    return parseWordsRowsResult(rows).words
}

export function parseWordsRowsResult(rows) {
    const skippedRows = []

    const words = rows
        .map((row, index) => {
            const reading = String(row[0] || '').trim()
            const japanese = String(row[1] || '').trim()
            const translation = String(row[2] || '').trim()

            return {
                id: `${index}-${reading}-${japanese}-${translation}`,
                rowNumber: index + 1,
                reading,
                japanese,
                translation,
                hasReading: Boolean(reading),
            }
        })
        .filter((word) => {
            const valid = word.japanese && word.translation

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
