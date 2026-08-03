import { describe, expect, it } from 'vitest';
import {
	CALIBRATION_SESSIONS,
	CALIBRATION_SESSIONS_ADVANCED,
	DECLINE_DAYS,
	MAX_OFFERS_PER_SESSION,
	REP_CEILING,
	applies,
	calibrationWindow,
	calibratingSessions,
	isCalibrating,
	applyOffer,
	declineOffer,
	offerFor,
	offersFor,
	performedIn,
	targetTop
} from '../src/lib/progress/index.js';
import type { Routine, RoutineItem, Session, SetEntry, Target } from '../src/lib/types.js';

/**
 * Progression (SPEC §17), the pure half. Everything here takes the log as an
 * argument and reads nothing, which is the point of §15's rule — the criterion
 * that decides to move somebody up a ladder is the last thing that should only
 * be reachable through a screen.
 */

const DAY = 86_400_000;
const at = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString();

function entry(over: Partial<SetEntry> & Pick<SetEntry, 'exerciseId' | 'itemId'>): SetEntry {
	return { setIndex: 0, skipped: false, completedAt: at(0), ...over };
}

/** A finished session containing `sets` entries for one item, all at `reps`. */
function session(
	id: string,
	day: number,
	over: { exerciseId: string; itemId: string; reps: number; sets?: number } & Partial<SetEntry>
): Session {
	const { exerciseId, itemId, reps, sets = 1, ...rest } = over;
	return {
		id,
		routineId: 'r',
		routineName: 'R',
		startedAt: at(day),
		endedAt: at(day),
		entries: Array.from({ length: sets }, (_, i) =>
			entry({ exerciseId, itemId, setIndex: i, reps, ...rest })
		)
	};
}

function item(over: Partial<RoutineItem> = {}): RoutineItem {
	return {
		id: 'i1',
		exerciseId: 'pushups',
		sets: 3,
		target: { kind: 'reps_range', min: 8, max: 12 },
		perSide: false,
		restSeconds: 60,
		...over
	};
}

/** Enough clean sessions past the calibration window to satisfy the criterion. */
function cleared(exerciseId: string, reps: number, sets = 3, itemId = 'i1'): Session[] {
	return Array.from({ length: CALIBRATION_SESSIONS + 2 }, (_, i) =>
		session(`s${i}`, i, { exerciseId, itemId, reps, sets })
	);
}

const NOW = new Date(at(30));

