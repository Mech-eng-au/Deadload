# The Ladder Audit

**Eight hand-authored chains, re-examined 2026-08-03 because SPEC §17 promotes them from a
suggestion into the mechanism the app steers a routine with.** §17.6 required this before any
of §17 could be built. The result is seven chains and seventeen rungs, down from eight and
twenty-three.

---

## 0. How to read this

The chains were written when a rung was something the user could take or ignore. A rung the
user has to argue with is a different object from a rung the app moves them onto, and the
question this audit asks of every step is the second one: **is this the next thing this person
should do, arrived at automatically, on the strength of two good sessions?**

Every claim carries a tag, in the vocabulary
[`exercise-variation.md`](./exercise-variation.md) uses on itself:

| Tag | Means |
|---|---|
| **[well established]** | Measured, or arithmetic. I would be surprised if it reversed. |
| **[reasonable inference]** | Follows from mechanism plus established findings; not tested directly. |
| **[contested]** | Trials disagree, or it rests on one weak source, or I am unsure. |
| **[folklore]** | Widely repeated, no supporting evidence. **No surviving step rests on one.** |

**A rung justified by "it feels harder" is allowed, and has to say so.** That is what
[reasonable inference] is for. What is not allowed is a rung whose justification was never
written down, which is why every step in `ladders.ts` now carries a `note` and the test fails
without one.

### The one measurement that covers a whole chain

**Ebben, Wurm, VanderZanden et al. 2011**, *Kinetic Analysis of Several Variations of
Push-Ups*, J Strength Cond Res 25(10):2891–4.
<https://journals.lww.com/nsca-jscr/fulltext/2011/10000/kinetic_analysis_of_several_variations_of_push_ups.31.aspx>

23 recreationally fit adults (14 men, 9 women), six push-up variations in randomised order on
a force plate. Peak vertical ground reaction force as a share of body mass:

| Variation | % of body mass |
|---|---|
| Hands elevated 61 cm | 41% |
| Knee push-up | 49% |
| Hands elevated 30.5 cm | 55% |
| Regular | 64% |
| Feet elevated | highest of the six, up to ~74% |

**[well established]** — it is a direct measurement of three of this app's rungs, and no
gender difference was found. Two caveats worth carrying: it measures the *load*, not the
difficulty, and it does not follow anyone over time. And **these numbers were read from the
abstract and from secondary sources, not from the full text** — check them against the paper
before quoting them at a user.

This is the only chain in the file with a measurement behind it. Everything else is mechanism,
arithmetic, or an admitted guess, and is tagged accordingly.

---

## 1. Horizontal push — **keep three rungs, drop the fourth**

`incline_push_up → pushups → push_ups_with_feet_elevated` ~~`→ single_arm_push_up`~~

The best-evidenced thing in the file. Ebben measured these exact variants: **~55% → 64% →
~74%** of body mass, two steps of roughly 16% relative each. **[well established]**, and a good
demonstration of what a rung should be: big enough to feel, small enough that the user arrives
with reps in hand rather than with one.

**`single_arm_push_up` is dropped.** Roughly 64% of body mass, on one arm instead of two —
**[well established] as arithmetic**, and a doubling. Two further costs stack on top of the
load, and §17 cares about both:

- It flips `unilateral`, so a logged rep stops meaning what it meant on the rung below. The
  measurement channel does not merely get coarser, it changes units.
- It is a skill acquisition measured in months (`exercise-variation.md` §5a, §7.5), so the
  first sessions on it measure learning, not strength — the whole reason §17.2 exists.

A user arriving at 20 elevated push-ups would land on one or two reps: the coarsest measurement
in the app, reached by an automatic suggestion.

**Missing rungs, real and named:** pike push-up, archer push-up, uneven or one-arm-assisted
push-up. None are in free-exercise-db as bodyweight entries. This is the same gap that already
leaves `handstand_push_ups` on no ladder, and it now leaves `single_arm_push_up` there too.

**Worth noting about `level`:** the catalog calls `single_arm_push_up` *intermediate* and
`handstand_push_ups` *advanced*. The old test — "`level` never falls as a ladder rises" —
passed this chain without complaint. No `level`-based assertion could have caught it.

---

## 2. Pull — **split into two chains, drop the first rung**

~~`scapular_pull_up`~~ ` → inverted_row → chin_up → pullups`
becomes `inverted_row → bodyweight_mid_row` and `chin_up → pullups`

Three separate problems in one chain.

**`scapular_pull_up` is not a rung.** Primary muscle *traps*, and the movement is a few inches
of scapular depression with the elbows locked — no elbow flexion at all. A rep of it and a rep
of a chin-up are not the same measurement made harder, they are different measurements.
**[well established]** mechanically: different joint action. It is a hang-and-scapula drill,
and it stays in the two presets that use it; it just stops being called "the easy pull-up".

