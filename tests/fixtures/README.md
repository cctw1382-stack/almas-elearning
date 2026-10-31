`lesson.webm` is an eight-second, silent VP8 video generated for the native HTML5
media test. It contains a moving FFmpeg test pattern and no external media.

Regenerate with FFmpeg:

```sh
ffmpeg -f lavfi -i "testsrc2=size=160x90:rate=10" -t 8 -an -c:v libvpx -b:v 50k -deadline realtime -y tests/fixtures/lesson.webm
```

The media test uses `loadedmetadata`, actual `video.play()`, and native seeking.
The independent lesson simulation and role-isolation cases run in every
configured browser.

Windows WebKit's native decoder is unavailable on the verification host:
`canPlayType` reports `probably`, while a standalone `<video>` emits error 4
and `play()` rejects with `NotSupportedError`. This was reproduced with both
VP8 WebM and H264 MP4, using file and Blob sources without product handlers.
The test therefore probes the WebM fixture in a separate minimal page before
opening the product, and skips the native case **only** for Windows WebKit when
that independent probe reports error 4 or `NotSupportedError`. Its JSON result
and exact limitation appear in the report. Other probe errors and application
failures remain failures. Linux CI and the other engines still execute the
full native playback test; the Windows skip must not be reported as a pass.

All E2E tests open the local `file://` prototype in isolated browser contexts.
HTTP(S) requests are intercepted and aborted; any attempted external request or
browser runtime error fails the test.

Chromium and Firefox use browser offline emulation as an additional
restriction. WebKit uses `offline: false` on **all platforms** because enabling
that emulation causes internal navigation errors for local `file://` pages on
both Windows and Linux. Windows controls reproduced the issue with the shipped
prototype, a byte-identical ASCII-path copy, and minimal HTML. After pinning
the CI runner to Ubuntu 24, [run 41197083464](https://github.com/cctw1382-stack/almas-elearning/actions/runs/41197083464)
passed 18 unit tests and 86 browser cases but failed all 37 WebKit cases during
local-file navigation before application startup, confirming the Linux scope.

WebKit therefore retains the same strict HTTP(S) interception without the
offline-emulation flag. Every attempted HTTP(S) request is aborted and fails
the test. Each affected test includes an environment annotation in the
Playwright report. No page, assertion, or test is skipped for this navigation
workaround, and the original shipped file is tested. This change is separate
from the **Windows-only** native-decoder capability skip described above;
Linux still runs the native playback assertions. Current CI results must be
read from the branch Actions page or PR, not inferred from the earlier run.