describe('the calibration window (§17.2)', () => {
	it('is three sessions, and five for an advanced exercise', () => {
		expect(calibrationWindow('beginner')).toBe(CALIBRATION_SESSIONS);
		expect(calibrationWindow('intermediate')).toBe(CALIBRATION_SESSIONS);
		expect(calibrationWindow('advanced')).toBe(CALIBRATION_SESSIONS_ADVANCED);
		// Wider for advanced because the learning effect scales with coordination
		// demand, and those are the single-limb and hanging variants.
		expect(CALIBRATION_SESSIONS_ADVANCED).toBeGreaterThan(CALIBRATION_SESSIONS);
		// An unknown level is treated as ordinary rather than as advanced: the
		// narrower window is the one that trusts the data sooner, and guessing
		// "advanced" would silently stall progression on a missing lookup.
		expect(calibrationWindow(undefined)).toBe(CALIBRATION_SESSIONS);
	});

	it('counts sessions the exercise was performed in, oldest first', () => {
		const sessions = [
			session('c', 2, { exerciseId: 'pushups', itemId: 'i1', reps: 10 }),
			session('a', 0, { exerciseId: 'pushups', itemId: 'i1', reps: 10 }),
			session('b', 1, { exerciseId: 'crunches', itemId: 'i2', reps: 10 })
		];
		expect(performedIn(sessions, 'pushups')).toEqual(['a', 'c']);
	});

	it('ignores unfinished sessions and sessions where every set was skipped', () => {
		const unfinished = session('u', 0, { exerciseId: 'pushups', itemId: 'i1', reps: 10 });
		delete unfinished.endedAt;
		const allSkipped = session('k', 1, {
			exerciseId: 'pushups',
			itemId: 'i1',
			reps: 10,
			skipped: true
		});
		const real = session('r', 2, { exerciseId: 'pushups', itemId: 'i1', reps: 10 });
		// A set that was not done is not an exposure to the movement, so it cannot
		// spend a calibration session.
		expect(performedIn([unfinished, allSkipped, real], 'pushups')).toEqual(['r']);
	});

	it('marks only the first sessions, and stops once the window is spent', () => {
		const sessions = Array.from({ length: 6 }, (_, i) =>
			session(`s${i}`, i, { exerciseId: 'pushups', itemId: 'i1', reps: 10 })
		);
		expect([...calibratingSessions(sessions, 'pushups', 'beginner')]).toEqual(['s0', 's1', 's2']);
		expect(isCalibrating(sessions.slice(0, 2), 'pushups', 'beginner')).toBe(true);
		expect(isCalibrating(sessions.slice(0, 3), 'pushups', 'beginner')).toBe(false);

		// The same three sessions on an advanced exercise are still calibration,
		// and it takes five before the numbers are trusted.
		const hard = Array.from({ length: 6 }, (_, i) =>
			session(`h${i}`, i, { exerciseId: 'hanging_pike', itemId: 'i1', reps: 6 })
		);
		expect(isCalibrating(hard.slice(0, 3), 'hanging_pike', 'advanced')).toBe(true);
		expect(isCalibrating(hard.slice(0, 4), 'hanging_pike', 'advanced')).toBe(true);
		expect(isCalibrating(hard.slice(0, 5), 'hanging_pike', 'advanced')).toBe(false);
		expect([...calibratingSessions(hard, 'hanging_pike', 'advanced')]).toEqual([
			'h0',
			'h1',
			'h2',
			'h3',
			'h4'
		]);
	});

	it('is per exercise, not per routine item', () => {
		// The window is about learning a movement, so swapping which item it sits
		// on does not restart it, and two exercises calibrate independently.
		const sessions = [
			session('s0', 0, { exerciseId: 'pushups', itemId: 'i1', reps: 10 }),
			session('s1', 1, { exerciseId: 'pushups', itemId: 'i9', reps: 10 }),
			session('s2', 2, { exerciseId: 'crunches', itemId: 'i2', reps: 10 })
		];
		expect(performedIn(sessions, 'pushups')).toEqual(['s0', 's1']);
		expect(isCalibrating(sessions, 'crunches', 'beginner')).toBe(true);
	});
});

describe('what the rule applies to (§17.1)', () => {
	it('takes strength and core on a reps target', () => {
		expect(applies(item({ exerciseId: 'pushups' }))).toBe(true);
		// core was excluded by the first draft on a premise the ladder audit found
		// to be false — two of the seven surviving chains are core.
		expect(applies(item({ exerciseId: 'crunches' }))).toBe(true);
		expect(applies(item({ exerciseId: 'pushups', target: { kind: 'reps', reps: 10 } }))).toBe(true);
	});

	it('leaves stretches, mobility and anything timed alone', () => {
		expect(applies(item({ exerciseId: 'childs_pose' }))).toBe(false);
		expect(applies(item({ exerciseId: 'cat_stretch' }))).toBe(false);
		expect(
			applies(item({ exerciseId: 'plank', target: { kind: 'duration', seconds: 60 } }))
		).toBe(false);
		expect(applies(item({ exerciseId: 'pushups', target: { kind: 'amrap' } }))).toBe(false);
		expect(applies(item({ exerciseId: 'not_a_real_exercise' }))).toBe(false);
	});

	it('reads the top of a target and nothing else', () => {
		expect(targetTop({ kind: 'reps', reps: 12 })).toBe(12);
		expect(targetTop({ kind: 'reps_range', min: 8, max: 12 })).toBe(12);
		expect(targetTop({ kind: 'duration', seconds: 30 })).toBeUndefined();
		expect(targetTop({ kind: 'amrap' })).toBeUndefined();
	});
});

