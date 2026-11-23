# Pixels Worlds — instructions for Claude Code

You are helping Archibald build and run **Pixels Worlds** (a cosy pixel-art 2.5D mobile MMORPG) as a
**native iOS app on his Mac**, using Capacitor. The game itself is finished HTML5 in `client/`; your job
is the native wrapper, the step counter plugin, and getting it running on the iOS Simulator and on his iPhone.
Talk to him in French, keep explanations short, and ask before anything that costs money or changes his Apple account.

## Project map
- `client/` — the game (web). This folder is the Capacitor `webDir`. Do not restructure it.
  - `config.js` — server address. `'auto'` falls back to **solo mode** inside the app (good for a first local build).
  - `steps.js` — reads real steps through the native `Pedometer` plugin when running in the iOS app.
- `ios-plugin/` — native Swift: `PedometerPlugin.swift` (CoreMotion step counter) and `MainViewController.swift` (registers it).
- `tools/add_ios_files.rb` — copies those Swift files into the Xcode project and adds them to the App target.
- `server/` — optional multiplayer server (Node + ws). Not needed for a solo local build.
- `assets/` — 1024px icon + splash used by `@capacitor/assets`.
- `capacitor.config.json` — appId `com.pixelsworlds.app`, appName `Pixels Worlds`.

