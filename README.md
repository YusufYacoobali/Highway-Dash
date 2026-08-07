# Highway Dash

An endless traffic runner for iOS and Android — weave through highway traffic, chain
near-misses to build heat, and get out before the cops box you in.

Built with Expo SDK 54, React Native 0.81, TypeScript and three.js. The gameplay is a real
3D scene rendered through `expo-gl`, using the low-poly glTF car pack in `assets/models/`.

---

## Running it

```bash
npm install
```

```bash
npm start
```

Scan the QR code with **Expo Go** (SDK 54). Every native module the game uses — `expo-gl`,
`expo-notifications`, `expo-store-review`, `expo-haptics`, `react-native-svg`,
`react-native-safe-area-context`, `async-storage` — ships inside Expo Go, and every
installed version matches Expo Go's bundled version exactly, so no custom build is needed
to play.

Two things behave differently in Expo Go, neither affecting gameplay:

- **Config plugins do not apply.** The splash screen and the notification icon/colour from
  `app.json` only take effect in a real build; Expo Go shows its own splash. The Android
  notification channel is created in code, so reminders still work.
- **Local notifications only.** Expo Go on Android dropped remote push in SDK 53. This game
  only schedules local notifications, so it is unaffected — but the CLI may still print a
  push-related warning on startup.

For a standalone build with the real splash, icon and notification styling:

```bash
npm run native:ios
```

```bash
npm run native:android
```

Useful checks:

```bash
npm run typecheck
```

```bash
npx expo-doctor
```

---

## How it is put together

```
src/
  core/        framework-free helpers (math, pooling, typed emitter)
  domain/      pure game rules — cars, upgrades, missions, season, economy, tuning
  engine/      the 3D simulation: systems, world builders, vehicle providers
  game/        React ↔ WebGL boundary and the HUD telemetry mirror
  features/    one folder per screen
  services/    engagement, feedback, commerce, storage — all behind interfaces
  state/       zustand stores (persisted profile, navigation, run session)
  ui/          theme tokens and shared components
  shell/       composition root: fonts, splash, lifecycle, screen routing
```

The dependency arrows only point inwards: `domain` imports nothing, `engine` imports
`domain` and `core`, `features` import `ui` and `domain`, and only `shell/GameStage.tsx`
knows about both the engine and the stores. That is what lets the whole rules layer be
exercised without a renderer.

### The simulation

`GameEngine` is a composition root, not a god object — it owns the three.js scene and
ticks a list of `GameSystem`s, but holds no gameplay rules itself:

| System | Responsibility |
| --- | --- |
| `PlayerSystem` | continuous-axis steering, body tilt, attract-mode weave |
| `WorldScrollSystem` | recycles road dashes, barriers and trees through `ScrollBand`s |
| `TrafficSystem` | spawn cadence, driving, pooling; reports overtakes and impacts |
| `PickupSystem` | coin runs and magnet collection |
| `ScoreSystem` | combo window and near-miss payouts |
| `HeatSystem` | the wanted meter, its cooldown, and the bust condition |
| `CameraSystem` | chase framing, speed-driven FOV, nitro pull-back, shake |
| `CrashSequence` | the slow-motion tumble (runs *instead of* the systems above) |

Traffic and coins are recycled through `ObjectPool`, and the scenery never spawns — a
fixed set of objects wraps by exactly one period, so draw calls stay constant for the
whole run.

### Draw calls are the budget

Every GL command crosses the expo-gl bridge, so the scene is built around keeping the
per-frame draw call count low — around 200, against roughly 2,000 in the first cut, which
was enough to stall the display entirely. The rules that keep it there:

- **No real-time shadows.** A shadow pass re-renders every casting object, doubling the
  frame outright. Each vehicle carries one flat blob shadow instead.
- **No MSAA.** Costly on mobile fill rate, invisible at this art scale.
- **Static scenery is merged.** The skyline and clouds never move, so they are baked into
  one geometry per colour at start-up.
- **Procedural car bodies merge by material**, turning a twenty-mesh car into six or seven.
- **The attract loop runs sparser than gameplay** — menu traffic is long-lived, so a
  gameplay spawn cadence would leave forty cars parked behind the title.

