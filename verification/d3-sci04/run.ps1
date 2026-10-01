param(
  [Parameter(Mandatory = $true)]
  [string]$ZigExe,
  [Parameter(Mandatory = $true)]
  [string]$PackageSha256
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$evidence = Join-Path $PSScriptRoot "evidence"
$nativeInclude = Join-Path $root "native\docking-reference\scoring\include"
$nativeScorer = Join-Path $root "native\docking-reference\scoring\src\scoring.cpp"
$zeroProofSource = Join-Path $PSScriptRoot "sparse_zero_proof.cpp"
$resourceSource = Join-Path $PSScriptRoot "resource_model.cpp"

if (-not (Test-Path -LiteralPath $ZigExe -PathType Leaf)) {
  throw "Zig executable not found: $ZigExe"
}
if (-not (Test-Path -LiteralPath $nativeScorer -PathType Leaf)) {
  throw "D3-TOR-01 direct scorer source not found: $nativeScorer"
}
$expectedScorerCommit = "f0bd2eaf47b02faab4dea694e7c2677094969076"
$scorerCommit = (& git -C $root rev-parse HEAD).Trim()
if ($scorerCommit -ne $expectedScorerCommit) {
  throw "Expected the preserved D3-TOR-01 commit $expectedScorerCommit; found $scorerCommit."
}
$scorerWorktreeChanges = (& git -C $root status --porcelain --untracked-files=all -- "native/docking-reference/scoring")
if (-not [string]::IsNullOrWhiteSpace(($scorerWorktreeChanges -join ""))) {
  throw "The preserved native scoring directory has local changes; refusing to use it as the proof oracle."
}
$zigVersion = (& $ZigExe version).Trim()
$zigHash = (Get-FileHash -LiteralPath $ZigExe -Algorithm SHA256).Hash.ToLowerInvariant()
$expectedZigVersion = "0.16.0"
$expectedZigHash = "086ce9d47ba42f33a514e1a6e04eb1d4a8fa1d75e0868e0213caad447c91e864"
$expectedPackageSha256 = "68659eb5f1e4eb1437a722f1dd889c5a322c9954607f5edcf337bc3684a75a7e"
if ($zigVersion -ne $expectedZigVersion -or $zigHash -ne $expectedZigHash) {
  throw "Expected verified Zig $expectedZigVersion executable SHA-256 $expectedZigHash."
}
if ($PackageSha256.ToLowerInvariant() -ne $expectedPackageSha256) {
  throw "Expected verified portable package SHA-256 $expectedPackageSha256."
}

New-Item -ItemType Directory -Path $evidence -Force | Out-Null
$zeroExe = Join-Path $env:TEMP "d3-sci04-zero-proof.exe"
$resourceExe = Join-Path $env:TEMP "d3-sci04-resource-model.exe"
$zeroOutput = Join-Path $evidence "direct-scorer-proof.json"
$resourceOutput = Join-Path $evidence "resource-model.json"

$commonFlags = @(
  "-target", "x86_64-windows-gnu",
  "-std=c++20",
  "-Wall", "-Wextra", "-Wpedantic", "-Werror",
  "-ffp-contract=off", "-fno-fast-math"
)

& $ZigExe c++ @commonFlags "-I" $nativeInclude $nativeScorer $zeroProofSource "-o" $zeroExe
if ($LASTEXITCODE -ne 0) { throw "Direct-scorer sparse-zero proof compilation failed with exit code $LASTEXITCODE." }

& $zeroExe $zeroOutput
if ($LASTEXITCODE -ne 0) { throw "Direct-scorer sparse-zero proof failed with exit code $LASTEXITCODE." }

& $ZigExe c++ @commonFlags "-O2" $resourceSource "-lpsapi" "-o" $resourceExe
if ($LASTEXITCODE -ne 0) { throw "C++ full-size resource model compilation failed with exit code $LASTEXITCODE." }

& $resourceExe $resourceOutput
if ($LASTEXITCODE -ne 0) { throw "C++ full-size resource model failed with exit code $LASTEXITCODE." }

node (Join-Path $PSScriptRoot "channel-map.mjs")
if ($LASTEXITCODE -ne 0) { throw "Channel map fixture generation failed with exit code $LASTEXITCODE." }

$packageLock = Get-Content -LiteralPath (Join-Path $root "package-lock.json") -Raw | ConvertFrom-Json -AsHashtable
$vitestVersion = $packageLock.packages['node_modules/vitest'].version
if ([string]::IsNullOrWhiteSpace($vitestVersion)) { throw "The package lock has no Vitest version." }
$vitestPackage = "vitest@" + $vitestVersion
npm exec --yes "--package=$vitestPackage" -- vitest run verification/d3-sci04/sparse-contract.test.ts
if ($LASTEXITCODE -ne 0) { throw "TypeScript serialization/digest conformance suite failed with exit code $LASTEXITCODE." }

$scorerSourceSha256 = (Get-FileHash -LiteralPath $nativeScorer -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{
  stage = "D3-SCI-04"
  harness_scope = "test-only; no production scoring-field implementation"
  d3_tor_commit = $scorerCommit
  direct_scorer_source_sha256 = $scorerSourceSha256
  compiler = "Zig C++"
  compiler_version = $zigVersion
  compiler_executable_sha256 = $zigHash
  compiler_package_sha256 = $PackageSha256.ToLowerInvariant()
  test_runner = "Vitest"
  test_runner_version = $vitestVersion
  target = "x86_64-windows-gnu"
  floating_point_flags = @("-ffp-contract=off", "-fno-fast-math")
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $evidence "run-manifest.json") -Encoding UTF8

Write-Host "D3-SCI-04 native evidence written to $evidence"