describe('the criterion (§17.1)', () => {
	const owned = ['pull_up_bar' as const];
	const offer = (sessions: Session[], it = item()) =>
		offerFor({ item: it, sessions, owned, now: NOW });

	it('offers a rep after two clean sessions at the top of the range', () => {
		expect(offer(cleared('pushups', 12))).toEqual({
			kind: 'add_rep',
			itemId: 'i1',
			exerciseId: 'pushups',
			cleared: { kind: 'reps_range', min: 8, max: 12 },
			target: { kind: 'reps_range', min: 9, max: 13 }
		});
	});

	it('raises a fixed target by one, and both ends of a range', () => {
		const it = item({ target: { kind: 'reps', reps: 10 } });
		expect(offer(cleared('pushups', 10), it)).toMatchObject({
			target: { kind: 'reps', reps: 11 }
		});
	});

	it('says nothing after one good session', () => {
		// One is inside the noise. Two rather than three because more than two and
		// the app is slower than the user.
		const sessions = [
			...Array.from({ length: CALIBRATION_SESSIONS }, (_, i) =>
				session(`c${i}`, i, { exerciseId: 'pushups', itemId: 'i1', reps: 8, sets: 3 })
			),
			session('good', 9, { exerciseId: 'pushups', itemId: 'i1', reps: 12, sets: 3 })
		];
		expect(offer(sessions)).toBeUndefined();
	});

	it('says nothing while the exercise is still calibrating', () => {
		// Three sessions all at the top of the range — and all of them inside the
		// window, so what they measure is having learned the movement.
		const sessions = Array.from({ length: CALIBRATION_SESSIONS }, (_, i) =>
			session(`s${i}`, i, { exerciseId: 'pushups', itemId: 'i1', reps: 12, sets: 3 })
		);
		expect(offer(sessions)).toBeUndefined();
		// The very next clean session is the second post-calibration one, and it
		// is the one that earns the offer.
		expect(
			offer([...sessions, session('s3', 3, { exerciseId: 'pushups', itemId: 'i1', reps: 12, sets: 3 }),
				session('s4', 4, { exerciseId: 'pushups', itemId: 'i1', reps: 12, sets: 3 })])
		).toBeDefined();
	});

	it('resets on a shortfall or a skip in either session', () => {
		const short = cleared('pushups', 12);
		short[short.length - 1].entries[1].reps = 11;
		expect(offer(short)).toBeUndefined();

		const skipped = cleared('pushups', 12);
		skipped[skipped.length - 2].entries[0].skipped = true;
		expect(offer(skipped)).toBeUndefined();
	});

	it('needs every set of the item, counted by distinct setIndex', () => {
		// Two of three sets at the top is not a session at the top.
		expect(offer(cleared('pushups', 12, 2))).toBeUndefined();
		// A per-side pair is one set, exactly as §4.3's renumbering treats it —
		// otherwise a unilateral item could never satisfy the criterion.
		const perSide = Array.from({ length: CALIBRATION_SESSIONS + 2 }, (_, i) => ({
			...session(`s${i}`, i, { exerciseId: 'single_leg_glute_bridge', itemId: 'i1', reps: 12, sets: 2 }),
			entries: [0, 0, 1, 1].map((setIndex, n) =>
				entry({
					exerciseId: 'single_leg_glute_bridge',
					itemId: 'i1',
					setIndex,
					reps: 12,
					side: n % 2 ? 'right' : 'left'
				})
			)
		}));
		expect(
			offer(perSide, item({ exerciseId: 'single_leg_glute_bridge', sets: 2, perSide: true }))
		).toBeDefined();
	});

	it('ignores sessions logged against a different exercise on the same item', () => {
		// A §7 swap keeps the itemId and changes the exercise. Sessions on the
		// easier rung are not evidence that the harder one is too easy.
		const sessions = cleared('incline_push_up', 12).map((s) => ({ ...s }));
		expect(offer(sessions, item({ exerciseId: 'pushups' }))).toBeUndefined();
	});

	it('ignores unfinished sessions', () => {
		const sessions = cleared('pushups', 12);
		delete sessions[sessions.length - 1].endedAt;
		expect(offer(sessions)).toBeUndefined();
	});
});

