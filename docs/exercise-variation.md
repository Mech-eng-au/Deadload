# Exercise Variation and Accommodation in Resistance Training

**A reference for algorithm design, written for a reader who can read a paper but doesn't know the jargon.**

---

## 0. How to read this

Every substantive claim carries one of four tags:

| Tag | Means |
|---|---|
| **[well established]** | Multiple independent trials or a systematic review agree; I'd be surprised if it reversed. |
| **[reasonable inference]** | Follows from established findings plus mechanism, but hasn't been tested directly. |
| **[contested]** | Trials disagree, or the finding rests on one small study, or the analysis is weak. |
| **[folklore]** | Widely repeated, no supporting trial, and often traceable to a commercial source. |

Two structural warnings about this entire literature before you start:

**Warning 1 — the population is startlingly narrow.** The systematic review of exercise variation (Kassiano et al. 2022) found eight eligible studies, total N = 241, **all young men**. The single largest trial in women (Kassiano et al. 2024, n = 70) appeared two years later. Almost everything below is: young, healthy, 18–30, gym-based, 4–12 weeks. Nothing runs long enough to observe an actual plateau.

**Warning 2 — a recurring analytical error.** Several papers report that a *varied* group grew significantly at all measured sites while a *fixed* group didn't grow significantly at one or two sites, and conclude variation is better. That is comparing within-group p-values, not testing a between-group difference. It is not evidence of a difference. This error appears in Fonseca 2014 and Costa 2021, and is then repeated in reviews and blog posts as if it were a finding. Watch for it.

---

## 1. Accommodation, the repeated-bout effect, and diminishing returns

Three different phenomena get collapsed into "the body adapts and the exercise stops working." They are not the same thing and only one of them is well established.

### 1a. The repeated-bout effect (RBE)

After an unaccustomed bout — especially eccentric-biased work — a second identical bout produces markedly less soreness, less strength loss, less creatine kinase leakage. Protection appears after a single bout and persists for weeks.

**[well established]** — Hyldahl, Chen & Nosaka 2017, *Exerc Sport Sci Rev* 45(1):24–33. <https://pubmed.ncbi.nlm.nih.gov/27782911/>. Original demonstration: Nosaka & Clarkson 1995, *Med Sci Sports Exerc* 27(9):1263–9.

**Population:** predominantly young healthy adults, lab protocols (maximal eccentric elbow flexion, downhill running). Mechanisms proposed: neural, mechanical, extracellular-matrix remodelling, biochemical signalling — the review is explicit that mechanisms remain poorly understood.

**What people get wrong:** RBE is about *damage*, not about *growth stimulus*. It says the same exercise hurts less the second time. It does **not** say the same exercise builds less muscle the second time. Treating reduced soreness as evidence of reduced stimulus is the single most common inferential error in this space. **[folklore]** for "less sore means less effective."

### 1b. Attenuation of the acute molecular response

