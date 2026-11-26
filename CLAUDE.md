# Pixels Worlds — instructions for Claude Code

You are helping Archibald build and run **Pixels Worlds** (a cosy pixel-art 2.5D mobile MMORPG) as a
**native iOS app on his Mac**, using Capacitor. The game itself is finished HTML5 in `client/`; your job
is the native wrapper, the step counter plugin, and getting it running on the iOS Simulator and on his iPhone.
Talk to him in French, keep explanations short, and ask before anything that costs money or changes his Apple account.

## Project map
- `client/` — the game (web). This folder is the Capacitor `webDir`. Do not restructure it.
  - `content.js` — game content as plain data (monsters, items, loot, weapons and techniques, crafting, NPCs and quests, islands,
    dungeons). `core.js` is the engine (world generation + authoritative simulation); it reads `content.js` and re-exports it (`C.ITEMS`…).
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
- Native writes are asynchronous and the native copy wins at startup: before any `location.reload()` (island travel), save then
  `await window.EtheriaPersist.flush()` (with a timeout), or the app could restart on an older save.
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
- Characters are hand-placed pixel art in the style of Realms of Pixel (validated by Archibald): `client/sprites.js` holds
  hand-drawn grids per direction (front / back / side, side-left = mirror) and per layer (hair styles, face, tunic, plate +
  pauldrons, legs, boots, hood / helm / crown, creation hats, sword / axe / staff / bow, cape for rare+ chest pieces).
  Digits 1–5 in a grid are tones of that layer's material, recoloured from the item colour (`ramp5`, `metal`); letters are
  fixed colours (skin, eyes, hair a–f, gold g/G/y/Y, leather, wood). Sprites are 58×57 (side margin for weapon swings), ~2.2 heads,
  feet at y = 55, centre x = 28.5. Walk cycle: 8 frames (`W8` in `sprites.js`: leg lift 1-2-1, arm and weapon sway; 1 sprite-pixel bob at the passing frames). Attack poses (`paint(..., pose)` 1 = wind-up, 2 = strike, 3 = recover, `set.atk`, timings `ATK_T`/`ATK_STRIKE`/`ATK_RECOVER`) rotate the weapon around the hand
  with RotSprite (Scale2x ×2, nearest rotation, resample) — keeps blades clean; angles in `SWING` / `SWING_SIDE`. `e.atkT` drives them in `game.js`.
  `sprites.js` has no DOM dependency (paints into an RGBA array), so it can be tested in Node; `assets.js` `charSet` caches canvases.
- In the world a character pixel is always 3 screen pixels (`charP()` in `game.js`), whatever the camera distance, so the hero stays readable.
  Don't scale sprites by non-integer screen factors. Draw new gear in the grids pixel by pixel; never go back to vector-then-downsample.
- No classes: the equipped weapon's family (`FAMS` in `core.js`: sword, great, dagger, bow, staff, spear) gives the basic attack and
  techniques, unlocked by per-family mastery (`p.mast`, gained in combat). `kitOf(equip, mast, bar)` = basic attack + the 3 bar slots.
  Stats come from points (`p.pts`, 3 per level, reset at Elya). The old `cls` save field now means "starting weapon" (`START`).
  Shield = `offhand` slot, only with a 1H sword and sword mastery ≥ 5; block at mastery 8.
  Mages can hold a grimoire (`icon: 'tome'`, staff family): book in one hand, floating ether orb by the other (`orbAt` in `sprites.js`).
- Bestiary (`docs/design/bestiaire.md`): 19 monster types in `MOBDEF` (element `el`, hp/atk/spd multipliers, `sc` size); element traits
  (fire burns the hero, ice slows, wood regenerates, light takes less damage, dark drains); art in `assets.js` `bestiary()`.
  Home-island variants are picked by `hash()` after spawning (no extra `rnd()` calls). Loot is rare (`LOOT`, ≈ 3 %).
