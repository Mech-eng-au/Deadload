# Handover

Written 2026-07-25, at the end of the session that built the app from an empty repo to a working
Android app in daily use. Read this plus [`SPEC.md`](./SPEC.md) and you have everything.

The spec is the source of truth for *what* and *why*. This document covers the things a spec
does not: how the project is actually worked on, which decisions were made against the spec and
for what reason, and what is worth doing next.

---

## 1. What Deadload is

A local-first bodyweight training app for one person. No accounts, no backend, no network calls
at runtime. It ships as a sideloaded Android APK; the exercise catalog and its images live
inside the package, so it works in airplane mode from first launch.

Everything in §1 of the spec still holds, including the non-goals. Two are worth restating
because they will be tempting: **no cloud sync** (the entire architecture assumes its absence)
and **no general fitness tracking** (weight, nutrition, habits). The app is good partly because
of what it refuses to do.

---

## 2. Current state

All milestones M0–M5 in SPEC §13 are built, plus work that came out of real use.

| Area | State |
|---|---|
| Catalog | 108 bodyweight exercises, every one with at least one image, generated and committed |
| Routines | Build, edit, delete; sections, per-item sets/target/rest/per-side/notes |
| Session player | Per-set logging, countdown on timed sets, rest timer, wake lock, audio cues, crash-resume, undo |
| Import | JSON and CSV, markdown fence stripping, resolver cascade with learned aliases, review screen |
| Presets | Five built-in routines, loaded through the import path |
| Backup | Whole-database JSON export and restore (merge or replace), CSV export of every set |
| Statistics | Weekly sessions, activity calendar, muscle volume, per-exercise progression, streaks, routine usage |
| History | Browse past sessions, inspect every logged set, delete |
| Ladders | Eight progression chains; "easier / harder" swap mid-session, kept in the routine on request (added 2026-07-29) |

Verification: **131 unit tests** (`npm test`) and **eight browser suites** driven with Playwright.
More on those in §6.

---

## 3. How the work actually gets done

This matters more than it sounds, because it is the loop that produced everything good here.

1. **Branch, PR, merge.** Every change goes on a `claude/*` branch, into a PR whose description
   explains the reasoning, then merged to `main`. The PR bodies are the project's decision log —
   they are worth reading before changing anything substantial.
2. **Merging to `main` builds and publishes the APK automatically**
   (`.github/workflows/android.yml`, about four minutes). It always lands at the same URL:
   `https://github.com/Mech-eng-au/Deadload/releases/download/android-latest/deadload.apk`
3. **The user installs it and trains with it.** This is the part that finds the real defects.
4. **They report what annoyed them**, usually in a few lines or a screenshot.

Every genuine bug in this project came from step 3. None came from re-reading code. Screenshots
in particular have been worth more than any amount of static analysis — the status bar covering
the header, and a partner-assisted stretch in a solo app, were both invisible from here.

**Corollary worth internalising:** when the user reports something, look for the second cause.
Twice now the reported symptom had a deeper reason than the report suggested — see §5.

---

## 4. Architecture, briefly

SvelteKit 2 with Svelte 5 runes, TypeScript strict, Tailwind v4, static adapter, wrapped by
Capacitor into an APK. Directory layout follows SPEC §3.

```
scripts/build-catalog.ts     generates the catalog; run by hand, output committed
src/lib/catalog/             catalog.json + typed loader; ladders.ts is the one hand-authored bit
src/lib/db/                  IndexedDB: schema, routines, sessions, aliases, settings, backup
src/lib/import/              parsers + resolver — pure, no Svelte, no database
src/lib/session/             player state machine, steps, audio, wake lock, last-time
src/lib/stats/               statistics and CSV — pure functions over the session log
src/routes/                  the screens
tests/                       vitest; fixtures/imports holds the deliberately ugly LLM output
```

Load-bearing rules, all of which have already caught something:

- **The pure layers stay pure.** `import/`, `stats/` and `session/steps.ts` take data as
  arguments rather than reading the database. That is why their rules are unit-testable.
- **`toPlain()` at the database boundary.** IndexedDB's structured clone rejects Svelte 5's
  reactive proxies with `[object Array] could not be cloned`. Every write is flattened at the
  write boundary rather than at call sites, because a forgotten snapshot fails at runtime while
  saving the user's work.
- **Time is wall-clock, never counted.** Both session clocks derive from timestamps persisted on
  the session (`activeStepStartedAt`, `restEndsAt`). Counting intervals loses the clock when the
  app is killed and drifts while the screen is off.
- **One row per set, always.** Skips are written as `skipped: true` rows rather than omitted, so
  statistics can tell "not done" from "never prescribed".
- **The catalog is build-time data, committed.** The app builds with no network.

---

## 5. Decisions that are easy to undo by accident

These were all deliberate, and several were argued through with the user. Changing them is fine;
changing them *without knowing they were decisions* is the risk.

**Timed sets count down, not up.** They counted up for one build. Counting up gives the user
nothing to act on, and it silently contradicted SPEC §7. Past zero it shows overtime rather than
stopping.