**`inverted_row → chin_up` was two cliffs at once.** Horizontal pull to vertical pull, and
roughly 50% of body mass to 100%. That is the same doubling this audit removes from the push-up
chain, so it goes for the same reason. **[well established]** as arithmetic.

**What replaces it.** Two chains, each inside one plane and one primary muscle:

- **`inverted_row → bodyweight_mid_row`** — both middle-back, both on the bar. The mid row is
  performed with the legs hooked over the apparatus, which raises the hips and lengthens the
  lever. **[contested]**, and it is the rung in the whole file I am least sure of: the lever
  change may make it a much bigger step than intended, closer to a front-lever row than to a
  harder inverted row. It is on the chain rather than off it because the alternative is to say
  the catalog has no graded horizontal pull at all — but if anything in this audit is wrong,
  this is where I would look first.
- **`chin_up → pullups`** — both lats, both on the bar. Supinated before pronated: the chin-up
  recruits the elbow flexors more, and most people manage more chin-ups than pull-ups.
  **[reasonable inference]** — widely observed, no trial I can cite for the ordering, and the
  catalog gives both the same `level`, which tells us nothing either way.

**Missing rung, real and named:** there is nothing below a full chin-up. Negative chin-ups,
band-assisted chin-ups and jumping chin-ups are the standard entry rungs and none is in the
catalog, which is why the vertical chain has to start at a movement many users cannot do once.

**A curation defect found on the way, not fixed here.** `inverted_row`'s instructions say
*"Position a bar in a rack to about waist height. You can also use a smith machine."* Its
equipment is `pull_up_bar`. A doorway bar — the thing SPEC §5.1 assumes when it defaults
`pull_up_bar` on — cannot be set at waist height.

---

## 3. Triceps dip — **insert a rung**

`bench_dips → push_ups_close_triceps_position → dips_triceps_version`

**This chain was already the cliff the brief objected to, and nobody had noticed.** A bench dip
loads roughly half of body mass; a parallel-bar dip loads essentially all of it.
**[reasonable inference]** for the ratio — I found no force-plate study of the pair, and the
supporting evidence is a 2022 3D-motion-capture-plus-EMG comparison reporting significantly
higher peak activation in six muscles including the triceps for the bar dip, which establishes
the direction but not the size. The step is about the same as the one-arm push-up's.

`push_ups_close_triceps_position` sits between them: triceps-primary, around 64% of body mass
or a little more given the hand position, and needing nothing but the floor.
**[reasonable inference]**, resting on Ebben's regular-push-up figure plus the mechanism.

**This ordering was forbidden by the old test.** `push_ups_close_triceps_position` is
*intermediate*; `dips_triceps_version` is *beginner*. "`level` never falls as a ladder rises"
rejects the better chain and accepts the worse one — which is the clearest available
demonstration that `level` ranks against the whole catalog rather than against siblings, as
`ladders.ts` has said since it was written. The new test lets `level` fall where the step says
in writing why the catalog is wrong.

**A second curation defect.** `dips_triceps_version`'s instructions describe parallel bars
("hold your body at arm's length with your arms nearly locked above the bars"); its equipment
is `chair`.

---

## 4. Squat — **delete the chain**

~~`bodyweight_squat → bodyweight_walking_lunge → freehand_jump_squat`~~

Both objections in the brief hold, and the honest consequence is that nothing is left.

**A walking lunge is not a harder squat.** Not only because it is a different movement — split
stance, forward travel, a large balance component — but because the load barely moves. A
two-leg squat puts roughly half of body mass through each leg; a lunge puts perhaps 60–70%
through the front one. What makes a lunge hard is balance and the step, and §17's criterion
cannot tell balance from strength. **[reasonable inference]**.

**A jump squat is power, not strength**, so it is the wrong destination for a criterion built
out of reps at the top of a range. **[well established]** — and the catalog agrees with itself
everywhere except here: `rocket_jump`, `split_jump`, `knee_tuck_jump` and `scissors_jump` are
all `category: cardio`. `freehand_jump_squat` is `strength` by accident of the source data, and
that accident is what put it on a strength ladder.

**Missing rungs, real and named, and there are a lot of them:** a bodyweight split squat as
strength, a Bulgarian split squat, a step-up loaded only by body mass, a shrimp squat, a
pistol squat, a pistol to a box. **None is in the catalog.** The nearest entries are traps
rather than rungs: `split_squats` is filed under `mobility` and is actually a split *jump*;
`sit_squats` is a partial squat, `mobility`, and measured in seconds; `suspended_split_squat`
is suspension-gated and carries the lunge's objection anyway; and the dumbbell and kettlebell
squats progress by load, which SPEC §4.1 deliberately keeps off the ladders.