Damas et al. 2016 (*J Physiol* 594(18):5209–22, <https://doi.org/10.1113/JP272472>) measured myofibrillar protein synthesis and muscle damage in untrained young men at weeks 1, 3 and 10 of training. The protein-synthesis spike was largest at week 1, lower at week 3, and similar at weeks 3 and 10. Damage was highest at week 1 and minimal by week 10.

**[well established]** that the acute response attenuates. **But the authors' interpretation runs opposite to the "accommodation" story:** the week-1 spike was largely repair of damage, and protein synthesis only *correlated with actual hypertrophy* once damage had subsided. The early large response was noise, not signal. Same group: Damas et al. 2016, *Eur J Appl Physiol* 116(1):49–56 — early increases in muscle cross-sectional area are substantially oedema, not tissue. <https://pubmed.ncbi.nlm.nih.gov/26280652/>

Practical consequence for you in §5: **the first ~3 weeks of any novel stimulus produce measurements you should not trust.**

### 1c. Diminishing returns with training age

Rates of strength and hypertrophy gain fall as a trainee becomes more trained. **[well established]** as a population-level observation, restated in essentially every review (e.g. Fonseca et al. 2023, *Transl Sports Med*, <https://doi.org/10.1155/2023/9507977>).

**What is not established:** that this is caused by *the exercises staying the same*, or that changing exercises reverses it. That is the causal step everyone assumes and nobody has tested.

### 1d. "Accommodation" as a training principle

The term comes from Soviet-lineage strength theory, popularised in English by Zatsiorsky & Kraemer's *Science and Practice of Strength Training*: the response of a biological system to a constant stimulus decreases over time. It is a general biological principle imported by analogy.

**[contested], leaning [folklore] in its specific application.** No controlled trial has demonstrated a plateau in a fixed-exercise-selection group that was subsequently broken by changing the exercise. The trials that compared fixed and varied selection (§4) ran 8–12 weeks and found fixed groups still progressing at the end. The principle may be true on some longer timescale; nobody has looked.

> **What your app cannot say from §1:** "You've adapted to this exercise." "Your body has stopped responding to push-ups." "It's time to switch." There is no measurement in a training log that distinguishes accommodation from under-recovery, under-eating, a bad week, or measurement noise, and no trial establishing that accommodation to a specific exercise happens at all on a 3-month scale.

---

## 2. "Muscle confusion"

### Where it came from

The concept is one of Joe Weider's numbered training principles, in circulation in bodybuilding magazines from roughly the 1960s and codified in *Joe Weider's Bodybuilding System* (1980s editions). Secondary sources quote the 1988 edition as saying that muscles "should never accommodate" and that constantly varying exercises, sets, reps and angle of pull prevents them from adjusting to the stress. It reached mass market through Tony Horton's P90X in the 2000s, where "Muscle Confusion" was the central marketing claim.

**This is a marketing term, not a physiological one.** Weider's magazines sold supplements and training systems; P90X sold DVDs. That does not make the claim false, but it does mean the burden of proof was never on anyone who profited from it. The framing is also incoherent on its face: muscles have no representational state that can be confused. What the phrase gestures at — regional stimulus distribution, and novelty-induced soreness misread as growth — is discussed in §1a and §3.

**[folklore]** — for the mechanism as stated.

### What happened when it was tested

**Baz-Valle et al. 2019**, *PLoS One* 14(12):e0226989. <https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0226989>

- 21 resistance-trained men, 8 weeks, 4 sessions/week, 3 sets × 6 exercises.
- Control: fixed exercises and rep ranges. Experimental: exercises **and** rep ranges randomised each session by an app. This is about as close to a literal test of "muscle confusion" as exists.
- **Result:** both groups increased bench and squat 1RM substantially, **no between-group difference**. Vastus lateralis and rectus femoris thickness increased in both, **no between-group difference**. Vastus intermedius reached significance from baseline only in the fixed group (again, a within-group comparison — don't over-read it).
- **The one significant between-group finding was psychological:** intrinsic motivation improved moderately in the randomised group and declined non-significantly in the fixed group.

**Kassiano et al. 2024**, *Res Q Exerc Sport* 96(2):371–381. <https://doi.org/10.1080/02701367.2024.2409961>

- 70 young women (mean 21.8 y), 10 weeks, 3×/week. Constant group did leg press + stiff-leg deadlift every session; varied group rotated through three different exercise pairs across the week.
- **Result:** muscle thickness increased similarly (constant +7.8–17.7%, varied +7.5–19.3%, p > 0.05 between groups). 1RM increased similarly.

**Bottom line: [well established] that randomising or rotating exercise selection does not produce more muscle or more strength than keeping it fixed, over 8–12 weeks, in young adults.** The claim that variation *per se* drives growth has been directly tested twice and failed twice.

**[contested] but plausible:** variation improves adherence and enjoyment. One trial (n = 21) found a moderate motivation effect. That's thin, but it is the only place variation showed a measured advantage, and it is the honest reason to offer it.

---

## 3. Regional hypertrophy

This is where the real signal is, and it is narrower than the folklore version.

### The phenomenon exists

Muscles do not grow uniformly. Growth differs along the proximal–distal axis of a muscle and between anatomically separate heads, in response to different exercises.

**[well established]** — Zabaleta-Korta, Fernández-Peña & Santos-Concejero 2020, "Regional Hypertrophy, the Inhomogeneous Muscle Growth: A Systematic Review," *Strength Cond J* 42(5):94–101. <https://doi.org/10.1519/SSC.0000000000000574>. Proposed mechanisms: non-uniform activation within a muscle, variation in pennation angle, regional differences in strain.

Older, frequently miscited: Antonio 2000, "Nonuniform response of skeletal muscle to heavy resistance training: can bodybuilders induce regional muscle hypertrophy?" *J Strength Cond Res* 14:102–113 — this is a **review/hypothesis paper**, not an experiment, and is routinely cited as though it demonstrated something.

### How large is the effect, and what actually drives it?

The largest and cleanest differences come from **the muscle length at which the work is done**, not from "different exercise" in the abstract.

**Maeo et al. 2023** (triceps), *Eur J Sport Sci* 23(7):1240–1250. <https://doi.org/10.1080/17461391.2022.2100279>
- 21 adults, within-subject (one arm each condition), cable elbow extension at 70% 1RM, 5 sets × 10 reps, 2×/week, **12 weeks**, MRI-measured muscle volume. Within-subject design removes between-person variance — methodologically strong.
- Overhead (long-head lengthened) vs neutral arm position: long head **+28.5% vs +19.6%** (1.5×, d = 1.27); lateral+medial heads +14.6% vs +10.5% (1.4×); whole triceps +19.9% vs +13.9% (1.4×). All p ≤ 0.002.
- **And this happened with 34–39% lower absolute loads in the overhead condition.**

**Maeo et al. 2021** (hamstrings), *Med Sci Sports Exerc* 53(4):825–837. Seated (hip-flexed, long) vs prone leg curl, within-subject, n = 20 legs/condition, 12 weeks. Greater hypertrophy at long length in the three biarticular hamstring muscles; equivalent in the monoarticular one — exactly the pattern the length hypothesis predicts.

**[well established]** that training a biarticular muscle at longer lengths produces more growth in that muscle. Effect magnitude ~1.4–1.5×, which is large by resistance-training standards. Caveats: each of these is essentially one study per muscle group, n ≈ 20, healthy young adults, machine/cable exercises, 12 weeks.

**Contrast with a null:** dumbbell vs cable lateral raise produced no region-specific differences in the lateral deltoid (Frontiers in Physiology 2025, <https://doi.org/10.3389/fphys.2025.1611468>). Exercises that differ in *equipment or resistance profile* but not much in *muscle length* do not reliably differ regionally.

### The step the folklore takes that the evidence does not

Regional differences are **along the length of a muscle and between anatomically distinct heads.** They are not arbitrary sub-regions. "Inner chest," "lower biceps peak," "upper abs" as independently addressable targets: **[folklore]**. The measurement tools in most of this literature are ultrasound thickness at two or three sites — coarse and noisy; only the Maeo studies used MRI volume.

### The detail nobody quotes

Maeo's own discussion concludes that because *both* conditions produced the same *pattern* (long head > other heads), there is likely **no need to combine the two exercises** — just use the better one. **The strongest "different exercises bias different regions" study argues for picking the superior exercise, not for rotating.** That is a coverage argument, not a variation argument, and the distinction matters enormously for what your app should do.

---

## 4. Systematic vs random variation: what the trials found

| Study | Population | Duration | Design | Result |
|---|---|---|---|---|
| **Fonseca 2014** <br>*J Strength Cond Res* 28(11):3085–92 | 49 physically active individuals (this literature is all young men per Kassiano 2022) | 12 wk, 2×/wk | 4 groups: constant/varied intensity × constant/varied exercise, + control | Whole-quadriceps CSA (MRI) rose **similarly in all groups** (9.5–12.2%). Constant-intensity/varied-exercise gained most squat 1RM. Per-head "coverage" claim is a within-group significance pattern, n ≈ 10/group. |
| **Baz-Valle 2019** <br>*PLoS One* 14:e0226989 | 21 trained men | 8 wk, 4×/wk | Fixed vs randomised-per-session | **Null** on 1RM and muscle thickness. Motivation higher in varied group. |
| **Rauch 2020** <br>*J Strength Cond Res* 34(4):1133–40 | 17 strength-trained men (squat 1.87× BW) | 9 wk, 3×/wk | Self-selected (autoregulated) vs fixed exercise | Self-selected group did **significantly more total volume load** (573k vs 465k kg) and showed small LBM/bench advantages. **Confounded — this is a volume comparison, not a variation comparison.** |
| **Costa 2021** <br>*Int J Sports Med* 42(9):803–11 | 22 detrained young men | 9 wk, 3×/wk | Same vs varied exercises per muscle group | Varied group significant at all sites; fixed group missed two. **Within-group significance pattern again — no between-group test reported as a difference.** |
| **Kassiano 2024** <br>*Res Q Exerc Sport* 96(2):371–81 | 70 young women | 10 wk, 3×/wk | Constant vs systematically varied | **Null** on thickness and 1RM. |

**Systematic review:** Kassiano et al. 2022, *J Strength Cond Res* 36(6):1753–62. <https://doi.org/10.1519/JSC.0000000000004258>. Eight studies, N = 241, all young men, methodological quality good-to-excellent. Conclusion: some systematic variation may enhance regional adaptations and dynamic strength; excessive random variation may compromise gains.

**Read that conclusion carefully.** It is a narrative synthesis, not a pooled effect estimate — no meta-analysis was performed. The "excessive random variation may compromise gains" half is an inference from the specificity principle, **not a finding**: the one trial that actually randomised exercises found no decrement. **[contested]** at best.

### The honest summary of §4

**[well established]:** over 8–12 weeks in young adults, fixed and varied exercise selection produce equivalent hypertrophy and equivalent strength gains, when volume is equated. Neither harms the other.

**[reasonable inference]:** where a difference might exist, it is in *which parts* of a muscle grow, not *how much* total, and it is driven by muscle length, not novelty.

**[not established]:** that random variation is harmful. That systematic variation is beneficial for total growth. Any dose–response for "how much" variation.

---

## 5. The cost of variation

This is the section the training literature under-weights and an app designer must not.

### 5a. Motor learning contaminates early performance

Performance on a strength test improves from *practising the test*, independently of any adaptation.

- **Ploutz-Snyder & Giamis 2001**, *J Strength Cond Res* 15(4):519–23. Knee-extension 1RM, repeated sessions until performance stopped improving. Young women: 3–4 sessions, total improvement **12%**. Older women: 8–9 sessions, total improvement **22%**. Pure practice.
- **Nuzzo, Taylor & Gandevia 2019**, "CORP: assessments of upper- and lower-limb muscle strength and voluntary activation in humans," *J Appl Physiol*. Reviewing ~20 reliability studies: session 1→2 gains up to ~5% (bench press, biceps curl), up to ~10% (back squat); some tests still climbing on days 3–4, occasionally by ~20%. **One familiarisation session does not eliminate it.** Present in men and women, young and old, trained and untrained.
- **Critically:** no learning effect was found for isometric or isokinetic tests. **The learning effect scales with the coordination demand of the task.** **[well established]**
- **Ritti-Dias et al. 2011**, *J Strength Cond Res*, <https://pubmed.ncbi.nlm.nih.gov/21522076/>. 30 men. Untrained group's bench 1RM rose 3.8% / 7.4% / 10.1% across sessions 2, 3, 4; squat 7.6% / 10.1% / 11.2%. **Trained men were stable after session 1; untrained were not stable by session 4.** **[well established]**

### 5b. Strength on a task is substantially practice

**Mattocks et al. 2017**, *Med Sci Sports Exerc* 49(9):1945–54. <https://pubmed.ncbi.nlm.nih.gov/28463902/>. 38 untrained individuals, 8 weeks. One group did 4 sets to failure; the other **only performed 1RM attempts** (up to 5 singles per visit). **Strength gains were equivalent.** Only the high-volume group gained size.

**[well established]** that measured strength on a specific movement is heavily driven by repeated exposure to that movement. For your app this means "your max push-ups went from 12 to 18" partly measures *push-up skill*. That is a legitimate outcome to celebrate — it just isn't a general strength claim, and it isn't transferable to a different variant.

**Transfer is limited:** Saeterbakken et al. 2025, *Sports Med* 55(7):1651–76, <https://doi.org/10.1007/s40279-025-02225-2> — dynamic resistance training transfers to the trained dynamic task considerably better than to untrained isometric strength. **[well established]** that strength is task-specific.

### 5c. How long before a new exercise gives a trustworthy measurement?

Nobody has studied this for reps-to-failure on bodyweight variants. What follows is **[reasonable inference]** from the 1RM familiarisation literature:

| Situation | Sessions before the number stabilises |
|---|---|
| Trained user, low-coordination variant (incline push-up → push-up) | ~2 |
| Trained user, high-coordination variant (single-arm push-up, front lever, pistol squat) | ≥4, plausibly many more — these are skill acquisitions |
| Novice, any variant | ≥4, possibly 6+ |
| Muscle-size measurement after a novel stimulus | ~3 weeks minimum (Damas 2016 — before that you're partly measuring oedema) |

**A defensible default for an app: treat the first 3 sessions of any newly introduced exercise as calibration.** Record them; exclude them from trend fitting and from "personal best" or "you're getting stronger" messaging. Bias longer for skill-heavy variants.

### 5d. Loss of comparable data — the statistical cost

This is arithmetic, not physiology, and it's the part you're best placed to reason about:

- Each exercise is a **separate measurement channel** with its own bias, its own noise floor, and its own learning transient.
- 1RM test–retest reliability is good once stabilised — median ICC 0.97, **median CV 4.2%** across 32 studies (Grgic et al. 2020, *Sports Med Open*, <https://doi.org/10.1186/s40798-020-00260-z>). A single-session change under ~5% is inside the noise.
- **Reps-to-failure is worse, because reps are integers.** At 8 reps, one rep is a 12.5% step. At 25 reps, it's 4%. Your low-rep, high-leverage variants have the *coarsest* measurement resolution and the *longest* learning transients simultaneously.
- Rotating exercises divides your observations across more channels. Fewer points per channel + a discarded calibration window per channel = a much longer time to detect a real trend. **This cost is real, quantifiable, and entirely absent from the training literature.**

### 5e. Technique quality and injury

Frequently asserted that high variation degrades technique and raises injury risk. **[folklore] as an evidence claim.** There is no controlled comparison of injury rates between high- and low-variation resistance training programmes. The mechanistic argument (less practice per movement → worse execution) is plausible and consistent with §5a, but plausible is not evidence. An app should not make injury-prevention claims about variation policy in either direction.

---

## 6. Cadence: on what timescale, if at all?

**The direct answer: the periodisation literature does not address this.** Periodisation trials manipulate *load and volume*; they almost never manipulate *exercise selection*. Citing them for exercise-rotation cadence is a category error that appears constantly in coaching material.

What the periodisation literature does show:

- **Williams et al. 2017**, *Sports Med* 47(10):2083–2100 — periodised beat non-periodised for maximal strength, **but volume was not equated**, so periodised groups often simply did more.
- **Moesgaard et al. 2022**, *Sports Med* 52(7):1647–66, <https://doi.org/10.1007/s40279-021-01636-1> — the volume-equated replication. Periodising volume and intensity **had no effect on hypertrophy**; any strength effect the authors attribute to neural/skill factors rather than tissue adaptation.
- **Grgic et al. 2017**, *PeerJ* 5:e3695, <https://peerj.com/articles/3695/> — linear vs daily-undulating periodisation: **similar hypertrophy**. Mostly untrained participants; the authors call for trained-population work.

**[well established]:** when total volume is equated, the *pattern* in which load is varied makes little to no difference to hypertrophy.

**[not established] — and this is the honest answer to your question:** the optimal cadence for changing *exercises* is unknown. Here's the whole evidence base on cadence, laid out:

| Cadence tested | Study | Outcome vs fixed |
|---|---|---|
| Every session, randomised | Baz-Valle 2019 | Equivalent |
| Every session, systematic (3 pairs/week) | Kassiano 2024 | Equivalent |
| Self-selected per session | Rauch 2020 | Small advantage, confounded by volume |
| Per block / mesocycle | Fonseca 2014 | Equivalent for size; varied-exercise better for squat 1RM |
| Never | all control arms | Fine |

**Every cadence from "every session" to "never" produced roughly equivalent size and strength over 8–12 weeks.** If you want a rule for cadence, the evidence gives you nothing to anchor to. The only defensible constraint is the one from §5: **whatever cadence you choose, it must be long enough for the measurement to stabilise.** That is a data-quality argument, not a physiological one, and you should label it as such in your app.

Also note the timescale mismatch: an 8–12 week trial cannot detect a difference that only emerges at 6–24 months. Absence of evidence here is genuinely absence of evidence, not evidence of absence.

---

## 7. How much of this transfers to bodyweight training?

### Say this plainly: there is no direct evidence.

**Zero trials have compared fixed vs varied exercise selection in bodyweight training.** Every study in §4 used barbells, machines or cables. Every study in §3 used cables, machines or free weights. The regional-hypertrophy work uses cable machines and MRI. **If your app makes a variation claim, it is extrapolating across the entire equipment gap.**

### What plausibly transfers

**Mechanism.** Bodyweight training produces comparable strength and hypertrophy to loaded training in short trials, so there's no reason to think the underlying biology differs. **[reasonable inference]**, from three small studies:

- **Kotarsky et al. 2018**, *J Strength Cond Res* 32(3):651–9. 23 moderately trained men, 4 weeks, 3×/week. Progressive push-up ladder vs bench press: similar muscle thickness and strength gains; push-up group better on push-up-specific measures. **n = 14 vs 9, four weeks — inside the learning window from §5.**
- **Calatayud et al. 2015**, *J Strength Cond Res* 29(1):246–53. Bench press vs band-loaded push-up at EMG-matched activation, ~5 weeks: similar strength gains.
- **Wei et al. 2023**, *Sci Rep* 13:13505, <https://doi.org/10.1038/s41598-023-40319-x>. Progressive bodyweight (10-level ladder, bilateral → unilateral) vs barbell squat, 6 weeks. **n = 6 vs 7.** Similar isokinetic peak torque gains. This is a pilot, and should be treated as one.

**The muscle-length logic (§3).** This is mechanical, not equipment-dependent. A dip and a push-up place the pec and triceps long head at different lengths; a chin-up and an inverted row differ likewise. **[reasonable inference]** that length-driven regional effects apply to bodyweight variants — but no one has measured it.

### What does *not* transfer, and where you're on your own

**1. Load granularity.** A barbell moves in 1.25 kg steps — 1–2% of the load. A leverage ladder rung is 10–30%+, and the step from a two-arm to a one-arm variant is roughly a doubling. **The entire load-progression literature assumes fine-grained load.** Nothing tells you how to manage coarse, unequal steps. **[not established]**

**2. Progression and variation are the same act.** In barbell training you can hold the exercise constant and vary the load. In a bodyweight ladder, progressing *is* changing the exercise — with a fresh learning transient and a fresh discontinuity in your data. **A "no variation" policy is not implementable in a leverage-based system.** The literature has no concept of this. Your eight ladders are structurally variation systems whether or not you call them that.

**3. Reps cannot be mapped to intensity.** Nuzzo et al. 2023, *Sports Med*, <https://doi.org/10.1007/s40279-023-01937-7> — meta-regression over 952 repetitions-to-failure tests, 7289 individuals, 269 studies. The reps-at-a-given-%1RM relationship carries large between-individual variation and is moderated by exercise. **[well established]** that you cannot infer relative intensity from a rep count, and there are no bodyweight movements in that dataset at all. Do not build a %1RM estimate.

**4. Load is coupled to body mass.** Relative load drifts with weight change even when nothing else does. Log body mass if you want to interpret trends honestly; don't claim precision.

**5. Skill-dominant variants.** Front lever, planche, one-arm push-up: progress here is dominated by motor learning for a long time (§5a). Strength inferences from them are weak.

**6. Your non-strength categories.** The variation literature is exclusively about resistance training for strength and size. **Nothing in it supports any variation rule for stretching, mobility, or cardio.** If your app varies those, that's a UX decision, and it should be presented as one.

---

## 8. The five rules I would encode

1. **Treat exercise change as a progression event, not a scheduled refresh.**
   Move up a ladder rung when the performance criterion is met; do not rotate on a timer. Grounded in: no trial shows fixed selection underperforms (§4); specificity (§5b); measurement cost (§5d). This also matches how your ladders are already built.

2. **Enforce *coverage*, not *rotation*, across the exercise pool.**
   Check that the selected exercises include a long-muscle-length option for biarticular muscles — e.g. an overhead/shoulder-flexed triceps position, a hip-flexed hamstring position, a deep-shoulder-extension pressing position. This is the one claim with genuinely large effect sizes behind it (§3), and it is a static property of the pool, verifiable once, not a schedule. Note Maeo's own conclusion: pick the better exercise rather than combining both.

3. **Mark the first 3 sessions of any newly introduced exercise as "calibrating."**
   Record them, display them greyed, exclude them from trend fitting and from PR/streak/"getting stronger" messaging. Widen the window for variants you flag as high-coordination. **[reasonable inference]** from §5a/§5c — label it in your own docs as a data-quality heuristic, not a physiological finding.

4. **Never compute or display a cross-exercise comparison.**
   No unified strength score, no estimated 1RM, no "equivalent to X kg", no "you're 80% of the way to the next variant." Each exercise is its own channel (§5b, §5d, §7.3). If you want a global progress view, show ladder position, not an inferred number.

5. **Offer variation as an explicit adherence feature, honestly labelled.**
   The single measured benefit of variation was intrinsic motivation (Baz-Valle 2019, n = 21). So: if the user is bored or stalling on adherence, offer a rotation and say *why* — "this won't build more muscle, but people who rotate report enjoying training more." If they're progressing steadily, don't interrupt them. This is the rare case where being honest about weak evidence makes the feature better rather than worse.

---

## 9. The five things the app should refuse to claim

1. **"You've plateaued because your body adapted to this exercise — time to switch."**
   No trial has demonstrated exercise-specific accommodation or rescue-by-variation (§1d). And no signal in a training log distinguishes accommodation from under-recovery, poor sleep, under-eating, or noise.

2. **"Varying your exercises builds more muscle" / any form of muscle confusion.**
   Directly tested twice (Baz-Valle 2019, Kassiano 2024) and null both times (§2, §4).

3. **Any anatomical targeting claim finer than "this variant loads muscle X at a longer length."**
   No "hits your upper chest," no "isolates the long head by 40%," no percentage attributions. Regional effects are real, coarse, mostly length-driven, and quantified in a handful of n≈20 machine-based studies (§3).

4. **Any intensity or load inference from bodyweight rep counts.**
   No %1RM, no RM-equivalents, no cross-variant load ratios (§7.3). RPE that the user enters is a user report — report it back, don't convert it.

5. **Any injury-prevention or technique claim tied to variation policy.**
   "Rotating prevents overuse injuries" and "sticking to one exercise causes imbalances" are both unsupported — there is no controlled injury data comparing variation policies (§5e).

**One meta-rule worth encoding in your copy style:** where you make a design choice for data-quality or UX reasons, say so. "We hold this exercise for 3 sessions so the numbers settle" is defensible and true. "We hold this exercise for 3 sessions to maximise adaptation" is not.

---

## Reference list

**Accommodation / repeated-bout effect / time course**
- Hyldahl RD, Chen TC, Nosaka K (2017). *Exerc Sport Sci Rev* 45(1):24–33. <https://pubmed.ncbi.nlm.nih.gov/27782911/>
- Nosaka K, Clarkson PM (1995). *Med Sci Sports Exerc* 27(9):1263–9.
- Damas F et al. (2016). *J Physiol* 594(18):5209–22. <https://doi.org/10.1113/JP272472>
- Damas F et al. (2016). *Eur J Appl Physiol* 116(1):49–56. <https://pubmed.ncbi.nlm.nih.gov/26280652/>
- Zatsiorsky VM, Kraemer WJ. *Science and Practice of Strength Training* (book; source of the "accommodation" principle).

**Exercise variation trials and review**
- Kassiano W et al. (2022). *J Strength Cond Res* 36(6):1753–62. <https://doi.org/10.1519/JSC.0000000000004258>
- Kassiano W et al. (2024/25). *Res Q Exerc Sport* 96(2):371–81. <https://doi.org/10.1080/02701367.2024.2409961>
- Baz-Valle E et al. (2019). *PLoS One* 14(12):e0226989. <https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0226989>
- Fonseca RM et al. (2014). *J Strength Cond Res* 28(11):3085–92. <https://pubmed.ncbi.nlm.nih.gov/24832974/>
- Rauch JT et al. (2020). *J Strength Cond Res* 34(4):1133–40. <https://doi.org/10.1519/JSC.0000000000002272>
- Costa BDV et al. (2021). *Int J Sports Med* 42(9):803–11. <https://doi.org/10.1055/a-1308-3674>

**Regional hypertrophy**
- Zabaleta-Korta A, Fernández-Peña E, Santos-Concejero J (2020). *Strength Cond J* 42(5):94–101. <https://doi.org/10.1519/SSC.0000000000000574>
- Maeo S et al. (2023). *Eur J Sport Sci* 23(7):1240–50. <https://doi.org/10.1080/17461391.2022.2100279>
- Maeo S et al. (2021). *Med Sci Sports Exerc* 53(4):825–37. <https://doi.org/10.1249/MSS.0000000000002523>
- Antonio J (2000). *J Strength Cond Res* 14:102–113. *(review, not a trial)*

**Motor learning, measurement, specificity**
- Ploutz-Snyder LL, Giamis EL (2001). *J Strength Cond Res* 15(4):519–23.
- Nuzzo JL, Taylor JL, Gandevia SC (2019). CORP. *J Appl Physiol*.
- Ritti-Dias RM et al. (2011). *J Strength Cond Res*. <https://pubmed.ncbi.nlm.nih.gov/21522076/>
- Mattocks KT et al. (2017). *Med Sci Sports Exerc* 49(9):1945–54. <https://pubmed.ncbi.nlm.nih.gov/28463902/>
- Grgic J et al. (2020). *Sports Med Open* 6:31. <https://doi.org/10.1186/s40798-020-00260-z>
- Saeterbakken AH et al. (2025). *Sports Med* 55(7):1651–76. <https://doi.org/10.1007/s40279-025-02225-2>
- Škarabot J et al. (2021). *Eur J Appl Physiol* 121(3):675–85. <https://doi.org/10.1007/s00421-020-04567-3>
- Nuzzo JL, Pinto MD, Nosaka K, Steele J (2023). *Sports Med*. <https://doi.org/10.1007/s40279-023-01937-7>

**Periodisation**
- Williams TD et al. (2017). *Sports Med* 47(10):2083–2100. <https://pubmed.ncbi.nlm.nih.gov/28497285/>
- Moesgaard L et al. (2022). *Sports Med* 52(7):1647–66. <https://doi.org/10.1007/s40279-021-01636-1>
- Grgic J et al. (2017). *PeerJ* 5:e3695. <https://peerj.com/articles/3695/>

**Bodyweight**
- Kotarsky CJ et al. (2018). *J Strength Cond Res* 32(3):651–9. <https://pubmed.ncbi.nlm.nih.gov/29466268/>
- Calatayud J et al. (2015). *J Strength Cond Res* 29(1):246–53.
- Wei W et al. (2023). *Sci Rep* 13:13505. <https://doi.org/10.1038/s41598-023-40319-x>

**Origin of "muscle confusion"** — Joe Weider's training principles, *Joe Weider's Bodybuilding System* (1980s editions); popularised by Tony Horton / P90X, Beachbody, 2000s. No primary scientific source exists; the wording quoted in §2 is as reported by secondary sources, not verified against the original edition.
