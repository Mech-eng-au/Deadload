// Data model per docs/SPEC.md §4. Metric units only; durations in whole seconds.
import type { Locale } from './i18n/index.js';

export type ExerciseId = string; // snake_case slug, e.g. "worlds_greatest_stretch"

export type Category = 'strength' | 'stretch' | 'mobility' | 'core' | 'cardio';
export type Level = 'beginner' | 'intermediate' | 'advanced';

/**
 * Things an exercise needs that a bedroom floor does not supply (§5.1). All but
 * `chair` are gated: unticked in Settings, they hide the exercise from catalog
 * browse and the exercise picker. A chair is furniture rather than a purchase,
 * so it is tagged and never gated.
 */
export type EquipmentId =
	| 'pull_up_bar'
	| 'jumping_rope'
	| 'dumbbells'
	| 'kettlebell'
	| 'resistance_band'
	| 'foam_roller'
	| 'yoga_ball'
	| 'suspension_trainer'
	| 'ab_wheel'
	| 'chair';

export interface Exercise {
	id: ExerciseId;
	name: string;
	aliases: string[];
	category: Category;
	/**
	 * Empty means a floor and a wall. An array rather than one value because a
	 * band-assisted pull-up needs a band *and* a bar, and one field cannot say so.
	 */
	equipment: EquipmentId[];
	primaryMuscles: string[];
	secondaryMuscles: string[];
	level: Level;
	unilateral: boolean;
	defaultMetric: 'reps' | 'duration';
	instructions: string[];
	media: MediaAsset[]; // length >= 1, enforced by build script
	attributionId: string;
}

export interface MediaAsset {
	kind: 'image' | 'video';
	path: string; // "/media/push_up/0.webp"
	caption?: string; // only when the source actually labels the frame; never inferred
	width: number;
	height: number;
}

export interface Attribution {
	id: string;
	source: 'free-exercise-db' | 'wger' | 'wikimedia' | 'body-highlighter' | 'noto-fonts' | 'own';
	license: 'PD' | 'CC0' | 'CC-BY-SA-3.0' | 'CC-BY-SA-4.0' | 'MIT' | 'OFL-1.1' | 'own';
	author?: string;
	sourceUrl?: string;
	/**
	 * What this credit is for, when it is not exercise media — the muscle figures
	 * of §4.6, for instance. Absent means "the exercises keyed to this id", which
	 * the About page can count for itself.
	 */
	covers?: string;
}

// ---------------------------------------------------------------- §4.2 routines

export interface Routine {
	id: string; // uuid
	name: string;
	description?: string;
	goal?: string; // free text, e.g. "hip flexibility"
	tags: string[];
	blocks: Block[];
	source: 'builtin' | 'imported' | 'user';
	createdAt: string; // ISO 8601
	updatedAt: string;
}

export interface Block {
	id: string;
	label?: string; // "Warm-up", "Main", "Cooldown"
	items: RoutineItem[];
	/**
	 * 'circuit' runs the block round-robin: one set of each item in order, then
	 * the next round. Absent means straight through, all sets of an item before
	 * the next. A superset is a two-item circuit block.
	 */
	mode?: 'circuit';
}

export interface RoutineItem {
	id: string;
	exerciseId: ExerciseId;
	sets: number; // >= 1
	target: Target;
	perSide: boolean; // overrides Exercise.unilateral if set
	restSeconds: number; // rest after each set
	tempo?: string; // e.g. "3-1-1-0", free text, display only
	notes?: string;
	/**
	 * Mass of the implement in kg, for an exercise that holds one (§4.5). What the
	 * routine *plans*, exactly as `target` plans the reps; what was actually
	 * lifted is on `SetEntry.loadKg`. Optional, so every routine written before
	 * this existed stays valid.
	 */
	loadKg?: number;
	/**
	 * When the user last said no to a progression suggestion for this item
	 * (§17.3). Suppresses it for 14 days.
	 *
	 * On the item rather than in Settings because it is a fact about *this
	 * exercise in this routine*, and it should travel through backup and restore
	 * with it. Without it the app asks again next session having learned nothing,
	 * which is how a helpful feature becomes nagging.
	 */
	progressDeclinedAt?: string;
}

export type Target =
	| { kind: 'reps'; reps: number }
	| { kind: 'reps_range'; min: number; max: number }
	| { kind: 'duration'; seconds: number }
	| { kind: 'amrap' }; // as many reps as possible

// ------------------------------------------------------------ §4.3 session log

export interface Session {
	id: string;
	routineId: string;
	routineName: string; // denormalized snapshot
	startedAt: string;
	endedAt?: string; // absent => abandoned or in progress
	entries: SetEntry[];
	notes?: string;
	/**
	 * When the log was last corrected by hand (§4.3). Absent means every row is
	 * exactly as the player wrote it. Statistics are built on this log, so one that
	 * can be silently rewritten is worth less than one that admits it was.
	 */
	editedAt?: string;