- Hero level max 50 (`MAX_LVL`), XP per level `14 × L^2.5` (≈ 60 h+ to level 50; don't make it faster).
- Skill ranks (`docs/design/competences.md`): each technique gains XP when useful (`addSk`), ranks 1–10, cap = 1 + level / 5,
  +5 % power / −3 % cooldown per rank, and Intelligence cuts cooldowns by int / (int + 150), max −40 % (`techCd`); at ranks 4 and 8 the player picks one of two effects (`MS` table, `p.skc`, generic
  modifiers applied in `kitOf` and the `ab` handler); Elya resets the choices. Save fields `sk`, `skc`.
- Game Master set (items 33–38, `fx: 'gm'`, unique, never in loot, can't be sold): golden armor drawn in `sprites.js`
  (`F.gm`, `gmhelm`, white cape), gold name and aura in game. `Sim.grantGM(p)` equips it once; granted to the artifact owner
  (`Cloud.owner`), to the hero Archi404 in the app when `config.js` has `gm: true`, and on the server to device tokens in `GM_TOKENS`.
  The Game Master plays a mage: the grant equips the golden Sceptre (item 39), puts blade and aegis in the bag and, once (gift bit 2),
  sets staff mastery to the sword's level and moves stat points to Intelligence.
- `C.gearStr(equip)` encodes head/chest/legs/feet/weapon/offhand; it is sent as the 16th field of each player in `publicState`, so other players see your gear. New items need an `icon` the painter knows (hood/helm/crown, tunic/plate, pants, boots, sword/axe/staff/bow).

## Islands and bridges
- `docs/design/voyage-entre-les-iles.md`. The world is one island at a time: `game.js` reads the island from the save (`isle`)
  before `C.buildWorld(C.SEED, isle)`. Crossing a bridge = `cross` message → `travel` event → save, mist fade, `location.reload()`,
  auto-continue (`sessionStorage.etheria_autoplay`). The home island's generation must stay identical (its bridge is added last).
- Ether bridge (3 Éther, random: 90 % fixed island `givre`/`braise`, 10 % ephemeral `brume` with a seed and a chest), home bridge
  back to the fountain. Island monsters take the arriving hero's level. Island effects (`slow`, `burn`) skip monsters of the same element (`MOBDEF.el`).
- Islands are dangerous: PvP (`Sim.pvp`, attack messages take `p: playerId`), and dying drops the bag (not equipped or unique items)
  on a corpse lootable by anyone for 3 min (`die`, `corpses`, `loot`). Online, the server runs one `Sim` per island (`isles` map,
  ephemeral ones freed when empty); `welcome` carries the island and the client reloads onto it if needed (`etheria_isle_force`).

## Dungeons
- `docs/design/donjons.md`. Entrance `W.gate` at the centre of each Ether-bridge island (`buildIsle`); its rarity (`DG`, item colours) is rolled per arrival
  (`Sim.dg`, from the save in solo: `opts.dg`). Entering = travel to isle `{ k: 'donjon', s, r, b, f }` (`buildDungeon`: maze of n×n rooms, 2-tile corridors,
  boss in the farthest 2×2 room, elites in far dead ends, spike traps, torches, crystals). Exit portal at the start, victory portal after the boss.
- Save fields `dg`, `ttl`, `tt`; `arr: 2` respawns in front of the gate. Dungeon mobs never respawn; death respawns at the dungeon start.
- Rendering: walls are terrain height 3 (`DG_STONE` per rarity), walls in front of the hero are drawn translucent, darkness is a cached dithered radial canvas.

## Rendering & smoothness
- The world canvas is drawn at `RQ` sub-pixels per game pixel (starts at the full screen scale `S`) so the camera and moving
  characters glide at screen-pixel precision; static art stays on the game-pixel grid. `adaptQuality()` halves `RQ` if the
  average frame time exceeds 20 ms (full → half → 1). Tapping the minimap shows `fps` and `Q<RQ>`.
- Camera distance: `ZOOM` (0 close, 1 normal = default, 2 far; `localStorage.etheria_zoom`, magnifier button / mouse wheel)
  lowers the integer screen scale `S` by one step per level, so the world stays pixel-sharp.
- Interface size: HUD canvas scale `SU = round(pm / 279)` and `.card { zoom: .7 }` for the HTML panels (30 % smaller than the original).
- Monsters and other players arrive at 10 Hz: they move at constant speed between two received states (`fx/fy → tx/ty` over `snapDt`),
  never with exponential catch-up (that looked jerky). Hits show a short white flash (`whiteOf`), not a blink; screen shake is gentle and only on big hits.
- Avoid full-screen per-frame effects (composite modes, scaled smoothed draws): cache them per screen size (see `OVERLAY`).
- Measure before/after with a CPU-throttled headless run; headless rAF timestamps snap to 16.7 ms, so judge movement by time, not per frame.

## Rules
- Player progress must survive updates: never rename or remove fields of `saveData()` in `client/core.js`; new fields need a default in `addPlayer`.
- After any change in `client/`, run `npx cap sync ios` before rebuilding.
- Load order in `index.html` matters: `content.js` before `core.js`; `persist.js` must stay last; it loads `game.js` itself.
- Don't edit generated files under `ios/App/App/public/` — they are overwritten by sync.
- Keep the game in French. `client/content.js` and `client/core.js` are shared by client and server (the server requires them from `client/`).
- Never commit or print signing certificates, Apple credentials or tokens.
