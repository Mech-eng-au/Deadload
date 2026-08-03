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
| Catalog | 166 exercises, every one with at least one image, generated and committed. 99 need nothing but a floor, a wall and a chair; the rest are behind the equipment gates below |
| Equipment | Nine independent checkboxes in Settings (pull-up bar, jumping rope, dumbbells, kettlebell, resistance band, foam roller, yoga ball, suspension straps, ab wheel). Unticked equipment is filtered out of catalog browse and the exercise picker and nowhere else (added 2026-07-30; the last three 2026-08-02) |
| Routines | Build, edit, delete; sections, per-item sets/target/rest/per-side/notes. Exercises are dragged into order by a handle, on the routine screen as well as in the editor, and tapping one opens what the catalog knows about it without leaving the screen (added 2026-07-30). The handle sits on the left, or on the right if Settings says so (added 2026-08-03) |
| Session player | Per-set logging, get-ready preview before each set, pause on a timed set, session progress bar, optional auto-start and auto-log of timed sets, countdown on timed sets, rest timer, wake lock, audio cues, crash-resume, undo |
| Import | JSON and CSV, markdown fence stripping, resolver cascade with learned aliases, review screen |
| Presets | Nine built-in routines, loaded through the import path. Two of them (*Floor time with the baby*, *Baby in arms*) carry per-item `notes` saying where the baby goes — the only way to express that without extending the catalog (added 2026-07-30) |
| Backup | Whole-database JSON export and restore (merge or replace), CSV export of every set, and one routine as a printable A4 PDF with a box to write in for each set — photographs included by default, checkbox to leave them out (added 2026-08-02) |
| Load | `loadKg` on the routine item and on the logged set, for dumbbell and kettlebell work only; stepper in the player, spoken, in the CSV and the importer; kg-reps as a separate statistic (added 2026-07-30) |
| Muscles | Plain English for all seventeen catalog muscle names, front/back body figures (MIT) with each muscle filled in on a grey-to-red ramp, and a `/muscles/` compendium linking through to the exercises for each. Catalog and routine builder only, never the player (added 2026-07-30) |
| Statistics | Weekly sessions, activity calendar, muscle volume, per-exercise progression, streaks, routine usage, loaded work in kg-reps |
| History | Browse past sessions, inspect every logged set, correct a mislogged one, delete. Corrections are marked as such (added 2026-07-30) |
| Speech | Announces the next exercise as rest begins; native TTS via Capacitor on Android, Web Speech in a browser; own Settings switch (added 2026-07-29). **English whatever the interface language is** — see §16 of the spec |
| Language | English and Danish, chosen in Settings or followed from the phone. The interface, the muscle glossary, the equipment table, the nine presets and the printable sheet; the exercise catalog stays English on purpose (added 2026-08-02) |
| Ladders | Eight progression chains; "easier / harder" swap mid-session, kept in the routine on request (added 2026-07-29) |

