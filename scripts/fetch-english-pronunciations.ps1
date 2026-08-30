#requires -Version 7.0

param(
    [ValidateRange(1, 84)]
    [int]$StartRow = 1,

    [ValidateRange(1, 84)]
    [int]$EndRow = 10,

    [ValidateRange(1, 15)]
    [double]$DelaySeconds = 2.5
)

$ErrorActionPreference = 'Stop'

if ($StartRow -gt $EndRow) {
    throw 'StartRow must not be greater than EndRow.'
}

$terms = @(
    'photocopiable',
    'overview',
    'to exploit',
    'to revise',
    'activities',
    'aim',
    'engaging',
    'relevant',
    'refer',
    'the video offers',
    'as well as',
    'range',
    'according to',
    'need',
    'confidence',
    'review',
    'suggest',
    'exploit',
    'access',
    'bite-size',
    'exception',
    'above all else',
    'just as much as',
    'equals (=)',
    'equal',
    'believe',
    'importance',
    'concrete',
    'objective',
    'memorable',
    'presentation',
    'structure',
    'introduce',
    'regular',
    'varied',
    'reference',
    'engage',
    'suspense',
    'context',
    'sentence',
    'common',
    'error',
    'point',
    'variety',
    'express',
    'set up',
    'activity',
    'although',
    'keep to a minimum',
    'judicious',
    'rapport',
    'contrast',
    'assimilate',
    'easily',
    'high-frequency',
    'personalize',
    'to present',
    'focus on',
    'lexical',
    'amount',
    'area',
    'phonemic',
    'alongside',
    'link to',
    'model',
    'revise',
    'test oneself',
    'in one''s own time',
    'further',
    'intensive',
    'systematic',
    'aspect',
    'e.g.',
    'stress',
    'rhythm',
    'awareness',
    'pattern',
    'learner',
    'frustrated',
    'particularly',
    'sound-spelling relationship',
    'silent letter',
    'weak form',
    'integrate'
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$audioDirectory = Join-Path $projectRoot 'public/audio/english/us'
$userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'

New-Item -ItemType Directory -Path $audioDirectory -Force | Out-Null

function Get-Slug {
    param([string]$Value)

    $slug = $Value.ToLowerInvariant()
    $slug = $slug -replace "[’']", ''
    $slug = $slug -replace '[^a-z0-9]+', '-'
    return $slug.Trim('-')
}

for ($row = $StartRow; $row -le $EndRow; $row++) {
    $term = $terms[$row - 1]
    $encodedTerm = [System.Uri]::EscapeDataString($term) -replace '%20', '+'
    $sourcePage = "https://wooordhunt.ru/word/$encodedTerm"
    $slug = Get-Slug -Value $term
    $fileName = ('{0:D2}-{1}.mp3' -f $row, $slug)
    $localFile = Join-Path $audioDirectory $fileName
    $relativePath = "audio/english/us/$fileName"

    $result = [ordered]@{
        row = $row
        term = $term
        status = 'page-error'
        ipa = $null
        sourcePage = $sourcePage
        sourceAudio = $null
        relativePath = $null
        bytes = 0
        checkedAt = (Get-Date).ToUniversalTime().ToString('o')
        message = $null
    }

    try {
        $pageResponse = Invoke-WebRequest -Uri $sourcePage -Headers @{ 'User-Agent' = $userAgent } -TimeoutSec 30
        $html = $pageResponse.Content

        $ipaMatch = [regex]::Match(
            $html,
            'id=["'']us_tr_sound["''][\s\S]*?class=["'']transcription["''][^>]*>\s*\|(?<ipa>[^|<]+)\|',
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
        $audioMatch = [regex]::Match(
            $html,
            '(?<audio>/data/sound/sow/us/[^"'']+\.mp3)',
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )

        if ($ipaMatch.Success) {
            $decodedIpa = [System.Net.WebUtility]::HtmlDecode($ipaMatch.Groups['ipa'].Value.Trim())
            $result.ipa = "/$decodedIpa/"
        }

        if (-not $audioMatch.Success) {
            $result.status = 'no-us-audio'
            $result.message = 'The page has no American audio source.'
        }
        else {
            $audioUrl = 'https://wooordhunt.ru' + [System.Net.WebUtility]::HtmlDecode($audioMatch.Groups['audio'].Value)
            $result.sourceAudio = $audioUrl

            Start-Sleep -Seconds 1
            Invoke-WebRequest -Uri $audioUrl -Headers @{ 'User-Agent' = $userAgent; 'Referer' = $sourcePage } -OutFile $localFile -TimeoutSec 30

            $fileInfo = Get-Item -LiteralPath $localFile
            $firstBytes = [System.IO.File]::ReadAllBytes($localFile) | Select-Object -First 3
            $looksLikeMp3 = (
                ($firstBytes.Count -ge 3 -and $firstBytes[0] -eq 0x49 -and $firstBytes[1] -eq 0x44 -and $firstBytes[2] -eq 0x33) -or
                ($firstBytes.Count -ge 2 -and $firstBytes[0] -eq 0xFF -and ($firstBytes[1] -band 0xE0) -eq 0xE0)
            )

            if ($fileInfo.Length -lt 1000 -or -not $looksLikeMp3) {
                Remove-Item -LiteralPath $localFile -Force
                $result.status = 'invalid-audio'
                $result.message = 'Downloaded response is not a valid MP3.'
            }
            else {
                $result.status = if ($result.ipa) { 'ok' } else { 'audio-without-ipa' }
                $result.relativePath = $relativePath
                $result.bytes = $fileInfo.Length
            }
        }
    }
    catch {
        $result.message = $_.Exception.Message
    }

    Write-Output ("Row {0}: {1} — {2}" -f $row, $term, $result.status)

    if ($row -lt $EndRow) {
        Start-Sleep -Milliseconds ([int]($DelaySeconds * 1000))
    }
}
