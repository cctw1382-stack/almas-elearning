$ErrorActionPreference = 'Stop'
$issuer = 'http://127.0.0.1:8180/realms/almas-local'
$metadata = Invoke-RestMethod -NoProxy "$issuer/.well-known/openid-configuration"
if ($metadata.issuer -ne $issuer -or $metadata.code_challenge_methods_supported -notcontains 'S256') {
    throw 'Unexpected OIDC issuer or PKCE support.'
}

$callback = [uri]::EscapeDataString('http://127.0.0.1:4174/auth/callback')
$wrongCallback = [uri]::EscapeDataString('http://127.0.0.1:4174/unregistered')
$challenge = 'A' * 43
$auth = "$issuer/protocol/openid-connect/auth?client_id=almas-web-local&response_type=code&scope=openid&state=smoke"
$pkce = "&code_challenge=$challenge&code_challenge_method=S256"
$accepted = Invoke-WebRequest -NoProxy "$auth&redirect_uri=$callback$pkce" -SkipHttpErrorCheck
$invalid = Invoke-WebRequest -NoProxy "$auth&redirect_uri=$wrongCallback$pkce" -SkipHttpErrorCheck
if ($accepted.StatusCode -ne 200 -or $accepted.Content -notmatch 'login-actions/authenticate' -or $invalid.StatusCode -ne 400) {
    throw 'Login page or callback allowlist check failed.'
}

# Do not follow the rejection redirect into the future application callback.
$rejection = curl.exe --noproxy '*' -sS -o NUL -w '%{http_code} %{redirect_url}' "$auth&redirect_uri=$callback"
if ($LASTEXITCODE -ne 0 -or $rejection -notmatch '^302 http://127\.0\.0\.1:4174/auth/callback\?error=invalid_request&error_description=Missing') {
    throw 'Expected an invalid request response for missing PKCE.'
}
Write-Output 'Verified issuer, login screen, callback allowlist, and required PKCE.'