	// Timing is stored as wall-clock deadlines rather than counted down in
	// memory, so a timed set or a rest period survives the app being killed and
	// cannot drift while the screen is off. Both are cleared when the session
	// ends.
	/** When the current step began, for the count-up on a timed set. */
	activeStepStartedAt?: string;
	/** When the current rest period is due to end. */
	restEndsAt?: string;
	/**
	 * When a timed set was paused (§7). Pausing does not stop a counter — there
	 * is none — it records the moment, and resuming pushes `activeStepStartedAt`
	 * forward by however long the pause lasted, so the deadline stays wall-clock
	 * and survives the app being killed mid-pause.
	 */
	pausedAt?: string;

	/**
	 * Exercises substituted during this session: `RoutineItem.id` -> the
	 * exercise actually performed (§7). Stored on the session rather than
	 * applied to the routine, for two reasons: the routine is the user's, and
	 * changing it mid-workout without asking is not ours to do; and the swap has
	 * to survive the app being killed, which an in-memory override would not.
	 * The finished screen offers to keep it.
	 */
	swaps?: Record<string, ExerciseId>;
}

export interface SetEntry {
	exerciseId: ExerciseId;
	itemId: string; // RoutineItem.id at time of performance
	setIndex: number; // 0-based
	side?: 'left' | 'right'; // absent for bilateral
	reps?: number;
	seconds?: number;
	rpe?: number; // 1-10, optional
	/**
	 * Mass of the implement actually used, in kg (§4.5). The log is what happened,
	 * so this is recorded per set rather than read back off the routine — the
	 * same reason `reps` is. Only ever the mass of a thing that was weighed:
	 * body weight is not tracked (§1), so a weighted pull-up has no honest number
	 * and does not get a made-up one.
	 */
	loadKg?: number;
	skipped: boolean;
	completedAt: string;
}

// --------------------------------------------------------------- §4.4 settings

export interface Settings {
	/** Whether navigator.storage.persist() has been asked for at least once. */
	persistRequested: boolean;
	/** Result of the last persistence check. */
	persistGranted: boolean;
	createdAt: string;
	/** Session count at the last export, so the §8 reminder knows when to nag. */
	lastExportSessionCount?: number;
	lastExportAt?: string;
	/** Session audio cues (§7). On unless deliberately turned off. */
	soundEnabled?: boolean;
	/** Spoken announcement of the next exercise (§7). Same default. */
	speechEnabled?: boolean;
	/**
	 * Auto mode (§7), both off by default: the app's rule is manual advance, and
	 * these relax it deliberately rather than by default. Independent, so all
	 * four combinations are reachable.
	 */
	/** Begin the set once the announcement has finished, with no tap. */
	autoStartSets?: boolean;
	/** Log a timed set at its target and move on, with no tap. */
	autoLogTimedSets?: boolean;

	/**
	 * What the user owns (§5.1). Three-valued on purpose, and the distinction is
	 * load-bearing:
	 *
	 * - `undefined` — never answered. Treated as `['pull_up_bar']`, because the
	 *   catalog has shipped eight pull-up-bar exercises since M0 and two presets
	 *   and a progression ladder are built on them.
	 * - `[]` — answered, and owns nothing. Gates everything.
	 * - `[...]` — answered.
	 *
	 * `[]` must never fall back to the default: a user who deliberately unticked
	 * every box would get pull-ups handed back on the next launch. Read it through
	 * `ownedEquipment()` in `$lib/catalog/equipment`, never directly.
	 */
	ownedEquipment?: EquipmentId[];

	/**
	 * Interface language (§16). **Three-valued, exactly like `ownedEquipment`
	 * above, and load-bearing for the same reason:**
	 *
	 * - `undefined` — never answered. The phone decides, through
	 *   `navigator.languages`.
	 * - `'en'` / `'da'` — answered, and it outranks the phone from then on.
	 *
	 * Collapsing the two — `settings.language ?? deviceLanguage()` — puts a Dane
	 * who deliberately chose English back into Danish on the next launch, in
	 * silence. Read it through `resolveLocale()` in `$lib/i18n`, never directly.
	 * There is a test named after this.
	 */
	language?: Locale;

	/**
	 * Which edge the drag handle sits on (§12). **Two-valued, not three**, and
	 * that is the difference from the two fields above: a phone will tell you
	 * what language it is set to, and it will not tell you which hand is holding
	 * it. There is no device answer to defer to, so `undefined` means nothing
	 * more than "never chosen" and `?? 'left'` loses nothing.
	 */
	handleSide?: HandleSide;
}

/** The edge a drag handle sits on. Named for the screen, not for a hand. */
export type HandleSide = 'left' | 'right';
