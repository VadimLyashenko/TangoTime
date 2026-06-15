export function parseWordsRows(rows) {
    return rows
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
        .filter((word) => word.japanese && word.translation)
}