**Every decision point makes a sound.** During a plank the user physically cannot look at the
phone, so a silent timer is a broken feature, not a missing nicety. Five cues distinguished by
pitch and shape rather than volume. There is an off switch in Settings.

**Exercise photos do not animate on their own.** I measured every frame pair in the catalog: the
pairs that differ *most* differ because the photographer moved, not the body — `chair_lower_back_stretch`
is a tight crop next to a wide shot. Auto-animation would be a jump cut. Double tap plays them,
so the user chooses which are worth it. Measurements are in `M0-findings.md` §3.

**Media captions were removed.** The build script used to caption frame 0 "Start" and frame 1
"End". The source labels nothing and the order is not semantic — at least one pair is reversed.
`MediaAsset.caption` now means "the source supplied one".

**Rest comes after a whole set, not between the two sides of a per-side set.** Resting between
left and right would be wrong in the gym.

**A streak that ended yesterday still counts.** Otherwise it reads as broken before the day's
session has happened.

**A set counts once for each of the exercise's primary muscles.** Splitting it fractionally
would invent precision the data does not have.

**Merge-on-restore keeps what is on the phone**, updating a routine only when the file's copy is
newer, and never touching sessions or learned aliases already present. The device is the more
recent authority.

**The signing key is committed on purpose** (`android/deadload-sideload.jks`). Without a stable
signature Android refuses to install an update over the existing app, which would mean
uninstalling and losing all data on every release. If that key changes, users lose their history.

**Two bugs whose reported symptom was not the whole story**, as a warning:

- *"the timer goes back to 00:00 on resume"* had two causes. The clocks were counted in memory,
  and separately, a session was treated as under way only once something had been *logged* — so
  being killed during the very first set dropped back to the Ready screen.
- *"Adductor/Groin is a partner stretch"* was true of two other exercises the user had not hit
  yet. Auditing the whole catalog found them.

---

## 6. Verifying changes

```sh
npm run check      # svelte-check, must be zero errors
npm test           # 131 unit tests
npm run build      # static build
npm run build:apk  # needs the Android SDK; CI normally does this
```

Browser suites live in the session scratchpad rather than the repo, and are worth recreating if
they are needed again — they drove real flows against `npx vite preview` on port 4180 using
Playwright with `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. They covered: the routine
flow with a simulated app restart, the session player end to end, the polish round, import and
presets, backup and restore including a full database wipe, last-time numbers across two
workouts, page transitions, audio, and history plus CSV.

Two techniques worth reusing:

- **Instrumenting the browser to prove non-visual behaviour.** Audio was verified by patching
  `AudioContext` in an init script to record every scheduled tone, then asserting on the actual
  frequencies at each moment. That is how "it makes a sound" became evidence.
- **Reading IndexedDB directly from the page** after a flow, to check the shape of what was
  stored rather than what the UI claims.

A note on false alarms: after adding page transitions, several suites started failing because
checks fired before the incoming screen had settled. That was the animation working, not a
regression. Add a settle wait after navigation.

---

## 7. What I would do next

In the order I would argue for.

~~**Progression ladders.**~~ **Built 2026-07-29** (SPEC §4.1, §7). The cost estimate above was
wrong in a useful direction: this catalog honestly supports **eight** chains, not thirty, because
free-exercise-db simply does not contain most of the intermediate rungs. Writing them took an
afternoon, not a curation pass. What took the thinking was the invariant — a swap must not change
the *number* of steps, or the player loses its place on resume, which is why swaps live on the
session and `perSide` only follows the new exercise once the session is over.

**Double progression.** Now unblocked: hit the top of the rep range on every set, and the app
suggests raising the target. A simple rule over data that already exists. Deliberately left out of
the ladders change so it can be argued on its own.

**Editing a past session.** History can view and delete but not correct. A mislogged set is
currently permanent. SPEC M6 parks this; it is the obvious next gap.

**Added load.** Weighted pull-ups and dips are the natural continuation once bodyweight gets
easy — an optional `addedKg` on a set entry. Note this is currently a **non-goal** in SPEC §1
("weighted / equipment-based training"), so it needs the spec changed deliberately first. Body
weight tracking is a different request and I would leave it out; it is the beginning of a
general fitness tracker.

Things I would argue against: cloud sync, badges and achievements, and anything that widens the
app beyond bodyweight training.

---

## 8. Working with this user

A mechanical engineer, not a software engineer, and explicitly asked to be pushed back on rather
than deferred to. That has been the right call every time — including when it meant telling them
their own spec forbade something they had just asked for.

What has worked:

- **Say what was actually verified and what was not.** Several things could not be tested from
  the development environment: the Android share sheet, the back gesture, whether a sound is
  loud enough. Saying so plainly is better than implying coverage.
- **Amend the spec when reality disagrees with it**, with the reasoning and the measurements.
  `SPEC.md` now contains a dozen dated amendments; that is the point of it.
- **Do not ask permission for things already implied.** They have consistently preferred a
  finished change with the reasoning explained over a question.
- **Report the second cause.** They are an engineer; the underlying mechanism is interesting to
  them, not noise.
