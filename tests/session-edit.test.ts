import { describe, expect, it } from 'vitest';
import {
	EditError,
	applyEntryEdit,
	correctedLabel,
	editableReason,
	isEditable,
	removeEntry,
	setSessionNotes
} from '../src/lib/session/edit.js';
import type { Session, SetEntry } from '../src/lib/types.js';
import { en } from '../src/lib/i18n/en/index.js';

const NOW = new Date('2026-07-30T18:00:00.000Z');

function entry(over: Partial<SetEntry> = {}): SetEntry {
	return {
		exerciseId: 'pushups',
		itemId: 'i1',
		setIndex: 0,
		reps: 10,
		skipped: false,
		completedAt: '2026-07-30T07:00:00.000Z',
		...over
	};
}

function session(entries: SetEntry[], over: Partial<Session> = {}): Session {
	return {
		id: 's1',
		routineId: 'r1',
		routineName: 'Morning',
		startedAt: '2026-07-30T07:00:00.000Z',
		endedAt: '2026-07-30T07:25:00.000Z',
		entries,
		...over
	};
}

describe('what can be corrected (§4.3)', () => {
	it('allows a finished session', () => {
		expect(isEditable(session([entry()]), en)).toBe(true);
		expect(editableReason(session([entry()]), en)).toBeUndefined();
	});

	it('refuses an unfinished session, and says why', () => {
		// The player finds its place on resume by counting entries. Removing one
		// underneath it would desync the rest of the session.
		const open = session([entry()], { endedAt: undefined });
		expect(isEditable(open, en)).toBe(false);
		expect(editableReason(open, en)).toMatch(/never finished/i);
		expect(() => applyEntryEdit(open, 0, { reps: 9 }, en)).toThrow(EditError);
		expect(() => removeEntry(open, 0, en)).toThrow(EditError);
		expect(() => setSessionNotes(open, 'hi', en)).toThrow(EditError);
	});

	it('refuses a set index that is not there', () => {
		const s = session([entry()]);
		expect(() => applyEntryEdit(s, 1, { reps: 9 }, en)).toThrow(EditError);
		expect(() => applyEntryEdit(s, -1, { reps: 9 }, en)).toThrow(EditError);
		expect(() => removeEntry(s, 5, en)).toThrow(EditError);
	});
});

describe('correcting a set', () => {
	it('changes the number and leaves everything else alone', () => {
		const s = session([entry({ reps: 10, rpe: 8 }), entry({ setIndex: 1, reps: 9 })]);
		const out = applyEntryEdit(s, 0, { reps: 12 }, en, NOW);
		expect(out.entries[0].reps).toBe(12);
		expect(out.entries[0].rpe).toBe(8);
		expect(out.entries[0].completedAt).toBe(s.entries[0].completedAt);
		expect(out.entries[1]).toEqual(s.entries[1]);
		expect(out.entries[0].setIndex).toBe(0);
	});

	it('does not mutate the session it was given', () => {
		const s = session([entry({ reps: 10 })]);
		applyEntryEdit(s, 0, { reps: 12 }, en, NOW);
		expect(s.entries[0].reps).toBe(10);
		expect(s.editedAt).toBeUndefined();
	});

	it('stamps editedAt', () => {
		const out = applyEntryEdit(session([entry()]), 0, { reps: 11 }, en, NOW);
		expect(out.editedAt).toBe(NOW.toISOString());
		expect(correctedLabel(out, en)).toMatch(/^Corrected by hand on /);
		expect(correctedLabel(session([entry()]), en)).toBeUndefined();
	});

	it('corrects a load and an RPE', () => {
		const s = session([entry({ exerciseId: 'goblet_squat', reps: 10, loadKg: 16 })]);
		expect(applyEntryEdit(s, 0, { loadKg: 12 }, en, NOW).entries[0].loadKg).toBe(12);
		expect(applyEntryEdit(s, 0, { loadKg: undefined }, en, NOW).entries[0].loadKg).toBeUndefined();
		expect(applyEntryEdit(s, 0, { rpe: 9 }, en, NOW).entries[0].rpe).toBe(9);
	});

	it('clears the measurements when a set is marked skipped', () => {
		// §4.3's skipped rows mean "not done", and a not-done set with eight reps on
		// it is a contradiction.
		const s = session([entry({ reps: 8, seconds: 30, loadKg: 10, rpe: 7 })]);
		const out = applyEntryEdit(s, 0, { skipped: true }, en, NOW);
		expect(out.entries[0]).toEqual({
			exerciseId: 'pushups',
			itemId: 'i1',
			setIndex: 0,
			skipped: true,
			completedAt: s.entries[0].completedAt
		});
	});

	it('needs a number to un-skip a set', () => {
		const s = session([entry({ reps: undefined, skipped: true })]);
		expect(() => applyEntryEdit(s, 0, { skipped: false }, en, NOW)).toThrow(/reps or seconds/i);
		expect(applyEntryEdit(s, 0, { skipped: false, reps: 6 }, en, NOW).entries[0].reps).toBe(6);
	});

	it('refuses to leave a done set with no measurement at all', () => {
		const s = session([entry({ reps: 10 })]);
		expect(() => applyEntryEdit(s, 0, { reps: undefined }, en, NOW)).toThrow(/reps or seconds/i);
	});

	it('refuses numbers that cannot have happened', () => {
		const s = session([entry({ reps: 10 })]);
		expect(() => applyEntryEdit(s, 0, { reps: 0 }, en, NOW)).toThrow(/whole number/i);
		expect(() => applyEntryEdit(s, 0, { reps: -3 }, en, NOW)).toThrow(/whole number/i);
		expect(() => applyEntryEdit(s, 0, { reps: 8.5 }, en, NOW)).toThrow(/whole number/i);
		expect(() => applyEntryEdit(s, 0, { seconds: 0 }, en, NOW)).toThrow(/whole number/i);
		expect(() => applyEntryEdit(s, 0, { loadKg: 0 }, en, NOW)).toThrow(/positive number/i);
		expect(() => applyEntryEdit(s, 0, { loadKg: -5 }, en, NOW)).toThrow(/positive number/i);
		expect(() => applyEntryEdit(s, 0, { rpe: 0 }, en, NOW)).toThrow(/1 to 10/);
		expect(() => applyEntryEdit(s, 0, { rpe: 11 }, en, NOW)).toThrow(/1 to 10/);
	});

	it('keeps the side on a per-side set', () => {
		const s = session([entry({ side: 'left', reps: 8 })]);
		expect(applyEntryEdit(s, 0, { reps: 7 }, en, NOW).entries[0].side).toBe('left');
		expect(applyEntryEdit(s, 0, { skipped: true }, en, NOW).entries[0].side).toBe('left');
	});
});

