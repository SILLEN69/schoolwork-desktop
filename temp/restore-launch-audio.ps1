$ErrorActionPreference = 'Stop'
$taskRepoRoot = Split-Path -Parent $PSScriptRoot
$taskAudioSource = Join-Path $PSScriptRoot 'project/remotion-startup/public/launch-private'
$taskAudioTarget = Join-Path $taskRepoRoot 'remotion-startup/public/launch-private'
New-Item -ItemType Directory -Path $taskAudioTarget -Force | Out-Null
foreach ($taskAudioName in @('provided-music.wav', 'stock-effects.wav')) {
    Copy-Item -LiteralPath (Join-Path $taskAudioSource $taskAudioName) -Destination (Join-Path $taskAudioTarget $taskAudioName)
}
Write-Output 'Launch audio restored to the normal Remotion project.'