Verification: **405 unit tests** (`npm test`) and **eight browser suites** driven with Playwright.
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
src/lib/pdf/                 hand-rolled PDF writer + the printable routine sheet
src/lib/reorder.ts           where a dragged card lands — pure, no DOM
src/lib/handle-side.*        which edge the drag handle sits on; .ts is the rules, .svelte.ts the state
src/lib/session/             player state machine, steps, audio, speech, wake lock, last-time
src/lib/stats/               statistics and CSV — pure functions over the session log
src/routes/                  the screens
tests/                       vitest; fixtures/imports holds the deliberately ugly LLM output
```

Load-bearing rules, all of which have already caught something:

- **The pure layers stay pure.** `import/`, `stats/`, `session/steps.ts`, `session/edit.ts`,
  `reorder.ts` and `pdf/` (bar `pdf/images.ts`, which needs a canvas) take data as arguments rather
  than reading the database. That is why their rules are unit-testable.
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

**Speech goes through Capacitor on Android, not the Web Speech API.** `window.speechSynthesis`
does not exist in the Android System WebView — a Chromium issue open since 2015 — so a browser-only
implementation is silent in the APK while working perfectly in `vite dev`. This was shipped and
caught on the phone the same day. The wider rule: *a browser API present in Chromium is not
necessarily present in the WebView*, and the only place to find out is the device.

**Every file the app emits goes through `deliver()` in `src/lib/db/export-file.ts`.** A synthetic
`<a download>` click is another API that is fine in Chromium and inert in the WebView. The import
screen's catalog-file button hand-rolled one and was dead on the phone for two weeks (fixed
2026-08-03, SPEC §14): the user tried to generate a routine, the file never reached the chat, and
the model correctly refused to invent exercise ids. Note what did *not* catch it — `npm run check`
was clean, 370 tests passed, and the button was on a screen I had opened in Chromium, where it
worked. Note also that the knowledge was not missing: the paragraph above it says exactly this
about `speechSynthesis`, and `export-file.ts` said it about blob downloads. **The third repeat of a
lesson is a sign the lesson needed to be executable, not better worded.** It is now
`tests/webview.test.ts`, which lists one permitted file per absent API and fails on any other file
that reaches for it — and which also fails if the permitted file stops using it, so the walls
cannot quietly go stale. Adding a name to one of those lists is a claim that the file handles the
native path too.

**The spoken language is fixed to English, not `navigator.language`.** Everything the app says is
English because the catalog is; on a Danish-locale phone the device locale made a Danish voice read
English words. The locale says what interface the user wants, not what can pronounce this text.
**Still true with the interface in Danish** (2026-08-02, SPEC §16): the interface language and the
spoken language are separate questions, and they have different answers because the exercise names
are English. `tests/i18n.test.ts` fails if `speech.ts` reads `navigator.language` again.

**The drag handle's side is two-valued, and that is not an oversight.** The language and the
equipment settings are three-valued because "never answered" can defer to the phone. No phone
reports which hand is holding it, so `Settings.handleSide` has nothing to defer to and `undefined`
means only "never chosen" — `?? 'left'` loses nothing here, and writing it three-valued to match its
neighbours would add a state with no distinct meaning. The setting is also named for the *edge*
rather than for a hand on purpose (SPEC §12): the app cannot check which hand you use, and a user
who wants the handle on the left for some other reason should not have to agree they are left-handed
to get it there. `tests/handle-side.test.ts` is named after this.

**A ladder rung states its own reasoning, and the test's job is to insist that it does.** Added
2026-08-03 with the audit (SPEC §4.1, `docs/ladder-audit.md`). `ladders.ts` was eight arrays of ids
with the argument in a comment above them, and a comment is not something a test can reach — so the
strongest claim the suite made about difficulty was that the catalog's `level` never falls as a
ladder rises. Both chains the audit deleted passed it, and it *rejected* the better ordering in the
dip chain, where the catalog calls the ~100%-of-bodyweight rung `beginner` and the ~64% one
`intermediate`. Three things follow, and all three are easy to undo without noticing:

- **`level` may be quoted as evidence and may never order a chain.** Where it falls across a step,
  `Step.levelFalls` has to say why the catalog is wrong. Reinstating "level never falls" would delete
  a correct rung and admit two bad ones.
- **The size of a step is unenforceable and the test says so out loud.** Nothing in the catalog
  encodes effective load, so no assertion can tell a 16% step from one that doubles it. What the
  assertions do check is every *mechanical* consequence of a step's declared mechanism — a
  `limb_count` step must actually flip `unilateral` and no other kind may, a chain may never add
  gated equipment as it rises, and the primary muscle, category and metric hold the whole way up.
  Each of those caught a real defect; none of them can catch a rung that is simply too big.
- **The coverage test is gone on purpose.** It asserted that ladders covered >40% of the strength
  catalog a fresh install offers, which rewarded adding rungs and would have failed on this audit's
  honest deletions (59% → 44%). What replaced it is an explicit list of the exercises deliberately
  left off with a reason each, so the suite fails when somebody quietly ladders one instead.

**Progression suggests; it never applies.** Built 2026-08-03 (SPEC §17, `src/lib/progress/`). Five
things here are decisions rather than implementation detail, and four of them are invisible from the
code that uses them:

- **The rule is pure and lives outside the screen.** The criterion that decides to move somebody up
  a ladder is the last thing that should only be reachable by finishing a workout. `progress/` takes
  the log and the routine as arguments and reads no database; `calibration.ts` imports only types,
  which is what lets `stats/compute.ts` use it without gaining a catalog dependency.
- **The streak is matched on `itemId` *and* `exerciseId`.** A §7 swap keeps the item and changes the
  exercise, and sessions performed on the easier rung are not evidence that the harder one is too
  easy. Drop the `exerciseId` half and a swap inherits a streak it did not earn.
- **A set is counted by distinct `setIndex`**, the same way §4.3's renumbering counts one, so a
  per-side pair is one set. Counting entries instead means a unilateral item can never satisfy the
  criterion, silently.
- **The finished screen builds each write on the last.** `player.routine` is a readonly snapshot
  taken when the session started, so taking one suggestion and then declining a second — or keeping
  a ladder swap afterwards — would each write a routine that had forgotten the others. There is a
  test named for this.
- **`ladder_end` still needs a tap.** It offers nothing, so the temptation is to stamp
  `progressDeclinedAt` when it is *shown* and save a button. That would be the app writing to the
  user's routine on its own, which §17.3 forbids for good reasons; the button is the price of the
  rule staying true without exceptions.

**A backward link replaces, it does not push.** Every `←`, every sideways hop and every `goto`
after a commit uses `replaceState`; only drilling into something pushes. Adding a plain
`<a href>` back to a parent is how the app grew four separate navigation loops (§12), and it is
an easy mistake to make again because the markup looks harmless.

**Pausing shifts the deadline, it does not stop a clock.** `pausedAt` is recorded and resuming
moves `activeStepStartedAt` forward by the length of the pause. Anything that "stops the timer" by
counting in memory breaks the wall-clock rule and loses the set when the app is killed.

**Auto mode never touches a reps set.** The two switches (§7) advance the preview and log timed
sets; a reps set always waits for the tap, because the app cannot see you finish twelve push-ups
and a log full of numbers nobody performed would poison every statistic built on it. If a future
change makes auto mode "complete", that is the line not to cross.

**A set never starts on the app's schedule.** The preview state (§7) holds between sets with no
clock running until the user presses Start. It is implied rather than stored — mid-session with
neither `activeStepStartedAt` nor `restEndsAt` means "waiting to begin" — so a killed app resumes
onto the preview instead of into a timer that ran in someone's pocket. It deliberately does not
appear after rest, which is already the gap and already counts down out loud.

**The next exercise is spoken as rest *begins*, never as it ends.** The end of rest belongs to the
`done` cue, which is the one sound that has to carry across a room; a sentence on top of it buries
it. Rest is also the moment the user is free to listen. Same reason the announcement is not
repeated when rest is skipped.

**`ownedEquipment: undefined` and `ownedEquipment: []` mean different things.** Undefined is
"never asked" and resolves to `['pull_up_bar']`, because the catalog was built around a bar from
M0 and two presets and a ladder need it. `[]` is "owns nothing" and must gate everything. Anything
written as `settings.ownedEquipment ?? DEFAULT` collapses the two and hands pull-ups back to a user
who deliberately unticked every box, on the next launch, silently. Read it through
`ownedEquipment()` in `src/lib/catalog/equipment.ts` and nowhere else. There is a test named after
this.

**A gate hides an exercise from two screens: catalog browse and the exercise picker.** Not from a
routine the user already has, not from history, not from a preset, and not from import resolution —
those show an equipment chip or a warning. Gating is about what the app *offers*. The moment it
starts editing what the user already decided to do, it is deleting their data to enforce a
checkbox.

**Load is the mass of an implement, and only ever that.** `loadKg` is set for `dumbbells` and
`kettlebell` work and nothing else. A band has no kilograms — tension depends on the stretch, and a
colour code is not a unit. A weighted pull-up is worse: the load is the plate *plus* the body, so
`reps × plate` is not the work done and the honest figure needs a body weight §1 refuses to track.
`HANDOVER` §7 used to propose an `addedKg` for exactly that; it is declined in SPEC §4.5. An
importer that puts a load on a push-up has it dropped with a warning rather than stored.

**kg-reps are a second currency, never added to the set counts.** No single app-wide "total volume"
number exists, and `totals()` has no load field — there is a test that fails if one is added. There
is no bodyweight-load-as-a-percentage-of-body-mass estimate either. Both are the calorie counter of
§12 wearing a different hat: a number nobody measured, shown as though somebody had.

**The body figures are MIT, and the notice has to travel with them.** `static/muscles/{front,back}.svg`
come from `svelte-body-highlighter`, © 2022 ELABBASSI Hicham and © 2025 Stefan Poindl. The authors and
licence are in `attribution.json` and rendered on the About page; do not drop that block, and do not
swap the figures for something whose licence has not been read — SPEC §4.1 requires one recorded per
image.

**The muscle map is a name mapping, not geometry.** Every muscle in these figures is its own group
with a `data-slug`, so `src/lib/catalog/body-map.ts` maps catalog muscle name → slug and the app
recolours the real muscle shape. Fourteen of seventeen map exactly; `lats` and `middle back` share
`upper-back`, and `abductors` uses `gluteal`. Those three are listed in `APPROXIMATED` and shown to
the user on the compendium — if you tighten them, keep them visible rather than silent.

**The colour is a ramp and must stay one.** Grey → light red → strong red, for not used → assists →
works, with a legend. The user's objection to an earlier version was precisely that its three colours
did not order, so a reader had to memorise a key instead of reading an intensity. Do not swap in three
unrelated hues.

**Two transforms happen at fetch time in `build-catalog.ts`, and both are load-bearing.** `id` becomes
`data-part`, because two figures on a screen would otherwise carry duplicate ids; and the hard-coded
`fill`/`stroke` values are stripped, because inline presentation attributes beat stylesheet rules in
some engines and the highlight would silently do nothing. There is a test for the second one.

**The figures are inlined with `?raw`, and each instance tags its own markup.** CSS cannot reach
inside an `<img>`, which is why they are not images. And the tagging is per instance because the first
attempt injected a style element per figure scoped by a class derived from the view — on the
compendium, where every muscle has a figure, they all matched each other and nearly everything came
out as "works".

**Render all seventeen highlights and look at them after touching `body-map.ts`.** This is the check
that has caught every real defect in this feature: an adductor highlight that looked like a penis, a
chest highlight on the collarbone, an "outer hip" on the quadriceps, and a class collision that
painted almost every muscle as "works". None of them were visible from the code. It is the same point
§3 makes about the app as a whole — a diagram is a picture, and pictures have to be looked at rather
than reasoned about.

**Anatomy never appears during a session.** Mid-set the one available glance belongs to the set
numbers and the countdown (§12), so the muscle glossary and the body map are catalog- and
builder-only. `tests/muscles.test.ts` asserts the player does not import `BodyMap`.

**A logged session can be corrected, but only a finished one, and the correction is admitted.**
Added 2026-07-30 (SPEC §4.3). Three parts of that sentence are decisions rather than convenience:

- *Only finished.* An unfinished session is the player's, and the player finds its place on resume by
  counting entries — removing one underneath it would desync the rest of the workout. The screen says
  why instead of quietly hiding the buttons.
- *A correction, not authoring.* Reps, seconds, load, RPE, skipped and the session note are editable.
  The exercise, the side and every timestamp are not. Changing those does not fix a record of what
  happened, it writes a different workout, and the honest way to have a different workout is to do one.
- *`editedAt` is stamped and shown.* Statistics are built on this log; one that can be silently
  rewritten is worth less than one that admits it was. Nothing filters corrected sessions out of §10
  — the label exists so a surprising chart can be traced, not so the number can be discounted.

Marking a set skipped **clears its numbers**, because a not-done set with eight reps on it is a
contradiction that §10 would then count; un-skipping therefore has to supply a number. Removing a set
renumbers the rest of that exercise by *distinct* `setIndex`, so a per-side pair stays one set rather
than becoming two.

**Two gestures share a routine card, told apart by place and not by time.** Added 2026-07-30
(SPEC §12). Tapping the card opens the exercise; the handle on its right drags it into order. A long
press would have avoided the handle, and was rejected: it is invisible until it has already done the
wrong thing, and its timeout is a guess about how fast this user moves.

**On the routine screen the handles are now behind a toggle** (2026-08-03, asked for directly). They
cost 44 px plus a 12 px gap — **17% of a 328 px card at 360 px**, and it was coming out of the
exercise name: that screen rendered *"Dips - Triceps Ver…"* where the full name now fits. A grip
glyph above the list reveals them and becomes *Done*, on whichever edge `handleSide` points at.
Three things about it are load-bearing:

- **A mode is not the long press the paragraph above rejects.** What was wrong with a long press is
  that it is invisible until it has already acted; a mode is entered on purpose and reversible before
  anything moves. The mechanism changed, the reasoning is what chose it.
- **It confirms nothing.** A drop still saves immediately, and *Done* only stops showing the handles.
  Anything that makes it mean "commit" is the Save button SPEC §12 refuses to put on that screen.
- **The keyboard route has to survive being hidden.** The handle is the only way to reorder without a
  pointer, so the toggle is a real button and entering the mode moves focus onto the first handle.
  Verified in Chromium: Arrow Down there moves an exercise across a section boundary and focus
  follows the card.

**The editor keeps its handles**, because it is already a dedicated editing mode and a mode inside a
mode reads oddly — and because leaving them permanently visible on one screen keeps the gesture
discoverable somewhere. A *pencil* was the obvious icon and was not used: *Edit routine* is on the
same screen and opens the full editor, so a pencil meaning "reorder" would be two different edits
wearing one icon.

Three things about the drag are load-bearing, and all three are in `$lib/reorder.ts` and
`SortableList.svelte` rather than in the screens:

- **The list does not change while the finger is down.** Only the dragged card follows the pointer;
  the others step aside by exactly its height, opening a gap where it will land. So every card's
  measured position stays true for the whole gesture, which is what makes cards of *different*
  heights work — and a routine card grows with its notes and its equipment chips. An earlier version
  drew a drop line instead and the line ended up hidden underneath the card being dragged; the
  screenshot is what caught it.
- **Page coordinates, not client coordinates**, because the list auto-scrolls near the edges and the
  page therefore moves under a still finger. A page-space centre survives that; a client-space one
  does not.
- **On the routine screen a drop saves at once; in the editor it does not.** The routine screen has
  no Save button and the drop is the decision. The editor stages everything until Save, so Cancel
  still discards a drag there.

**Nothing that opens over a routine may navigate.** The exercise sheet exists because leaving the
routine *editor* discards unsaved work — its own Cancel link says so — so a link to the catalog page
would have been a defect dressed as a convenience. `ExerciseDetail` therefore has an `embedded` mode
whose single rule is that no link navigates: Settings and the muscle glossary become plain text, and
the progression rungs move the sheet instead of the app. The catalog page and the sheet render the
same component, so they cannot drift into describing an exercise differently.

**A yoga ball is not gym equipment, and the build script used to say it was.** Added 2026-08-02 with
suspension straps and an ab wheel (SPEC §5.1). `exercise ball` sat in the build script's `GYM_EQUIPMENT`
set next to `machine` and `barbell`, which was a category error: §1's rule is *nothing is assumed
except a floor, a wall and a chair, and everything else is declared in Settings*, and a £15 inflatable
in the corner of a bedroom is exactly that. **`medicine ball` stays refused**, and not for consistency:
its seventeen rows are almost all throws and slams, which need a partner and a room this app is not
used in. If you add it anyway, cut the throws first.

**The printable sheet is a log, not a printout.** Added 2026-08-02 (SPEC §8). Every set gets a box
with its target printed pale inside it, because the reason to want paper is to write on it. Three
things are easy to undo by accident:

- **It is not `window.print()`**, and must not become it: an Android WebView has no print dialog
  unless the host app implements one, so that button would do nothing on the phone and work perfectly
  in every test run here.
- **The PDF is written by hand** (`src/lib/pdf/writer.ts`) rather than by a library, because the whole
  job is text, rules, boxes and a JPEG. The file is assembled as one character per byte so the
  cross-reference offsets are string lengths; there is a unit test that walks every offset and checks
  it lands on the object it claims, with and without binary in the file. Break that and readers reject
  the file outright with nothing useful to say.
- **Photographs are scaled before they are embedded, not after.** 23 mm on paper is 240 px; at catalog
  resolution the same sheet is 900 kB instead of 83 kB. And they go in as JPEG because that is the one
  format a PDF stores verbatim — the catalog's WebP would have to be decoded either way.

**`Settings.language: undefined` and `Settings.language: 'en'` mean different things**, added
2026-08-02 (SPEC §16.3). This is `ownedEquipment` above wearing a different hat, and it fails the
same way: `undefined` is "never asked" and follows the phone, an explicit value is an answer and
outranks it. `settings.language ?? deviceLanguage()` collapses the two and puts a Dane who chose
English back into Danish on the next launch, silently. Read it through `resolveLocale()` and nowhere
else. There is a test named after this one too.

**The catalog stays English, and the seam for changing that is deliberately empty.** 166 exercise
names, 577 instruction steps and 216 aliases are generated data, not copy we wrote — and translating
them would break the import resolver's inputs (§6.3), invalidate the LLM prompt's ids (§14), and make
the "everything spoken is English" rule half-true. `src/lib/catalog/names.ts` is where a translation
goes if that is ever wanted; read the note at the top of it first, because it is a decision about
speech and about the importer, not only about words on a screen.

**A tab's icon is chosen by a key, not by its label.** `+layout.svelte` used to pick the icon with
`tab.label === 'Routines'`. Translating the four labels would have given every tab the Settings icon,
in silence, on a screen that is on every page of the app. The lesson generalises: **anything that
branches on a user-visible string is a bug waiting for a translator.**

**A translated preset is a translated file, not a layer of overrides.** `static/presets/da/*.json`
are complete copies in the import format, so §9's rule that presets go through the import path holds
for every language. `tests/presets-i18n.test.ts` asserts that a translation names the same exercises
with the same sets and targets — the words may change and the workout may not. And because a preset
is *copied into IndexedDB* when it is added, a routine keeps the language it was added in; switching
afterwards does not rewrite it, which is the same principle as a gate never editing a routine the
user already has.

**The CSV, the backup and the import format are never localised.** Danish writes `2,5` for two and a
half kilos, which is a column break in a comma-separated file. There is a test.

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
npm test           # 405 unit tests
npm run build      # static build
npm run build:apk  # needs the Android SDK; CI normally does this
npm run build:fonts    # re-cuts the PDF's font subsets; run by hand, output committed
npm run build:catalog  # same arrangement, and the older of the two
```

Browser suites live in the session scratchpad rather than the repo, and are worth recreating if
they are needed again — they drove real flows against `npx vite preview` on port 4180 using
Playwright with `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. They covered: the routine
flow with a simulated app restart, the session player end to end, the polish round, import and
presets, backup and restore including a full database wipe, last-time numbers across two
workouts, page transitions, audio, and history plus CSV. The 2026-07-30 round added the muscle body
map, the baby presets, session correction, and dragging a routine into order; 2026-08-02 added the
printable sheet — downloaded from the running app and then **rendered with MuPDF (`npm i mupdf`, a
WASM build with its own fonts) and looked at**, which is the only way to know a PDF is right. Note
that pdf.js in Node parses the file fine and draws no glyphs at all, so a blank render there means
nothing — the last one seeded a finished session straight into
IndexedDB rather than performing a whole workout to reach the screen under test, which is worth
copying for anything that only cares about a logged session.

The 2026-08-02 language round added a ninth: **both locales driven side by side at 360 × 808**, which
is the only way the two layout defects it found were ever going to surface. Danish is what exposed
them; both were already latent in English. The PDF was rendered with MuPDF in Danish as well, from a
real preset rather than a fixture, which is how "æøå prints" became evidence rather than a claim.

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

**Danish exercise names, if they are wanted.** The interface is Danish and the exercise names are not,
which is a seam a user can see: the sheet says *Kræver: stol eller bænk* above *Bodyweight Squat*.
`src/lib/catalog/names.ts` takes 166 short names and nothing else has to change — but read SPEC §16.1
first, because it also decides whether the app starts speaking Danish, and that pulls in a voice that
may not be installed. Instructions are a separate and much larger question: 577 steps, ~14,400 words,
and no test that can check a translation is any good.

~~**Dragging an exercise between sections.**~~ **Built 2026-08-03** (SPEC §12). `SortableList` now
owns every section rather than being mounted once per section, which is what made a drop in another
section expressible at all. The reason it was worth doing turned out to be sharper than "a thing the
user wants": moving an exercise between sections previously meant removing and re-adding it, which
loses its sets, target, rest and notes. The gesture replaces retyping, not clicking.

**Progression, and the ladder audit that blocks it.** Specified 2026-08-03 as SPEC §17, not yet
built. The evidence was checked first and is committed as `docs/exercise-variation.md`; it killed the
version of this feature that rotated exercises to prevent the muscles "adapting" — that has been
tested twice and found null both times — and it collapsed double progression and the ladder swap into
one rule, because in a leverage system progressing *is* changing the exercise.

~~**The audit comes first.**~~ **Done 2026-08-03**, and written up as `docs/ladder-audit.md` with a
verdict per chain and the evidence tagged the way `exercise-variation.md` tags its own. It expected
two bad chains and found four. **Eight chains became seven and twenty-three rungs became seventeen.**
The squat chain was deleted outright — the catalog has no harder bodyweight squat, and saying so is
the answer rather than a failure to find one. `single_arm_push_up` and `floor_glute_ham_raise` were
dropped for doubling the load; the pull chain was split in two; and the dip chain, which nobody had
flagged, turned out to contain the same doubling from the day it was written and had a rung inserted
into it. §17 itself changed in three places as a result: its scope was widened to `core` (its stated
reason for excluding it was factually wrong), the offer is now filtered by owned equipment, and the
top of a ladder says the catalog has run out rather than offering another set.

**§17 is now built** (2026-08-03): `src/lib/progress/` as a pure module, the calibration window,
the finished-screen offer, `RoutineItem.progressDeclinedAt`, and §10's sparkline, which was plotting
calibration sessions and therefore drawing motor learning as progress.

**Nothing is left of §17 as specified.** What is deliberately *not* built is §17.4's honest
variation offer — *"this will not build more muscle, but people who change exercises report enjoying
training more"*. It needs a place to live that is not a nudge, and §17.4 is explicit that it is never
automatic, never scheduled and never presented as a fix for a plateau. That is a screen decision
rather than a rule, and it has not been made.

~~**Editing a past session.**~~ **Built 2026-07-30** (SPEC §4.3 amendment, `src/lib/session/edit.ts`,
the History detail page). Tap a set, change reps/seconds, load, RPE or skipped, save; remove a set and
the rest of that exercise renumbers; the session note is editable in the same place. Four rules are in
the pure module rather than the screen: only finished sessions are editable, skipping clears the
numbers, removing renumbers by distinct `setIndex` so per-side pairs stay one set, and every edit
stamps `editedAt` — which is then shown on the session and in the history list. What is deliberately
*not* editable: the exercise, the side, the timestamps. Those are a different session, not a
correction.

~~**Added load.**~~ **Built 2026-07-30, and narrower than proposed** (SPEC §4.5, §5.1). The spec was
changed deliberately first, as this entry asked. But the proposal here — `addedKg` for weighted
pull-ups and dips — is the part that was *declined*: adding a plate to a pull-up makes the load the
plate plus the body, and the honest number needs the body weight this same paragraph rightly says to
leave out. So `loadKg` records the mass of an implement that was actually weighed, dumbbells and
kettlebells only, and weighted pull-ups remain out of scope. The useful lesson: the reason to refuse
body-weight tracking is also the reason `addedKg` could never have been honest.

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
