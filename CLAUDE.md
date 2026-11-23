# Etheria Online — instructions for Claude Code

You are helping Archibald build and run **Etheria Online** (a cosy pixel-art 2.5D mobile MMORPG) as a
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
- `capacitor.config.json` — appId `com.etheria.online`, appName `Etheria Online`.

## Goal 1 — run the app in the iOS Simulator
1. Check prerequisites and report what is missing (don't install Xcode yourself; tell him to get it from the Mac App Store):
   - `xcode-select -p` and `xcodebuild -version` (Xcode 16+), `node -v` (18+), `ruby -v`.
   - If `xcode-select` points to CommandLineTools, ask him to run `sudo xcode-select -s /Applications/Xcode.app` and accept the license (`sudo xcodebuild -license accept`).
2. From the project root:
   ```bash
   npm install
   npx cap add ios            # creates ios/ (skip if it already exists)
   npx capacitor-assets generate --ios
   ```
3. Add the native step-counter plugin:
   ```bash
   gem list xcodeproj -i || gem install xcodeproj --user-install
   ruby tools/add_ios_files.rb
   ```
   Then make the app use `MainViewController`: in `ios/App/App/Base.lproj/Main.storyboard`, change the bridge view
   controller's `customClass="CAPBridgeViewController" customModule="Capacitor"` to
   `customClass="MainViewController" customModule="App" customModuleProvider="target"`.
4. Info.plist (`ios/App/App/Info.plist`):
   - add `NSMotionUsageDescription` = `Etheria transforme tes pas en Éther pour la cueillette dans le jeu.`
   - restrict `UISupportedInterfaceOrientations` (and the `~ipad` variant) to `UIInterfaceOrientationPortrait`.
   Use `/usr/libexec/PlistBuddy` or edit the XML directly.
5. `npx cap sync ios`
6. Build and launch on a simulator. Prefer the CLI:
   ```bash
   npx cap run ios --list            # pick an iPhone simulator id
   npx cap run ios --target <id>
   ```
   If that fails, use xcodebuild (`-workspace ios/App/App.xcworkspace` if it exists, otherwise `-project ios/App/App.xcodeproj`,
   `-scheme App -destination 'platform=iOS Simulator,name=<iPhone model>'`), then `xcrun simctl install/launch`.
   Note: the Simulator has no step counter — the walking panel will say steps can't be read. That's expected.
7. Archibald's alpha progress (hero **Archi404**, level 8 Guerrier, founder set with the Unique Bottes du Néant) is preloaded by `client/seed-save.js`: it is used once, on first launch, when the device has no save yet. Keep that file and keep `founder: false` (the gift is already in the save). The multiplayer server imports the same hero once from `server/seed-saves.json` when he first joins with the name Archi404.
8. Fix any build error you hit, then tell him in one or two sentences what he should see (title screen → hero creation → the island).

## Goal 2 — run it on his iPhone (free, no paid account needed for personal testing)
1. Ask him to plug in the iPhone, unlock it, trust the Mac, and enable Developer Mode (Settings → Privacy & Security).
2. Signing: open `ios/App/App.xcodeproj` (or `.xcworkspace`) with `npx cap open ios`, then guide him to
   Signing & Capabilities → Team → his Apple ID (Personal Team). Change the bundle id if Xcode says it's taken
   (e.g. `com.<hisname>.etheria`) — also update `appId` in `capacitor.config.json` to match.
3. Run on the device (`npx cap run ios --target <device id>` or the ▶ button in Xcode).
4. On the phone: Settings → General → VPN & Device Management → trust the developer certificate.
5. Real steps work on the device: open the in-game blue Ether icon → "Synchroniser mes pas" (iOS asks for Motion & Fitness permission).
   With a free Personal Team the app expires after 7 days; just run it again.

## Goal 3 (later, only if he asks) — multiplayer & TestFlight
- Multiplayer needs the server online (see README.md: Fly.io). Then set `client/config.js` to
  `window.ETHERIA_CONFIG = { server: 'wss://<app>.fly.dev/ws' };` and `npx cap sync ios`.
- TestFlight needs the paid Apple Developer Program (99 $/year). Steps are in README.md section 3.

## Rules
- Player progress must survive updates: never rename or remove fields of `saveData()` in `client/core.js`; new fields need a default in `addPlayer`.
- After any change in `client/`, run `npx cap sync ios` before rebuilding.
- Don't edit generated files under `ios/App/App/public/` — they are overwritten by sync.
- Keep the game in French. Keep `client/core.js` identical between client and server (the server requires it).
- Never commit or print signing certificates, Apple credentials or tokens.