So `bodyweight_squat` — one of the most-used exercises in the app, in four presets — is on no
ladder, for exactly the reason `handstand_push_ups` already is. **That is the answer, not a
failure to find one.** The walking lunge keeps its place in three presets; the app just stops
calling it the harder squat.

---

## 5. Posterior chain — **drop the last rung**

`butt_lift_bridge → single_leg_glute_bridge` ~~`→ floor_glute_ham_raise`~~

**Not flagged in the brief, and it fails the same test as the squat chain.**

Bridge to single-leg bridge is clean: the same movement, the same joint action, the same
muscle, on one leg instead of two. **[well established]** as arithmetic — a `limb_count` step,
and the kind §17.2 gives a wider calibration window to.

**`floor_glute_ham_raise` is a different exercise.** Knee flexion, hamstrings-primary, with the
instructions explicitly telling the user *not* to flex the hips — which is the entire movement
of the two rungs below it. It is also enormous: the catalog's own text says *"This movement is
very difficult and you may be unable to do it unaided. Use your arms to lightly push off the
floor."* An app that has just congratulated somebody on twenty single-leg bridges should not
offer them that.

**Missing rungs, real and named:** a band-assisted nordic curl, a nordic negative to a high
box, a sliding leg curl. `ball_leg_curl` is in the catalog but is a far easier movement and
yoga-ball-gated; chaining it to the nordic would rebuild the cliff one rung lower rather than
remove it, so `floor_glute_ham_raise` is on no ladder.

---

## 6. Trunk flexion — **keep as is**

`crunches → sit_up → jackknife_sit_up`

The only chain of the eight that needed nothing. Each step adds a joint or lengthens a lever:
a crunch takes the shoulders off the floor; a sit-up anchors the feet and adds hip flexion
through a full range; a jackknife moves both levers at once. **[reasonable inference]** —
mechanically sound, and there is no measurement of any of it, which the note in `ladders.ts`
says rather than implying otherwise.

