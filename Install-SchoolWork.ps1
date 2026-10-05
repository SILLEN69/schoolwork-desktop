[CmdletBinding()]
param(
    [Parameter()]
    [ValidatePattern('^v\d+\.\d+\.\d+$')]
    [string]$Version = 'v0.2.5'
)

$ErrorActionPreference = 'Stop'
$repository = 'SILLEN69/schoolwork-desktop'
$versionNumber = $Version.Substring(1)
$installerName = "SchoolWork-$versionNumber-x64-setup.exe"
$checksumName = "SHA256SUMS-$Version.txt"
$releaseUri = "https://api.github.com/repos/$repository/releases/tags/$Version"
$downloadDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("SchoolWork-$Version-" + [guid]::NewGuid().ToString('N'))

New-Item -ItemType Directory -Path $downloadDirectory | Out-Null
try {
    $release = Invoke-RestMethod -Uri $releaseUri -Headers @{ 'User-Agent' = 'SchoolWork installer' }
    $installerAsset = $release.assets | Where-Object { $_.name -eq $installerName } | Select-Object -First 1
    $checksumAsset = $release.assets | Where-Object { $_.name -eq $checksumName } | Select-Object -First 1
    if (-not $installerAsset -or -not $checksumAsset) {
        throw "Release $Version is missing the installer or its checksum manifest."
    }

    $installerPath = Join-Path $downloadDirectory $installerName
    $checksumPath = Join-Path $downloadDirectory $checksumName
    Invoke-WebRequest -Uri $installerAsset.browser_download_url -OutFile $installerPath -UseBasicParsing
    Invoke-WebRequest -Uri $checksumAsset.browser_download_url -OutFile $checksumPath -UseBasicParsing

    $checksumLine = Get-Content -LiteralPath $checksumPath | Where-Object { $_ -match ('\s+' + [regex]::Escape($installerName) + '$') } | Select-Object -First 1
    if (-not $checksumLine) {
        throw 'The release checksum manifest does not include the installer.'
    }
    $expectedHash = ($checksumLine.Trim() -split '\s+')[0]
    $actualHash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHash) {
        throw 'Installer checksum verification failed. The installer was not started.'
    }

    Write-Host "Verified SHA-256 for $installerName. Starting the interactive installer."
    Start-Process -FilePath $installerPath -Wait
}
finally {
    Remove-Item -LiteralPath $downloadDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