describe('removing a set', () => {
	it('drops it and renumbers what is left of that exercise', () => {
		// Leaving setIndex 0 and 2 behind would assert there had been a third set,
		// which is the very thing being corrected.
		const s = session([
			entry({ setIndex: 0, reps: 10 }),
			entry({ setIndex: 1, reps: 9 }),
			entry({ setIndex: 2, reps: 8 })
		]);
		const out = removeEntry(s, 1, en, NOW);
		expect(out.entries.map((e) => [e.setIndex, e.reps])).toEqual([
			[0, 10],
			[1, 8]
		]);
		expect(out.editedAt).toBe(NOW.toISOString());
	});

	it("leaves the other exercises' numbering alone", () => {
		const s = session([
			entry({ itemId: 'i1', setIndex: 0 }),
			entry({ itemId: 'i1', setIndex: 1 }),
			entry({ itemId: 'i2', exerciseId: 'plank', setIndex: 0, reps: undefined, seconds: 40 }),
			entry({ itemId: 'i2', exerciseId: 'plank', setIndex: 1, reps: undefined, seconds: 35 })
		]);
		const out = removeEntry(s, 0, en, NOW);
		expect(out.entries.filter((e) => e.itemId === 'i1').map((e) => e.setIndex)).toEqual([0]);
		expect(out.entries.filter((e) => e.itemId === 'i2').map((e) => e.setIndex)).toEqual([0, 1]);
	});

	it('keeps a per-side pair sharing one set number', () => {
		// Renumbering by distinct setIndex, not by row: left and right are one set.
		const s = session([
			entry({ setIndex: 0, side: 'left' }),
			entry({ setIndex: 0, side: 'right' }),
			entry({ setIndex: 1, side: 'left' }),
			entry({ setIndex: 1, side: 'right' }),
			entry({ setIndex: 2, side: 'left' }),
			entry({ setIndex: 2, side: 'right' })
		]);
		const out = removeEntry(removeEntry(s, 2, en, NOW), 2, en, NOW); // both rows of set 2
		expect(out.entries.map((e) => `${e.setIndex}${e.side![0]}`)).toEqual(['0l', '0r', '1l', '1r']);
	});

	it('allows emptying a session, which is then just an empty session', () => {
		const out = removeEntry(session([entry()]), 0, en, NOW);
		expect(out.entries).toEqual([]);
		expect(out.endedAt).toBe(session([entry()]).endedAt);
	});
});

describe('session notes', () => {
	it('sets and clears them', () => {
		const s = session([entry()]);
		expect(setSessionNotes(s, '  felt strong  ', en, NOW).notes).toBe('felt strong');
		expect(setSessionNotes({ ...s, notes: 'old' }, '   ', en, NOW).notes).toBeUndefined();
		expect('notes' in setSessionNotes({ ...s, notes: 'old' }, '', en, NOW)).toBe(false);
	});
});
