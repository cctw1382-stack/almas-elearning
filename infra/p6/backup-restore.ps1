param(
    [Parameter(Mandatory)][string]$PostgresBin,
    [Parameter(Mandatory)][string]$TestRoot
)
$ErrorActionPreference = 'Stop'
# The existing fixture creates a new cluster and two disposable databases.
& (Join-Path $PSScriptRoot '../test-postgres-memberships.ps1') -PostgresBin $PostgresBin -TestRoot $TestRoot
