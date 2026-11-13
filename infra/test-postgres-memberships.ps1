param(
    [Parameter(Mandatory)][string]$PostgresBin,
    [Parameter(Mandatory)][string]$TestRoot,
    [ValidateRange(1024, 65535)][int]$Port = 55182,
    [string]$IdentityRuntimeRoot,
    [ValidateRange(1024, 65535)][int]$IdentityPort = 8182
)

$ErrorActionPreference = 'Stop'
$api = Join-Path $PSScriptRoot '../apps/api'
$bin = (Resolve-Path -LiteralPath $PostgresBin).Path
$pgctl = Join-Path $bin 'pg_ctl.exe'
$psql = Join-Path $bin 'psql.exe'
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw 'Choose an unused loopback fixture port.'
}
$fixture = Join-Path ([IO.Path]::GetFullPath($TestRoot)) ('membership-' + [Guid]::NewGuid().ToString('N'))
if ($fixture -notmatch '^[A-Za-z]:[\\/][A-Za-z0-9_.\\/-]+$') { throw 'Fixture path must use ASCII and no spaces.' }
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
$migration = Join-Path $fixture '0001_identity_membership.sql'
$examMigration = Join-Path $fixture '0002_student_exam_read.sql'
$attemptMigration = Join-Path $fixture '0003_exam_attempt_start.sql'
$answerMigration = Join-Path $fixture '0004_exam_answers.sql'
$submissionMigration = Join-Path $fixture '0005_exam_submission.sql'
$guardianMigration = Join-Path $fixture '0006_guardian_links.sql'
$seed = Join-Path $fixture 'memberships.sql'
$examSeed = Join-Path $fixture 'exams.sql'
$attemptSeed = Join-Path $fixture 'attempts.sql'
$answerSeed = Join-Path $fixture 'answers.sql'
$guardianSeed = Join-Path $fixture 'guardians.sql'
Copy-Item -LiteralPath (Join-Path $api 'migrations/0001_identity_membership.sql') -Destination $migration
Copy-Item -LiteralPath (Join-Path $api 'migrations/0002_student_exam_read.sql') -Destination $examMigration
Copy-Item -LiteralPath (Join-Path $api 'migrations/0003_exam_attempt_start.sql') -Destination $attemptMigration
Copy-Item -LiteralPath (Join-Path $api 'migrations/0004_exam_answers.sql') -Destination $answerMigration
Copy-Item -LiteralPath (Join-Path $api 'migrations/0005_exam_submission.sql') -Destination $submissionMigration
Copy-Item -LiteralPath (Join-Path $api 'migrations/0006_guardian_links.sql') -Destination $guardianMigration
Copy-Item -LiteralPath (Join-Path $api 'internal/learningapi/testdata/memberships.sql') -Destination $seed
Copy-Item -LiteralPath (Join-Path $api 'internal/learningapi/testdata/exams.sql') -Destination $examSeed
Copy-Item -LiteralPath (Join-Path $api 'internal/learningapi/testdata/attempts.sql') -Destination $attemptSeed
Copy-Item -LiteralPath (Join-Path $api 'internal/learningapi/testdata/answers.sql') -Destination $answerSeed
Copy-Item -LiteralPath (Join-Path $api 'internal/learningapi/testdata/guardians.sql') -Destination $guardianSeed
$data = Join-Path $fixture 'data'
$passwordFile = Join-Path $fixture 'init-password'
$adminPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$appPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$previousPassword = $env:PGPASSWORD
$previousTestURL = $env:ALMAS_TEST_DATABASE_URL
$previousBrowserURL = $env:ALMAS_TEST_BROWSER_DATABASE_URL
$pgArgs = @('-h', '127.0.0.1', '-p', $Port, '-U', 'almas_fixture_owner', '-w')

function Assert-NativeExit([string]$operation) {
    if ($LASTEXITCODE -ne 0) { throw "$operation failed. Fixture: $fixture" }
}