describe('the top of a ladder (§17.1, amended)', () => {
	const offer = (sessions: Session[], it: RoutineItem, owned: string[] = ['pull_up_bar']) =>
		offerFor({ item: it, sessions, owned: owned as never, now: NOW });

	it('offers the next rung at the ceiling, on a low starting range', () => {
		const it = item({ exerciseId: 'pushups', target: { kind: 'reps', reps: REP_CEILING } });
		expect(offer(cleared('pushups', REP_CEILING), it)).toEqual({
			kind: 'next_rung',
			itemId: 'i1',
			exerciseId: 'pushups',
			cleared: { kind: 'reps', reps: REP_CEILING },
			to: 'push_ups_with_feet_elevated',
			target: { kind: 'reps_range', min: 5, max: 8 }
		});
	});

	it('does not offer a rung the user has no equipment for', () => {
		// §5.1 gates what the app suggests, and a progression suggestion is the
		// most emphatic suggestion it makes. Without a bar, the chin-up chain's
		// top rung is not an offer — it is the end of the ladder.
		const it = item({ exerciseId: 'chin_up', target: { kind: 'reps', reps: REP_CEILING } });
		expect(offer(cleared('chin_up', REP_CEILING), it, ['pull_up_bar'])).toMatchObject({
			kind: 'next_rung',
			to: 'pullups'
		});
		expect(offer(cleared('chin_up', REP_CEILING), it, [])).toMatchObject({ kind: 'ladder_end' });
	});

	it('says the catalog has run out when there is no harder rung', () => {
		// bodyweight_squat is on no ladder after the audit: the catalog has no
		// harder bodyweight squat, and saying so is the answer.
		const it = item({ exerciseId: 'bodyweight_squat', target: { kind: 'reps', reps: REP_CEILING } });
		expect(offer(cleared('bodyweight_squat', REP_CEILING), it)).toEqual({
			kind: 'ladder_end',
			itemId: 'i1',
			exerciseId: 'bodyweight_squat',
			cleared: { kind: 'reps', reps: REP_CEILING }
		});
	});

	it('keeps adding reps right up to the ceiling', () => {
		const below = item({ target: { kind: 'reps', reps: REP_CEILING - 1 } });
		expect(offer(cleared('pushups', REP_CEILING - 1), below)).toMatchObject({ kind: 'add_rep' });
	});
});

describe('declining (§17.3)', () => {
	const owned = ['pull_up_bar' as const];

	it('is remembered for fourteen days and then forgotten', () => {
		const sessions = cleared('pushups', 12);
		const declined = (daysAgo: number) =>
			offerFor({
				item: item({ progressDeclinedAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString() }),
				sessions,
				owned,
				now: NOW
			});
		expect(declined(0)).toBeUndefined();
		expect(declined(DECLINE_DAYS - 1)).toBeUndefined();
		expect(declined(DECLINE_DAYS)).toBeDefined();
		expect(declined(DECLINE_DAYS + 30)).toBeDefined();
	});

	it('ignores an unparseable or future timestamp rather than suppressing forever', () => {
		const sessions = cleared('pushups', 12);
		expect(offerFor({ item: item({ progressDeclinedAt: 'not a date' }), sessions, owned, now: NOW }))
			.toBeDefined();
		expect(
			offerFor({ item: item({ progressDeclinedAt: at(999) }), sessions, owned, now: NOW })
		).toBeDefined();
	});
});

