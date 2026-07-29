// Data model per docs/SPEC.md §4. Metric units only; durations in whole seconds.

export type ExerciseId = string; // snake_case slug, e.g. "worlds_greatest_stretch"

export type Category = 'strength' | 'stretch' | 'mobility' | 'core' | 'cardio';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
	id: ExerciseId;
	name: string;
	aliases: string[];
	category: Category;
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
	source: 'free-exercise-db' | 'wger' | 'wikimedia' | 'own';
	license: 'PD' | 'CC0' | 'CC-BY-SA-3.0' | 'CC-BY-SA-4.0' | 'own';
	author?: string;
	sourceUrl?: string;
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
}
