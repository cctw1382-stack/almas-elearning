param([string]$Base = 'http://127.0.0.1:8090')
$ErrorActionPreference = 'Stop'
if ($Base -ne 'http://127.0.0.1:8090') { throw 'Use the local fixture endpoint.' }
$compose = Join-Path $PSScriptRoot 'compose.yml'
function Assert-Ready {
    1..12 | ForEach-Object {
        $response = Invoke-WebRequest "$Base/ready" -TimeoutSec 5
        if ($response.StatusCode -ne 204) { throw 'API readiness failed during partial outage.' }
    }
}
Assert-Ready
try {
    docker compose -f $compose stop media api-a
    if ($LASTEXITCODE) { throw 'Could not stop fixture replicas.' }
    Assert-Ready
    $response = Invoke-WebRequest "$Base/api/v1/schools/00000000-0000-4000-8000-000000000011/media/00000000-0000-4000-8000-000000000070/play" -SkipHttpErrorCheck -TimeoutSec 5
    if ($response.StatusCode -notin 502,503,504) { throw 'Expected independent media outage.' }
} finally {
    docker compose -f $compose start media api-a
    if ($LASTEXITCODE) { throw 'Could not restart fixture replicas.' }
}
