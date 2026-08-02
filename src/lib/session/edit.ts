import type { Messages } from '../i18n/index.js';
import type { Session, SetEntry } from '../types.js';

/**
 * Correcting a logged session (docs/SPEC.md §4.3).
 *
 * Pure, and separate from the screen, for the reason §15 gives for the other
 * pure layers: these are the rules worth arguing about, and they should be
 * testable without a DOM. The database side is unchanged — §4.3 already says a
 * session is rewritten whole and never partially updated, so every function here
 * returns a new `Session` for the caller to hand to `putSession`.
 *
 * The log is a record of what happened (§4.3), so editing it is a **correction**,
 * not authoring. Two things follow, and both are enforced here rather than left
 * to the UI:
 *
 * 1. Only a finished session can be corrected. An unfinished one belongs to the
 *    player, which finds its place on resume by counting entries — removing one
 *    underneath it would desync the whole session.
 * 2. Every edit stamps `editedAt`. Statistics are built on this log, so a log
 *    that can be silently rewritten is worth less than one that admits it was.
 */

export interface EntryEdit {
	reps?: number;
	seconds?: number;
	loadKg?: number;
	rpe?: number;
	skipped?: boolean;
}

/** Plain-language reason a session cannot be corrected, or undefined if it can. */
export function editableReason(session: Session, t: Messages): string | undefined {
	if (!session.endedAt) {
		return t.history.notFinished;
	}
	return undefined;
}

export function isEditable(session: Session, t: Messages): boolean {
	return editableReason(session, t) === undefined;
}

/** Thrown for an edit that would make the log say something impossible. */
export class EditError extends Error {}

function assertEditable(session: Session, t: Messages): void {
	const reason = editableReason(session, t);
	if (reason) throw new EditError(reason);
}

function assertIndex(session: Session, index: number, t: Messages): void {
	if (!Number.isInteger(index) || index < 0 || index >= session.entries.length) {
		throw new EditError(t.history.noSuchSet(index));
	}
}

/**
 * Apply a correction to one logged set.
 *
 * Marking a set skipped **clears its measurements**, because §4.3's skipped rows
 * mean "not done" and a not-done set with eight reps on it is a contradiction.
 * Un-skipping therefore has to supply a number, which is why the reps/seconds
 * check runs after the skip flag is resolved.
 */
export function applyEntryEdit(
	session: Session,
	index: number,
	edit: EntryEdit,
	t: Messages,
	now = new Date()
): Session {
	assertEditable(session, t);
	assertIndex(session, index, t);

	const current = session.entries[index];
	const skipped = edit.skipped ?? current.skipped;

	let next: SetEntry;
	if (skipped) {
		next = {
			exerciseId: current.exerciseId,
			itemId: current.itemId,
			setIndex: current.setIndex,
			...(current.side ? { side: current.side } : {}),
			skipped: true,
			completedAt: current.completedAt
		};
	} else {
		const reps = 'reps' in edit ? edit.reps : current.reps;
		const seconds = 'seconds' in edit ? edit.seconds : current.seconds;
		const loadKg = 'loadKg' in edit ? edit.loadKg : current.loadKg;
		const rpe = 'rpe' in edit ? edit.rpe : current.rpe;

		if (reps === undefined && seconds === undefined) {
			throw new EditError(t.history.needsAmount);
		}
		if (reps !== undefined && (!Number.isInteger(reps) || reps < 1)) {
			throw new EditError(t.history.repsWhole);
		}
		if (seconds !== undefined && (!Number.isInteger(seconds) || seconds < 1)) {
			throw new EditError(t.history.secondsWhole);
		}
		if (loadKg !== undefined && (!Number.isFinite(loadKg) || loadKg <= 0)) {
			throw new EditError(t.history.loadPositive);
		}
		if (rpe !== undefined && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
			throw new EditError(t.history.rpeRange);
		}

		next = {
			exerciseId: current.exerciseId,
			itemId: current.itemId,
			setIndex: current.setIndex,
			...(current.side ? { side: current.side } : {}),
			...(reps === undefined ? {} : { reps }),
			...(seconds === undefined ? {} : { seconds }),
			...(loadKg === undefined ? {} : { loadKg }),
			...(rpe === undefined ? {} : { rpe }),
			skipped: false,
			completedAt: current.completedAt
		};
	}

	const entries = [...session.entries];
	entries[index] = next;
	return { ...session, entries, editedAt: now.toISOString() };
}

/**
 * Drop a logged set, and renumber what is left of that exercise.
 *
 * Renumbering is the honest half. Deleting set 2 of 3 and leaving `setIndex` 0
 * and 2 behind asserts there was a third set, which is exactly the thing being
 * corrected. So the remaining sets of that item are renumbered from zero — and
 * by *distinct* setIndex, so a per-side pair (§7) keeps sharing one number
 * instead of becoming two separate sets.
 */
export function removeEntry(session: Session, index: number, t: Messages, now = new Date()): Session {
	assertEditable(session, t);
	assertIndex(session, index, t);

	const { itemId } = session.entries[index];
	const entries = session.entries.filter((_, i) => i !== index);

	const remaining = entries.filter((e) => e.itemId === itemId);
	const order = [...new Set(remaining.map((e) => e.setIndex))].sort((a, b) => a - b);
	const renumbered = new Map(order.map((old, i) => [old, i]));

	return {
		...session,
		entries: entries.map((e) =>
			e.itemId === itemId ? { ...e, setIndex: renumbered.get(e.setIndex) ?? e.setIndex } : e
		),
		editedAt: now.toISOString()
	};
}

/** Free-text note on the session as a whole. Empty text removes it. */
export function setSessionNotes(session: Session, notes: string, t: Messages, now = new Date()): Session {
	assertEditable(session, t);
	const trimmed = notes.trim();
	const next = { ...session, editedAt: now.toISOString() };
	if (trimmed) next.notes = trimmed;
	else delete next.notes;
	return next;
}

/** "Corrected by hand on 30 July" — shown on the session, so the edit is visible. */
export function correctedLabel(session: Session, t: Messages): string | undefined {
	if (!session.editedAt) return undefined;
	return t.history.corrected(session.editedAt);
}
