const GOOGLE_SHEETS_API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY

export function isGoogleSheetsUrl(value) {
    return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(
        value,
    )
}

export function extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match?.[1] || ''
}

export async function getSpreadsheetInfo(url) {
    const spreadsheetId = extractSpreadsheetId(url)

    if (!spreadsheetId) {
        throw new Error('Invalid Google Sheets link.')
    }

    if (!GOOGLE_SHEETS_API_KEY) {
        throw new Error('Google Sheets API key is missing.')
    }

    const endpoint = new URL(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    )

    endpoint.searchParams.set(
        'fields',
        'properties.title,sheets.properties(sheetId,title)',
    )
    endpoint.searchParams.set('key', GOOGLE_SHEETS_API_KEY)

    const response = await fetch(endpoint)

    if (!response.ok) {
        throw new Error(
            'Could not load spreadsheet. Check the link, sharing settings, and API key.',
        )
    }

    const data = await response.json()

    return {
        id: spreadsheetId,
        url,
        title: data.properties?.title || 'Google Sheet',
        tabs: (data.sheets || []).map((sheet) => ({
            gid: String(sheet.properties.sheetId),
            title: sheet.properties.title,
            selected: false,
        })),
    }
}

export async function getSheetRows(spreadsheetId, tabTitle) {
    if (!spreadsheetId || !tabTitle) {
        return []
    }

    if (!GOOGLE_SHEETS_API_KEY) {
        throw new Error('Google Sheets API key is missing.')
    }

    const range = createSheetRange(tabTitle)
    const endpoint = new URL(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    )

    endpoint.searchParams.set('majorDimension', 'ROWS')
    endpoint.searchParams.set('key', GOOGLE_SHEETS_API_KEY)

    const response = await fetch(endpoint)

    if (!response.ok) {
        throw new Error('Could not load words from this Google Sheets tab.')
    }

    const data = await response.json()

    return (data.values || []).filter((row) =>
        row.some((cell) => String(cell || '').trim()),
    )
}

function createSheetRange(tabTitle) {
    const escapedTitle = tabTitle.replaceAll("'", "''")

    return `'${escapedTitle}'!A:Z`
}