### The expo-gl framebuffer rebind

`RendererHandle.beginFrame()` issues `gl.bindFramebuffer(gl.FRAMEBUFFER, null)` before every
frame, and it is **load-bearing** — without it the scene renders exactly one frame and then
appears frozen while the simulation keeps running.

three.js caches which framebuffer is bound and skips the GL call when it thinks nothing
changed. `gl.endFrameEXP()` presents by rebinding on expo-gl's side, which three never
observes, so from frame two onwards three draws into a target that is no longer being
displayed.

The rebind deliberately goes straight to the context instead of through
`renderer.resetState()`. Binding null outside three keeps its cache accurate — null really
is bound again — and disturbs nothing else. Routing it through `resetState()` also clears
the depth-test, VAO and texture state, which drops depth testing for the frame and lets the
sky dome paint over the entire scene.

If the picture ever freezes while the HUD keeps counting, the render loop caught a throw:
look for `[HighwayDash] render frame failed` in the Metro output.

### Vehicles load progressively

`VehicleWorkshop` builds every car through a `VehicleBodyProvider`. It starts on
`ProceduralBodyProvider` (box geometry, available on frame one) and hot-swaps to
`GltfBodyProvider` once the glTF pack finishes decoding, rebuilding everything already on
stage. If the models fail to load for any reason, the game stays fully playable on the
procedural bodies. Disposal is ownership-aware: procedural bodies own their buffers and are
freed, glTF clones share a prototype's and are not.

### HUD without frame drops

The simulation runs at 60 fps but React does not. `TelemetryPublisher` samples the run
state at 15 Hz, drops unchanged snapshots, and pushes into a zustand store where each HUD
element subscribes to a single field — so the speed counter ticking never re-renders the
wanted meter.

### Progression

Upgrades and car stats feed `buildRunTuning`, a pure function producing the physics knobs:
engine raises top speed and shortens the ramp, grip sharpens steering, magnet widens coin
pickup, nerve widens the near-miss window. Difficulty and progression can therefore be
retuned and tested without touching the renderer.

---

## Retention features

**Notifications — every other day.** `ExpoNotificationService` keeps a rolling window of
eight dated local notifications at 48-hour intervals, each pinned to 18:00 local and each
carrying different copy from a six-message rotation (record, streak, free crate,
collection, skill tip, new dailies). The queue is cleared and re-filled on every launch and
every foreground, so an engaged player's reminders are continually pushed forward and only
a genuinely lapsed player ever hears from the app. Permission is requested after the
player's second completed run, not on cold start.

**In-app review — every other day.** `StoreReviewService` calls the native
`SKStoreReviewController` / Play In-App Review sheet on the same cadence, gated behind two
extra guards: at least three completed runs, and a positive moment (a new personal best, or
every fifth run). Note that both stores hard-limit how often the sheet actually appears —
Apple allows three prompts per year regardless of how often it is requested — so the
cadence is the request rate, not the display rate.

Both share one definition of the interval (`CadencePolicy`), and `EngagementCoordinator`
owns all the timing decisions so the product rule lives in exactly one place.

---

## Known gaps

**In-app purchases are not wired.** The gem bundles are real-money products and go through
`PurchaseGateway`, but the only implementation shipped is `SandboxPurchaseGateway`, which
approves every purchase instantly and logs a warning in development. Before release, swap
it for RevenueCat or `expo-iap` inside `createServices` — nothing else in the codebase
changes. Everything priced in gems (coin bundles, the season pass, cars) settles fully
in-game and is complete.

**No audio.** No sound assets were provided, so nothing is wired up; haptics carry all the
feedback today. Adding an audio service alongside `HapticsService` under the existing
`FeedbackService` interface is the natural place for it.

---

## Design source

`Highway Dash.dc.html`, `highway3d.js` and `screenshots/` at the repo root are the original
design mockup and are excluded from the app bundle by `metro.config.js`. They are kept for
reference only.
#   H i g h w a y - D a s h  
 