describe('how many suggestions one session may make (§17.3)', () => {
	const routine = (items: RoutineItem[]): Routine => ({
		id: 'r',
		name: 'R',
		tags: [],
		source: 'user',
		createdAt: at(0),
		updatedAt: at(0),
		blocks: [{ id: 'b', items }]
	});

	function clearedFor(specs: { exerciseId: string; itemId: string }[], reps: number): Session[] {
		return Array.from({ length: CALIBRATION_SESSIONS + 2 }, (_, i) => ({
			id: `s${i}`,
			routineId: 'r',
			routineName: 'R',
			startedAt: at(i),
			endedAt: at(i),
			entries: specs.flatMap(({ exerciseId, itemId }) =>
				[0, 1, 2].map((setIndex) => entry({ exerciseId, itemId, setIndex, reps }))
			)
		}));
	}

	it('never makes more than two, however good the session was', () => {
		const specs = [
			{ exerciseId: 'pushups', itemId: 'a' },
			{ exerciseId: 'crunches', itemId: 'b' },
			{ exerciseId: 'bench_dips', itemId: 'c' },
			{ exerciseId: 'butt_lift_bridge', itemId: 'd' }
		];
		const items = specs.map((s) => item({ id: s.itemId, exerciseId: s.exerciseId }));
		const offers = offersFor(routine(items), clearedFor(specs, 12), ['pull_up_bar'], NOW);
		expect(offers).toHaveLength(MAX_OFFERS_PER_SESSION);
		expect(offers.map((o) => o.itemId)).toEqual(['a', 'b']);
	});

	it('spends its two slots on offers that do something', () => {
		// `ladder_end` asks for nothing, so it goes last — it should not crowd out
		// an actionable suggestion just for being earlier in the routine.
		const specs = [
			{ exerciseId: 'bodyweight_squat', itemId: 'a' },
			{ exerciseId: 'pushups', itemId: 'b' }
		];
		const items = [
			item({ id: 'a', exerciseId: 'bodyweight_squat', target: { kind: 'reps', reps: REP_CEILING } }),
			item({ id: 'b', exerciseId: 'pushups', target: { kind: 'reps', reps: 10 } })
		];
		const offers = offersFor(routine(items), clearedFor(specs, REP_CEILING), ['pull_up_bar'], NOW);
		expect(offers.map((o) => o.kind)).toEqual(['add_rep', 'ladder_end']);
	});

	it('says nothing about a routine nobody has cleared', () => {
		const specs = [{ exerciseId: 'pushups', itemId: 'a' }];
		const items = [item({ id: 'a' })];
		expect(offersFor(routine(items), clearedFor(specs, 9), ['pull_up_bar'], NOW)).toEqual([]);
	});
});

describe('what §17 refuses to do', () => {
	it('applies nothing — every offer is a suggestion carrying a target, not a write', () => {
		// §17.3: the routine is the user's, and nothing is applied without a tap.
		// This module returns descriptions and never a mutated item.
		const it = item();
		const before: Target = { ...it.target };
		offerFor({ item: it, sessions: cleared('pushups', 12), owned: ['pull_up_bar'], now: NOW });
		expect(it.target).toEqual(before);
		expect(it.progressDeclinedAt).toBeUndefined();
	});
});

