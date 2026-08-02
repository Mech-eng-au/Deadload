/**
 * Plain English for the seventeen muscle names in the catalog (§4.6).
 *
 * **Moved here from `src/lib/catalog/muscles.ts` on 2026-08-02** by §16. That
 * file keeps what is structural — the closed list of ids, the usage counts, the
 * lookups — and this one keeps what is editorial, which is the part a second
 * language has to restate. The split is the same one `equipment.ts` gets, and
 * the same one the catalog itself already had: generated data in one place,
 * writing a person is expected to argue with in another.
 *
 * The vocabulary is closed: free-exercise-db uses exactly these seventeen, and
 * `tests/muscles.test.ts` fails if the catalog ever names one that is missing
 * from a locale.
 */
export const muscles = {
	title: 'Muscles',
	intro:
		'The catalog names muscles the way an anatomy book does. Here is each one in plain English, and where to find it on yourself. Tap one to see it on the diagram.',
	whatTheyMean: 'What all these muscle names mean',
	trains: (n: number) => (n === 1 ? '1 exercise' : `${n} exercises`),
	assisting: (n: number) => `+${n} assisting`,
	showExercises: 'Show the exercises that train it →',
	onlyAssists: 'Nothing in this catalog trains it directly — it only ever assists.',
	onTheFigure: (approximation: string) => `On the figure this ${approximation}.`,
	works: 'Works',
	assists: 'Assists',
	/** "quadriceps (front of thigh)" — the inline form, for lists of muscles. */
	withHint: (label: string, short: string) => `${label.toLowerCase()} (${short})`,

	names: {
		abdominals: {
			label: 'Abdominals',
			short: 'stomach',
			where: 'The front of your stomach, between the ribs and the hips.',
			does: 'Curls your trunk forwards, and stops it arching when you hold a plank.'
		},
		abductors: {
			label: 'Abductors',
			short: 'outer hip',
			where: 'The outer hip, at the side of your bottom.',
			does: 'Takes the leg out sideways, and keeps your hips level when you stand on one leg.'
		},
		adductors: {
			label: 'Adductors',
			short: 'inner thigh',
			where: 'The inner thigh, running up into the groin.',
			does: 'Pulls the leg back in towards the other one. What a wide squat stretches.'
		},
		biceps: {
			label: 'Biceps',
			short: 'front of upper arm',
			where: 'The front of the upper arm, between shoulder and elbow.',
			does: 'Bends the elbow. Does most of the extra work in a chin-up over a pull-up.'
		},
		calves: {
			label: 'Calves',
			short: 'back of lower leg',
			where: 'The back of the lower leg, between knee and heel.',
			does: 'Points the foot down: every step, every jump, every heel raise.'
		},
		chest: {
			label: 'Chest',
			short: 'front of ribs',
			where: 'Across the front of the ribs, below the collarbone.',
			does: 'Pushes your arms forwards and inwards. The main muscle of a push-up.'
		},
		forearms: {
			label: 'Forearms',
			short: 'elbow to wrist',
			where: 'Between the elbow and the wrist, all the way round.',
			does: 'Grip, and the wrist. Usually what gives out first on a long hang.'
		},
		glutes: {
			label: 'Glutes',
			short: 'bottom',
			where: 'Your bottom, from the top of the hip down to the thigh.',
			does: 'Straightens the hip: standing up out of a squat, and every bridge.'
		},
		hamstrings: {
			label: 'Hamstrings',
			short: 'back of thigh',
			where: 'The back of the thigh, from the bottom down to behind the knee.',
			does: 'Bends the knee, and helps the glutes straighten the hip. What a toe-touch stretches.'
		},
		lats: {
			label: 'Lats',
			short: 'sides of back',
			where: 'The broad sheet down the sides of the back, starting under the armpit.',
			does: 'Pulls the arms down and in towards the body. The muscle a pull-up is really about.'
		},
		'lower back': {
			label: 'Lower back',
			short: 'above the belt',
			where: 'Either side of the spine, above the belt.',
			does: 'Holds the spine straight. Mostly braces rather than moves, which is why it is trained with holds.'
		},
		'middle back': {
			label: 'Middle back',
			short: 'between shoulder blades',
			where: 'Between the shoulder blades.',
			does: 'Squeezes the shoulder blades together. This, not the arms, is what a row trains.'
		},
		neck: {
			label: 'Neck',
			// The one name that needs no translating in English, so the hint gives the
			// location instead of restating the word.
			short: 'front, back and sides',
			where: 'The front, back and sides of the neck.',
			does: 'Holds your head up and turns it.'
		},
		quadriceps: {
			label: 'Quadriceps',
			short: 'front of thigh',
			where: 'The front of the thigh, from hip to kneecap.',
			does: 'Straightens the knee: squats, lunges, and every flight of stairs.'
		},
		shoulders: {
			label: 'Shoulders',
			short: 'cap of the arm',
			where: 'The cap sitting on top of each arm, front, side and back.',
			does: 'Lifts the arm in any direction, and overhead most of all.'
		},
		traps: {
			label: 'Traps',
			short: 'neck to shoulders',
			where: 'From the back of the neck out to each shoulder, and down between the blades.',
			does: 'Shrugs the shoulders, and holds the shoulder blades back and down.'
		},
		triceps: {
			label: 'Triceps',
			short: 'back of upper arm',
			where: 'The back of the upper arm, between shoulder and elbow.',
			does: 'Straightens the elbow: push-ups, dips, and any press.'
		}
	},

	/**
	 * Where the body figure is coarser than the word (§4.6). Shown to the user
	 * rather than fudged silently, so these are copy and belong in the locale.
	 */
	approximated: {
		lats: 'shares the upper-back region with the middle back',
		'middle back': 'shares the upper-back region with the lats',
		abductors: 'is shown on the glutes, where gluteus medius actually sits'
	}
};
