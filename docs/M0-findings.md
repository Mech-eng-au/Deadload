# M0 findings: data source verification

Date: 2026-07-25. This verifies the assumptions in [SPEC.md §5](./SPEC.md#5-catalog-build-script)
against the live data, before any build-script code exists. Numbers below were computed from
`dist/exercises.json` fetched from `yuhonas/free-exercise-db@main` (873 entries) and from the
fixture data in `wger-project/wger@master`.

## 1. free-exercise-db

### 1.1 The bodyweight pool

| Filter | Count |
|---|---|
| Total entries in `dist/exercises.json` | 873 |
| `equipment == "body only"` | 111 |
| `equipment == null` | 77 |
| **Combined bodyweight pool** | **188** |
| Of those, with at least one image | **188 (100%)** |
| Of those, with exactly two images | 188 (every entry has exactly 2) |

Every entry in the bodyweight pool has exactly two JPEG images (typically a start and end
position). **The spec's fear of a large "dropped for zero media" list does not materialize for
this source.** The drop-and-warn logic in the build script should stay — as a guard against
download failures — but it is expected to be empty for source 1.

The `null`-equipment entries are genuinely bodyweight (Cat Stretch, Child's Pose, Inverted Row,
Bodyweight Walking Lunge, wall calf stretches, etc.), so including `null` in the filter is
correct and roughly *doubles* the pool. Some obvious keepers still sit outside the filter under
`equipment: "other"` (Dips – Chest Version, Band Assisted Pull-Up, Bodyweight Mid Row), which
confirms the spec's explicit-include-list mechanism is needed. Pullups, Chin-Up, and
Dips – Triceps Version are already `"body only"`.

### 1.2 Breakdown by category and level (bodyweight pool, n=188)

| Category | beginner | intermediate | expert | Total |
|---|---:|---:|---:|---:|
| strength | 64 | 14 | 3 | 81 |
| stretching | 66 | 11 | 8 | 85 |
| plyometrics | 20 | 1 | 0 | 21 |
| cardio | 1 | 0 | 0 | 1 |
| **Total** | **151** | **26** | **11** | **188** |

### 1.3 Stretch and mobility vs strength

85 of 188 (45%) are `stretching` — the source is *not* thin on stretches, contrary to the
spec's expectation. By name inspection, roughly 57 are static holds and 28 are dynamic
mobility-style movements (circles, Inchworm, Groiners, World's Greatest Stretch, Frog Hops,
pelvic tilts, Windmills, …). Kneeling Hip Flexor, Cat Stretch, Child's Pose, and World's
Greatest Stretch — the backbone of the hip-flexibility and back-relief presets — are all
present with images.

What *is* thin: contemporary mobility programming (90/90 transitions, couch stretch, CARs,
deep squat pry). The `manual/*.yaml` own-content path is still justified, but for a narrower
gap than the spec assumed.

Also useful: 38 bodyweight strength entries have `primaryMuscles: abdominals` (the future
`core` category), and 63 entries have `force: "static"` — a good seed for
`defaultMetric: 'duration'`.

### 1.4 Schema vs SPEC §4.1 / §5 assumptions

All 873 entries carry the same 11 fields: `id`, `name`, `force`, `level`, `mechanic`,
`equipment`, `primaryMuscles`, `secondaryMuscles`, `instructions`, `category`, `images`.
Divergences from what the spec assumed:

| Spec assumption | Reality | Consequence |
|---|---|---|
| Images at `.../main/dist/exercises/<path>` | **404.** Images live at `.../main/exercises/<path>` | Build script must use the correct base URL (spec amended) |
| `level: 'advanced'` | Source uses `expert` | Map `expert → advanced` in the build script |
| `category` includes `stretch`, `mobility`, `core` | Source has `stretching`, `plyometrics`, `strongman`, `powerlifting`, `olympic weightlifting`, `strength`, `cardio` — no `mobility`, no `core` | `stretching → stretch` is mechanical; `mobility` and `core` must be assigned by hand per exercise |
| ids are snake_case slugs | ids like `3_4_Sit-Up` (mixed case, hyphens), unique | Re-slugify as planned; collision check stays |
| — | No `aliases`, `unilateral`, `defaultMetric`, image dimensions, captions | All four must be derived or hand-tagged; this is unbudgeted curation work (~120 entries), now noted in §5 |
| — | Extra fields `force`, `mechanic` | Free help: `force: static` seeds `defaultMetric: duration` |

## 2. wger

**Caveat: the wger API (`wger.de`) is unreachable from this development environment — the
network policy rejects the connection.** The findings below come from the database fixtures in
the `wger-project/wger` repository, which seed the production database. They are reliable for
structure and licensing, but **image coverage could not be verified** because the repo contains
no production image fixture (images exist only in the live database and media server).

| Question | Answer |
|---|---|
| Total exercise bases | 872 |
| Categories | Arms, Legs, Abs, Chest, Back, Shoulders, Calves, Cardio — **muscle groups only, there is no stretch or mobility category** |
| Bodyweight-only (no equipment, or only mat/bodyweight) | 546 |
| English names matching stretch/mobility keywords | 56 (53 of them bodyweight/mat-only) |
| Licenses on exercise bases | 719 × CC-BY-SA 4.0, 133 × CC-BY-SA 3.0, 20 × CC0 |
| Image coverage for stretches | **Unverified** — requires an API probe from an unrestricted network |

Structural conclusions that hold regardless of image coverage:

- **There is no category to filter stretches by.** Finding wger's stretch content means
  keyword-matching English names, which is brittle and needs manual review anyway. The ~53
  bodyweight stretch entries it might add overlap heavily with free-exercise-db's 85.
- The spec's "CC-BY-SA 3.0" blanket is wrong: the data is predominantly CC-BY-SA 4.0, with
  some 3.0 and CC0. Attribution records must carry the per-entry license (the §4.1 enum
  already covers 3.0/4.0; CC0 added).

## 3. Impact on the milestone plan

1. **M0's headline risk is retired, and replaced.** "Media sourcing fails" was the premise
   risk; in fact 188 bodyweight exercises ship with 2 images each, and the M0 exit criterion
   of 60 is exceeded 3× by source 1 alone before wger or manual content. The *actual* M0
   risks are now: (a) image quality/consistency — 800px JPEGs of unknown style, judge after
   the first WebP conversion run; (b) the hand-tagging pass (`unilateral`, `category` remap,
   `defaultMetric`) which no milestone budgeted.
2. **wger demoted from "source 2" to "optional, verify first".** No stretch category, heavy
   overlap with source 1, unverifiable image coverage from this environment, and CC-BY-SA
   share-alike obligations on any media taken from it. Do not build wger support in M0.
   A 30-minute API probe from an unrestricted network decides whether it ever gets built.
3. **The 120-exercise cap now does work.** With 188+ candidates the cap is a curation tool,
   not an aspiration. Curation (which 68+ to cut) is real M0 work.
4. **`manual/*.yaml` scope narrows** from "the two databases thin out badly on mobility work"
   to "modern mobility drills specifically". The 10–20 estimate stands but skews toward
   dynamic mobility, not static stretches.
