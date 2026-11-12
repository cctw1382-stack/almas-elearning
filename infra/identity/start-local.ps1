param([string]$RuntimeRoot)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (!$RuntimeRoot) { $RuntimeRoot = Join-Path $projectRoot '.work/identity-runtime' }
$javaDirectory = Get-ChildItem (Join-Path $runtimeRoot 'java') -Directory | Select-Object -First 1
$keycloakDirectory = Join-Path $runtimeRoot 'keycloak/keycloak-26.8.1'
if (!$javaDirectory -or !(Test-Path (Join-Path $keycloakDirectory 'bin/kc.bat'))) {
    throw 'Install the verified local Java and Keycloak archives first.'
}
$credentialFile = Join-Path $runtimeRoot 'admin-credential.clixml'
if (!(Test-Path $credentialFile)) {
    $randomBytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($randomBytes) } finally { $generator.Dispose() }
    $password = ConvertTo-SecureString ([Convert]::ToBase64String($randomBytes)) -AsPlainText -Force
    $credential = New-Object Management.Automation.PSCredential('almas-local-admin', $password)
    $credential | Export-Clixml -LiteralPath $credentialFile
}
$credential = Import-Clixml -LiteralPath $credentialFile
$env:JAVA_HOME = $javaDirectory.FullName
$env:KC_BOOTSTRAP_ADMIN_USERNAME = $credential.UserName
$env:KC_BOOTSTRAP_ADMIN_PASSWORD = $credential.GetNetworkCredential().Password
$importDirectory = Join-Path $keycloakDirectory 'data/import'
New-Item -ItemType Directory -Force $importDirectory | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'almas-local-realm.json') -Destination $importDirectory
try {
    & (Join-Path $keycloakDirectory 'bin/kc.bat') start-dev --http-host=127.0.0.1 --http-port=8180 --hostname=http://127.0.0.1:8180 --import-realm
    exit $LASTEXITCODE
} finally {
    Remove-Item Env:KC_BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:KC_BOOTSTRAP_ADMIN_USERNAME -ErrorAction SilentlyContinue
}
