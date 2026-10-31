# Almas visual redesign — 2026-10-31

## Direction

The user supplied eleven Abwaab screenshots and requested a similar visual experience, keeping منصة الماس and a two-cube educational logo. Implement the requested direction directly, using the existing offline prototype. The user's continuing instruction is to finish a complete stage and run it for review.

Use a white header, spacious blue hero, amber calls to action, pale blue surfaces, colorful subject cards, an illustrated learning scene, a features section and FAQ. Carry the identity into all four role dashboards, navigation, forms, tables and media pages. The mark uses two distinct isometric cubes in sapphire and teal with amber highlights. All vector art is original inline SVG; no reference photos, logos, teacher identities, endorsements or unsupported performance claims are reused.

## Implementation plan

- [x] Replace visual tokens and responsive primitives in `prototype/index.html`; retain dark mode, visible focus and reduced-motion support.
- [x] Add the original inline cube mark, favicon and educational illustrations, landing page, real navigation links, FAQ and account presentation. Keep existing demo entry actions and labels.
- [x] Restyle the four dashboards and learner catalogues with data from `MockRepository`. Keep all CRUD, video, exam and parent scope behavior intact.
- [x] Check landing actions, phone widths, two themes and the full existing regression suite; inspect desktop screenshots and responsive layouts.
- [x] Document verification and prepare the running preview for review. GitHub CI and PR status are linked in the pull request.

## Constraints and review focus

One self-contained offline HTML file, no framework/backend/external requests, no schema or authentication changes. Existing repository boundary markers and public methods stay intact. Existing aliases, saved roles, theme and student progress persist. Teacher/admin tables scroll inside their container and status badges never wrap. Decorative SVG is hidden from assistive technology; functional controls have accessible names and at least 44px targets. Landing content accurately describes the local demonstration.

## Design tokens and components

Sapphire primary `#2448b8`, deep blue `#163080`, teal `#007b78`, amber `#ffcf43`; foreground `#172b4d`, muted `#53647d`, canvas `#f5f8ff`, white surfaces, input border `#7d8fae`. Dark variants use navy surfaces, light text and light-blue links. Spacing uses a 4/8px base, radii 12/20/28px, layout max 1200px, public hero and catalogue breakpoints at 1000/720/480px. System Segoe UI/Tahoma keeps the page offline without a font download.

Buttons: primary sapphire/white, secondary surface/blue, hero CTA amber/navy. Cards: subject-specific decorative SVG and badges; neutral cards for communication/results. Forms keep real labels, native input semantics and validation. FAQ uses native `details/summary`, supports touch and keyboard without custom state. Sidebar uses icon plus text, clear current-page styling; horizontal navigation on mobile retains every route.

## Verification

Local Windows run: `npm test` — **20 unit tests passed; 167 browser tests passed, 1 skipped, 0 failures** (168 scheduled browser cases, 9.8 minutes). The skipped native-video case is the existing Windows WebKit codec limitation; fullscreen and simulated video paths passed. Chromium, Firefox and WebKit passed the public pages' keyboard/FAQ/discovery/registration tests and automated WCAG AA checks. Role-route audits plus the public entry audits cover 300 page/theme/engine combinations; these automated audits are not a complete accessibility certification.

Responsive projects at 360, 768 and 1366px passed every role route, public entry pages in both themes, status-word line measurements and visible public navigation hit targets. An independent read-only review found one small touch-target gap; public landing anchors now have a 44px minimum height. The 34 foreground/background/input/focus token pairs in [design-tokens.json](design-tokens.json) passed WCAG contrast thresholds (4.5:1 body, 3:1 UI). System Python aliases were unavailable; the same standard sRGB luminance calculation was executed with Node for this check. The app itself loads no design-token file or external dependency. Focus rings on blue banners use amber, so they remain visible against the darkest and lightest blue surfaces.

The repository implementation between the existing boundary markers is byte-identical to the preceding version. No storage schema, student links, saved progress or attempt rules changed. All original artwork is inline; the reusable symbol is also provided as [assets/almas-mark.svg](assets/almas-mark.svg).

Preview: `npm start` at `http://127.0.0.1:4173/`. The already-authorized temporary Wi-Fi preview serves only this HTML at `http://192.168.0.102:4174/`. Returning users keep their saved role/route; select **البداية** to inspect the new public page. This redesign has no new physical-device acceptance claim until the user reviews it on Android.

After the final banner focus-color refinement, the public-page and responsive subset passed again: **19 tests, 0 failures**. The pull request links CI for the final committed source.

Final HTML SHA-256: `26AEFC61899CFDCEA4DE899268309324957DF047506945D0CAD83A2100694472`.
