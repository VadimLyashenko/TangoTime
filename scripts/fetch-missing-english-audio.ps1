#requires -Version 7.0

param(
    [ValidateRange(0.5, 10)]
    [double]$DelaySeconds = 1.5
)

$ErrorActionPreference = 'Stop'

$items = @(
    [pscustomobject]@{ row = 1; term = 'photocopiable'; ipa = '/ˌfoʊ.t̬oʊˈkɑː.pi.ə.bəl/'; kind = 'human'; provider = 'Cambridge Dictionary'; sourcePage = 'https://dictionary.cambridge.org/us/dictionary/english/photocopiable'; sourceAudio = 'https://dictionary.cambridge.org/us/media/english/us_pron/u/usp/uspho/usphono008.mp3' },
    [pscustomobject]@{ row = 5; term = 'activities'; ipa = '/ækˈtɪv.ə.tiz/'; kind = 'human'; provider = 'Wikimedia Commons'; sourcePage = 'https://commons.wikimedia.org/wiki/File:En-us-activities.ogg'; sourceAudio = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/fc/En-us-activities.ogg/En-us-activities.ogg.mp3' },
    [pscustomobject]@{ row = 10; term = 'the video offers'; ipa = '/ðə ˈvɪdioʊ ˈɔːfərz/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 11; term = 'as well as'; ipa = '/əz ˈwel əz/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 13; term = 'according to'; ipa = '/əˈkɔːr.dɪŋ ˌtuː/'; kind = 'human'; provider = 'Cambridge Dictionary'; sourcePage = 'https://dictionary.cambridge.org/us/dictionary/english/according-to'; sourceAudio = 'https://dictionary.cambridge.org/us/media/english/us_pron/c/cdo/cdomi/cdomiscusacco0069.mp3' },
    [pscustomobject]@{ row = 20; term = 'bite-size'; ipa = '/ˈbaɪt saɪz/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 22; term = 'above all else'; ipa = '/əˈbʌv ɔːl ˈels/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 23; term = 'just as much as'; ipa = '/dʒʌst əz ˈmʌtʃ əz/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 24; term = 'equals (=)'; spokenTerm = 'equals'; ipa = '/ˈiːkwəlz/'; kind = 'human'; provider = 'Wikimedia Commons'; sourcePage = 'https://commons.wikimedia.org/wiki/File:En-us-equals.ogg'; sourceAudio = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/b/be/En-us-equals.ogg/En-us-equals.ogg.mp3' },
    [pscustomobject]@{ row = 49; term = 'keep to a minimum'; ipa = '/kiːp tə ə ˈmɪnɪməm/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 55; term = 'high-frequency'; ipa = '/haɪ ˈfriːkwənsi/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 58; term = 'focus on'; ipa = '/ˈfoʊkəs ɑːn/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 64; term = 'link to'; ipa = '/ˈlɪŋk tə/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 67; term = 'test oneself'; ipa = '/test wʌnˈself/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 68; term = "in one's own time"; ipa = '/ɪn wʌnz oʊn taɪm/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 73; term = 'e.g.'; ipa = '/iːˈdʒiː/'; kind = 'human'; provider = 'Cambridge Dictionary'; sourcePage = 'https://dictionary.cambridge.org/us/dictionary/english/eg'; sourceAudio = 'https://dictionary.cambridge.org/us/media/english/us_pron/u/usd/usdur/usdurst029.mp3' },
    [pscustomobject]@{ row = 81; term = 'sound-spelling relationship'; ipa = '/ˈsaʊnd ˌspelɪŋ rɪˈleɪʃənʃɪp/'; kind = 'tts'; provider = 'Google Translate'; sourcePage = 'https://translate.google.com/' },
    [pscustomobject]@{ row = 82; term = 'silent letter'; ipa = '/ˌsaɪ.lənt ˈlet̬.ɚ/'; kind = 'human'; provider = 'Cambridge Dictionary'; sourcePage = 'https://dictionary.cambridge.org/us/dictionary/english/silent-letter'; sourceAudio = 'https://dictionary.cambridge.org/us/media/english/us_pron/u/usa/usa34/usa34820.mp3' },
    [pscustomobject]@{ row = 83; term = 'weak form'; ipa = '/ˈwiːk ˌfɔːrm/'; kind = 'human'; provider = 'Cambridge Dictionary'; sourcePage = 'https://dictionary.cambridge.org/us/dictionary/english/weak-form'; sourceAudio = 'https://dictionary.cambridge.org/us/media/english/us_pron/c/cal/cald4/cald4us2414.mp3' }
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$audioDirectory = Join-Path $projectRoot 'public/audio/english/us'
$userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'

function Get-Slug {
    param([string]$Value)

    $slug = $Value.ToLowerInvariant()
    $slug = $slug -replace "[’']", ''
    $slug = $slug -replace '[^a-z0-9]+', '-'
    return $slug.Trim('-')
}

New-Item -ItemType Directory -Path $audioDirectory -Force | Out-Null

foreach ($item in $items) {
    $spokenTerm = if ($item.spokenTerm) { $item.spokenTerm } else { $item.term }
    $slug = Get-Slug -Value $item.term
    $fileName = ('{0:D2}-{1}.mp3' -f $item.row, $slug)
    $localFile = Join-Path $audioDirectory $fileName
    $relativePath = "audio/english/us/$fileName"
    $sourceAudio = $item.sourceAudio

    if ($item.kind -eq 'tts') {
        $encodedTerm = [System.Uri]::EscapeDataString($spokenTerm)
        $sourceAudio = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=$encodedTerm"
    }

    Write-Output ("Row {0}: downloading {1} ({2})" -f $item.row, $item.term, $item.provider)

    & curl.exe -L --fail --silent --show-error --max-time 45 -A $userAgent $sourceAudio -o $localFile
    if ($LASTEXITCODE -ne 0) {
        throw "Download failed for row $($item.row): $($item.term)"
    }

    $fileInfo = Get-Item -LiteralPath $localFile
    $firstBytes = [System.IO.File]::ReadAllBytes($localFile) | Select-Object -First 3
    $looksLikeMp3 = (
        ($firstBytes.Count -ge 3 -and $firstBytes[0] -eq 0x49 -and $firstBytes[1] -eq 0x44 -and $firstBytes[2] -eq 0x33) -or
        ($firstBytes.Count -ge 2 -and $firstBytes[0] -eq 0xFF -and ($firstBytes[1] -band 0xE0) -eq 0xE0)
    )

    if ($fileInfo.Length -lt 1000 -or -not $looksLikeMp3) {
        throw "Downloaded file is not a valid MP3 for row $($item.row): $($item.term)"
    }

    Start-Sleep -Milliseconds ([int]($DelaySeconds * 1000))
}

Write-Output ("Completed {0} missing audio files." -f $items.Count)