## Goal 1 — run the app in the iOS Simulator
The Xcode project in `ios/` is already generated and configured (committed): `MainViewController` registers the
Pedometer plugin, Info.plist has `NSMotionUsageDescription`, portrait only, iPhone only, `ITSAppUsesNonExemptEncryption = NO`,
and `@capacitor/preferences` is linked through Swift Package Manager (`ios/App/CapApp-SPM`). Don't run `npx cap add ios` again.
1. Check prerequisites and report what is missing (don't install Xcode yourself; tell him to get it from the Mac App Store):
   `xcodebuild -version` (Xcode 26+, required by Capacitor 8), `node -v` (22+). If `xcode-select -p` points to CommandLineTools,
   ask him to run `sudo xcode-select -s /Applications/Xcode.app` and `sudo xcodebuild -license accept`.
2. From the project root: `npm install && npx cap sync ios`
3. `npx cap run ios --list`, then `npx cap run ios --target <simulator id>`. Fallback: `xcodebuild -project ios/App/App.xcodeproj
   -scheme App -destination 'platform=iOS Simulator,name=<iPhone model>'`, then `xcrun simctl install/launch`.
   The Simulator has no step counter — the walking panel will say steps can't be read. That's expected.
4. Archibald's alpha progress (hero **Archi404**, level 8 Guerrier) is preloaded by `client/seed-save.js` on first launch only,
   when the device has no save yet. Keep that file and keep `founder: false`.
5. If the native files ever need regenerating (e.g. `ios/` deleted): `npx cap add ios`, `npx capacitor-assets generate --ios`,
   `ruby tools/add_ios_files.rb`, then redo the storyboard (`customClass="MainViewController" customModule="App"
   customModuleProvider="target"`) and Info.plist edits listed above.

## Saves (progress must never be lost)
- The game was renamed from "Etheria Online" to **Pixels Worlds**. Internal names (`etheria_*` storage keys, `EtheriaCore`, `EtheriaArt`, `ETHERIA_CONFIG`) were kept on purpose: renaming the storage keys would orphan existing saves. The in-game resource "Éther" is a game mechanic, not the old name.
- The game saves every 5 s and when the app goes to the background, into localStorage keys `etheria_*`.
- In the native app, `client/persist.js` mirrors every `etheria_*` key to native Preferences (UserDefaults, included in
  iCloud/Finder backups) and restores them before `game.js` starts. That's what survives iOS purging WebView storage.
- Data survives app updates (Xcode re-runs, TestFlight, App Store) as long as the bundle id (`appId`) is unchanged.
  Changing the bundle id = a different app = empty save (the seed would load again). Deleting the app deletes the save.

## Goal 2 — run it on his iPhone (free, no paid account needed for personal testing)
1. Ask him to plug in the iPhone, unlock it, trust the Mac, and enable Developer Mode (Settings → Privacy & Security).
2. Signing: open `ios/App/App.xcodeproj` (or `.xcworkspace`) with `npx cap open ios`, then guide him to
   Signing & Capabilities → Team → his Apple ID (Personal Team). Change the bundle id if Xcode says it's taken
   (e.g. `com.<hisname>.pixelsworlds`) — also update `appId` in `capacitor.config.json` to match.
3. Run on the device (`npx cap run ios --target <device id>` or the ▶ button in Xcode).
4. On the phone: Settings → General → VPN & Device Management → trust the developer certificate.
5. Real steps work on the device: open the in-game blue Ether icon → "Synchroniser mes pas" (iOS asks for Motion & Fitness permission).
   With a free Personal Team the app expires after 7 days; just run it again.

## Goal 3 — TestFlight without a Mac (GitHub Actions)
`.github/workflows/ios.yml` builds for the Simulator on every push, and uploads a signed build to TestFlight when run
by hand (or on every push if the repo variable `TESTFLIGHT_ON_PUSH` = `true`). Needs the paid Apple Developer Program,
an App Store Connect app record with the same bundle id, and the 4 secrets listed at the top of the workflow.

## Goal 4 (later, only if he asks) — multiplayer
- Multiplayer needs the server online (see README.md: Fly.io). Then set `client/config.js` to
  `window.ETHERIA_CONFIG = { server: 'wss://<app>.fly.dev/ws' };` and `npx cap sync ios`.

## Art & visible gear
- Art direction « aquarelle 16 bits »: old-school Zelda readability (clean tiles, clear silhouettes, plum-tinted outlines) + Gris-like harmonised pastel palettes with hue-shifted shadows (violet/teal) and cream lights + chibi heroes with visible gear. Each zone owns a colour, baked at paint time (grass tint, per-zone foliage sets `oak_2`/`oak_3`…) plus a cached per-zone grade that crossfades (`ZONE_LOOK`, `zoneGrade`): bourg warm dawn, prairies gold-jade, bois blue-violet mist + light shafts + fireflies, terres sauvages ember. UI: ink-indigo panels, thin cream borders, gold accents. All art is procedural in `client/assets.js`; atmosphere in `client/game.js`.
- Equipped gear is painted onto the character sprite (`paintChibi(look, dir, frame, blink, gear)`); sprites are 24×31 with the body offset by `CHAR_OX/CHAR_OY` = 4.
- `C.gearStr(equip)` encodes head/chest/legs/feet/weapon; it is sent as the 16th field of each player in `publicState`, so other players see your gear. New items need an `icon` the painter knows (hood/helm/crown, tunic/plate, pants, boots, sword/axe/staff/bow).

## Rendering & smoothness
- The world canvas is drawn at `RQ` sub-pixels per game pixel (starts at the full screen scale `S`) so the camera and moving
  characters glide at screen-pixel precision; static art stays on the game-pixel grid. `adaptQuality()` halves `RQ` if the
  average frame time exceeds 20 ms (full → half → 1). Tapping the minimap shows `fps` and `Q<RQ>`.
- Avoid full-screen per-frame effects (composite modes, scaled smoothed draws): cache them per screen size (see `OVERLAY`).
- Measure before/after with a CPU-throttled headless run; headless rAF timestamps snap to 16.7 ms, so judge movement by time, not per frame.

## Rules
- Player progress must survive updates: never rename or remove fields of `saveData()` in `client/core.js`; new fields need a default in `addPlayer`.
- After any change in `client/`, run `npx cap sync ios` before rebuilding.
- Load order in `index.html` matters: `persist.js` must stay last; it loads `game.js` itself.
- Don't edit generated files under `ios/App/App/public/` — they are overwritten by sync.
- Keep the game in French. Keep `client/core.js` identical between client and server (the server requires it).
- Never commit or print signing certificates, Apple credentials or tokens.