describe('applying and declining (§17.3)', () => {
	const routine = (items: RoutineItem[]): Routine => ({
		id: 'r',
		name: 'R',
		tags: [],
		source: 'user',
		createdAt: at(0),
		updatedAt: at(0),
		blocks: [
			{ id: 'b1', items: [item({ id: 'other', exerciseId: 'crunches' })] },
			{ id: 'b2', items }
		]
	});
	const owned = ['pull_up_bar' as const];
	const find = (r: Routine, id: string) => r.blocks.flatMap((b) => b.items).find((i) => i.id === id)!;

	it('raises the target and touches nothing else', () => {
		const before = routine([item()]);
		const offer = offerFor({ item: find(before, 'i1'), sessions: cleared('pushups', 12), owned, now: NOW })!;
		const after = applyOffer(before, offer);
		expect(find(after, 'i1').target).toEqual({ kind: 'reps_range', min: 9, max: 13 });
		expect(find(after, 'i1').sets).toBe(3);
		expect(find(after, 'other')).toEqual(find(before, 'other'));
		// A new routine, not a mutation — a caller that changes its mind has
		// changed nothing, exactly as applySwaps behaves.
		expect(find(before, 'i1').target).toEqual({ kind: 'reps_range', min: 8, max: 12 });
	});

	it('follows perSide onto a rung that crosses to one limb', () => {
		// A limb_count step changes what one logged rep means, so the item has to
		// say so — the same rule §7's kept swap follows.
		const it = item({
			id: 'i1',
			exerciseId: 'butt_lift_bridge',
			target: { kind: 'reps', reps: REP_CEILING }
		});
		const before = routine([it]);
		const offer = offerFor({
			item: it,
			sessions: cleared('butt_lift_bridge', REP_CEILING),
			owned,
			now: NOW
		})!;
		expect(offer).toMatchObject({ kind: 'next_rung', to: 'single_leg_glute_bridge' });
		const after = applyOffer(before, offer, (id) => id === 'single_leg_glute_bridge');
		expect(find(after, 'i1').exerciseId).toBe('single_leg_glute_bridge');
		expect(find(after, 'i1').perSide).toBe(true);
		expect(find(after, 'i1').target).toEqual({ kind: 'reps_range', min: 5, max: 8 });
	});

	it('clears a stale decline when an offer is taken up', () => {
		const before = routine([item({ progressDeclinedAt: at(0) })]);
		const after = applyOffer(before, {
			kind: 'add_rep',
			itemId: 'i1',
			exerciseId: 'pushups',
			cleared: { kind: 'reps', reps: 10 },
			target: { kind: 'reps', reps: 11 }
		});
		expect(find(after, 'i1').progressDeclinedAt).toBeUndefined();
	});

	it('stamps a decline, and silences that item for a fortnight', () => {
		const before = routine([item()]);
		const after = declineOffer(before, 'i1', NOW);
		expect(find(after, 'i1').progressDeclinedAt).toBe(NOW.toISOString());
		expect(
			offerFor({ item: find(after, 'i1'), sessions: cleared('pushups', 12), owned, now: NOW })
		).toBeUndefined();
	});

	it('dismisses a ladder_end the same way, since there is nothing to apply', () => {
		const before = routine([item()]);
		const after = applyOffer(before, {
			kind: 'ladder_end',
			itemId: 'i1',
			exerciseId: 'pushups',
			cleared: { kind: 'reps', reps: REP_CEILING }
		});
		expect(find(after, 'i1').progressDeclinedAt).toBeDefined();
		expect(find(after, 'i1').target).toEqual(find(before, 'i1').target);
	});

	it('composes, so a second decision does not undo the first', () => {
		// The finished screen can make two of these in a row, and it builds each on
		// the result of the last. Applying both to the *original* routine would
		// silently drop whichever was saved first.
		const before = routine([item(), item({ id: 'i2', exerciseId: 'bench_dips' })]);
		const step1 = applyOffer(before, {
			kind: 'add_rep',
			itemId: 'i1',
			exerciseId: 'pushups',
			cleared: { kind: 'reps', reps: 10 },
			target: { kind: 'reps', reps: 11 }
		});
		const step2 = declineOffer(step1, 'i2', NOW);
		expect(find(step2, 'i1').target).toEqual({ kind: 'reps', reps: 11 });
		expect(find(step2, 'i2').progressDeclinedAt).toBe(NOW.toISOString());
	});
});