try {
    Set-Content -LiteralPath $passwordFile -Value $adminPassword -Encoding ascii
    & (Join-Path $bin 'initdb.exe') -D $data -U almas_fixture_owner -A scram-sha-256 --pwfile=$passwordFile --no-locale --encoding=UTF8
    Assert-NativeExit 'Initialize PostgreSQL'
    Remove-Item -LiteralPath $passwordFile
    $startArgs = @('start', '-D', ('"' + $data + '"'), '-l',
        ('"' + (Join-Path $fixture 'postgres.log') + '"'), '-o', ('"-h 127.0.0.1 -p ' + $Port + '"'), '-w', '-t', '40')
    $starter = Start-Process -FilePath $pgctl -ArgumentList $startArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $fixture 'pg-ctl.log') -RedirectStandardError (Join-Path $fixture 'pg-ctl-error.log')
    if (!$starter.WaitForExit(45000) -or $starter.ExitCode -ne 0) { throw "Start isolated PostgreSQL failed. Fixture: $fixture" }
    $env:PGPASSWORD = $adminPassword
    "CREATE ROLE almas_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '$appPassword';" |
        & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1
    Assert-NativeExit 'Create fixture role'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $migration
    Assert-NativeExit 'Apply identity migration'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $examMigration
    Assert-NativeExit 'Apply student exam migration'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $attemptMigration
    Assert-NativeExit 'Apply exam attempt migration'
    $seedArgs = @()
    if ($IdentityRuntimeRoot) {
        $seedArgs += @('-v', "oidc_issuer=http://127.0.0.1:$IdentityPort/realms/almas-local")
    }
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 @seedArgs -f $seed
    Assert-NativeExit 'Seed synthetic memberships'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $examSeed
    Assert-NativeExit 'Seed synthetic exams'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $attemptSeed
    Assert-NativeExit 'Seed synthetic attempt cases'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $answerMigration
    Assert-NativeExit 'Apply exam answers migration over existing attempts'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $submissionMigration
    Assert-NativeExit 'Apply exam submission migration over existing attempts'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $answerSeed
    Assert-NativeExit 'Seed previously accepted answer for timeout test'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $guardianMigration
    Assert-NativeExit 'Apply guardian link migration'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $guardianSeed
    Assert-NativeExit 'Seed synthetic guardian links'
    foreach ($mediaSource in @('migrations/0007_media_access.sql', 'migrations/0008_media_progress.sql', 'migrations/0009_lesson_owners.sql', 'internal/learningapi/testdata/media.sql')) {
        $mediaFixture = Join-Path $fixture (Split-Path $mediaSource -Leaf)
        Copy-Item -LiteralPath (Join-Path $api $mediaSource) -Destination $mediaFixture
        & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -f $mediaFixture
        Assert-NativeExit 'Apply media access fixture'
    }

    $dump = Join-Path $fixture 'memberships.dump'
    & (Join-Path $bin 'pg_dump.exe') @pgArgs -Fc -f $dump postgres
    Assert-NativeExit 'Dump fixture'
    & $psql @pgArgs -X -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE almas_restore'
    Assert-NativeExit 'Create isolated restore database'
    & (Join-Path $bin 'pg_restore.exe') @pgArgs --exit-on-error -d almas_restore $dump
    Assert-NativeExit 'Restore fixture'

    Push-Location $api
    try {
        foreach ($database in @('postgres', 'almas_restore')) {
            $env:ALMAS_TEST_DATABASE_URL = "postgres://almas_app:${appPassword}@127.0.0.1:${Port}/${database}?sslmode=disable"
            Write-Output "Testing membership isolation on fixture database $database"
            & go test -count=1 -v -run '^(TestMediaLinks|TestPostgres(Sessions|StudentExam|AttemptStart|SaveAnswer|Guardian|Media))$' ./...
            Assert-NativeExit 'Verify PostgreSQL memberships, exams and attempt starts'
        }
        if ($IdentityRuntimeRoot) {
            $env:ALMAS_TEST_DATABASE_URL = "postgres://almas_app:${appPassword}@127.0.0.1:${Port}/postgres?sslmode=disable"
            $env:ALMAS_TEST_BROWSER_DATABASE_URL = "postgres://almas_app:${appPassword}@127.0.0.1:${Port}/almas_restore?sslmode=disable"
            & (Join-Path $PSScriptRoot 'identity/test-pkce-local.ps1') -RuntimeRoot $IdentityRuntimeRoot -TestRoot $fixture -Port $IdentityPort
        }
    } finally {
        Pop-Location
    }
} finally {
    if (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid')) {
        & $pgctl stop -D $data -m fast -w -t 30
    }
    if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }
    $env:PGPASSWORD = $previousPassword
    $env:ALMAS_TEST_DATABASE_URL = $previousTestURL
    $env:ALMAS_TEST_BROWSER_DATABASE_URL = $previousBrowserURL
}
