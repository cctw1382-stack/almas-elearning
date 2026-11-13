param([int[]]$Workers = @(2, 4, 8, 16), [int]$Rounds = 10)
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '../../scripts/load-local.mjs'
foreach ($count in $Workers) {
    node $script $count $Rounds
    if ($LASTEXITCODE) { throw "Local simulation failed at $count workers." }
}