One caveat that is a note and not a defect: a sit-up needs the feet held ("under something that
will not move, or a partner"), which a routine cannot guarantee. It does not affect the
ordering.

---

## 7. Hip flexion — **split, and drop a near-duplicate**

~~`bent_knee_hip_raise → reverse_crunch`~~ ` → hanging_leg_raise → hanging_pike`
becomes `hanging_leg_raise → hanging_pike`

**The first two rungs are the same exercise.** `bent_knee_hip_raise` bends the knees to about
75° and rolls the pelvis back; `reverse_crunch` holds the thighs vertical and rolls the pelvis
back. `leg_pull_in` is a third copy of the same movement, already off the ladders. That is
precisely the "a rung the user cannot feel is worse than no rung" that the file's own header
forbids, and it survived because nothing tested for it. **[well established]** — read the two
instruction sets side by side.

**And the chain added gated equipment as it rose.** Rungs 1–2 need nothing; rungs 3–4 need a
pull-up bar. §17 as first written did not filter its offer by owned equipment, so a user who
had never ticked the pull-up-bar box would have been automatically offered a hanging leg raise.
This is the one finding in the audit that a machine can check, and it is now checked twice: the
test forbids a chain from adding gated equipment, and §17 filters the offer through
`isAvailable()` regardless.

**It was a cliff as well.** Floor to a dead hang adds grip and shoulder-girdle endurance that
has nothing to do with the abdominals, so the rep count stops measuring the thing the chain is
about.

`hanging_leg_raise → hanging_pike` survives as a bar chain: both `advanced`, both on the bar,
the pike adding range and a straighter leg to the same hanging movement.
**[reasonable inference]**.

**Missing rung, real and named:** a hanging *knee* raise, which is the standard step between
the floor work and a straight-leg hanging raise. `gorilla_chin_crunch` is a chin-up with a knee
raise attached, not it.

---

## 8. Plank — **delete the chain**

~~`plank → side_bridge`~~

**A different plane, not a harder version.** A plank resists extension; a side bridge resists
lateral flexion, on one arm and one foot. Both are worth doing and neither is the other one
made harder. **[well established]** mechanically.

**`side_bridge` has no instructions at all** — one of three entries in the catalog with an
empty `instructions` array (with `side_jackknife` and `one_arm_kettlebell_swings`). An exercise
the app cannot explain is a poor thing to move somebody onto automatically, and the new test
now refuses to let one onto a ladder.

Both are `category: core` and `defaultMetric: duration`, so §17 could never have fired on this
chain in either direction. Deleting it costs the two exercises their ↓Easier / ↑Harder pills in
the session player and nothing else.

---

## 9. New chains

**None.** Eight was a finding rather than a target, and seven is this one.

What was looked for and why it does not exist:

| Wanted | Why not |
|---|---|
| A shoulder-press chain | Needs a pike push-up. Absent — already documented as why `handstand_push_ups` is unladdered. |
| A back-extension chain | `hyperextensions_with_no_hyperextension_bench` has no partner; `superman` is `category: stretch`, so a chain would span two categories. |
| A rotation / oblique chain | `oblique_crunches_on_the_floor`, `cross_body_crunch`, `elbow_to_knee` and `alternate_heel_touchers` are near-duplicates of each other, and `side_jackknife` has no instructions. |
| A wider glute chain | `glute_kickback`, `leg_lift`, `flutter_kicks` and `step_up_with_knee_raise` do not order — they are four different movements at one difficulty. |
| A knee-flexion hamstring chain | Discussed in §5: the only pair available rebuilds the cliff it would exist to remove. |

---

## 10. On no ladder, deliberately

Ten exercises the app could plausibly be expected to ladder and does not. The list is in
`tests/ladders.test.ts` as an assertion, so it fails when somebody quietly ladders one — which
is the failure mode worth catching. The old ">40% of the strength catalog is laddered" test
failed on the opposite thing, an honest deletion, and is gone.

| Exercise | Why |
|---|---|
| `handstand_push_ups` | No pike push-up in the catalog to stand below it. |
| `single_arm_push_up` | ~2× step from anything below it; no archer or uneven push-up to bridge. |
| `bodyweight_squat` | The catalog has no harder bodyweight squat. §4. |
| `bodyweight_walking_lunge` | A different movement at almost the same load. §4. |
| `freehand_jump_squat` | Power, not strength — and `strength` only by accident of the source data. §4. |
| `floor_glute_ham_raise` | A different joint action, and a cliff. §5. |
| `scapular_pull_up` | A scapular drill, not a pull. §2. |
| `bent_knee_hip_raise` | A near-duplicate of `reverse_crunch`. §7. |
| `reverse_crunch` | Kept off with it — one of the pair would be arbitrary, and neither leads anywhere without a bar. §7. |
| `plank`, `side_bridge` | Different planes; `side_bridge` has no instructions. §8. |
| `push_up_wide` | A near-duplicate of `pushups`. Unchanged from the original curation. |

---

## 11. What the test can and cannot say

The old `tests/ladders.test.ts` asserted referential integrity, no double membership, at least
two rungs, one category per chain, and that `level` never falls. All of that was true of the
squat chain and of the push-up cliff. **"Never gets easier" is a much weaker claim than "each
rung is the next step",** and only the second is good enough to move somebody automatically.

The reason it could not say more is that the file was a list of ids: every judgement lived in a
prose comment, where no assertion could reach it. So the judgement moved into the data — each
step now carries a mechanism, an evidence tag and a note — and the test checks it.

**What it now checks, and what each check would have caught:**

| Assertion | Would have caught |
|---|---|
| Every step has a mechanism, an evidence tag and a note | Nothing automatically — but nothing else can enforce "say what the evidence is". |
| No step is tagged `folklore` | A rung the app steers by resting on a claim nobody has tested. |
| A chain never *adds* gated equipment as it rises | The hanging leg raise offered to somebody with no bar. §7. |
| One primary muscle throughout | `butt_lift_bridge`(glutes) → `floor_glute_ham_raise`(hamstrings); `scapular_pull_up`(traps) → `inverted_row`(middle back) → `chin_up`(lats). §2, §5. |
| One `defaultMetric` throughout | A reps chain turning into a duration one. |
| Only a `limb_count` step may change `unilateral` | `single_arm_push_up` and `side_bridge` arriving without the unit change being declared. §1, §8. |
| Every rung has instructions | `side_bridge`. §8. |
| Where `level` falls, the step says why | The dip chain, which the *old* assertion would have rejected outright. §3. |

**What it cannot check, and where the comment in the test says so rather than letting an
assertion imply coverage:**

- **That the size of a step is right.** This is the whole substance of the audit and it is
  unenforceable: nothing in the catalog encodes effective load, so no assertion can distinguish
  a 16% step from a 100% one. Ebben's numbers exist for the push-up chain and nowhere else. The
  notes are the record; the test's only power over them is to insist they exist.
- **That an ordering holds for a particular person.** A chin-up before a pull-up is a
  population tendency. Some users will find them the other way round, and nothing in a log can
  tell the app so.
- **That a chain is complete.** The test cannot know that a pike push-up is missing. Only a
  person reading the catalog can, which is what §4.1's "hand-authored, and a file a person is
  expected to argue with" is for.
- **That an exercise is on the right chain at all.** Same-category, same-muscle and
  same-metric are necessary and nowhere near sufficient: the walking lunge passed all three.
