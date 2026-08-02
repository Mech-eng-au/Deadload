import type { Messages } from '../i18n/index.js';
import type { Session, SetEntry } from '../types.js';

/**
 * "What did I do last time?" — the most useful thing the session log can say
 * while you are standing over the phone deciding what to do now.
 *
 * Pure and given the sessions rather than reading them, so the selection rules
 * are testable. Reading every session is fine at this scale; if it ever is not,
 * this becomes a reverse cursor over the startedAt index and nothing else
 * changes.
 */

export interface LastPerformance {
	sessionId: string;
	performedAt: string;
	sets: SetEntry[];
}

export interface LastTimeQuery {
	/** The session in progress, which is never its own "last time". */
	excludeSessionId?: string;
	/** Compare left with left: the other side is not a fair comparison. */
	side?: 'left' | 'right';
}

/**
 * The most recent *finished* session containing real work for this exercise.
 * Skipped sets do not count as having done it.
 */
export function pickLastPerformance(
	sessions: Session[],
	exerciseId: string,
	{ excludeSessionId, side }: LastTimeQuery = {}
): LastPerformance | undefined {
	const candidates = sessions
		.filter((s) => s.endedAt && s.id !== excludeSessionId)
		.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

	for (const session of candidates) {
		const sets = session.entries.filter(
			(e) => e.exerciseId === exerciseId && !e.skipped && (side === undefined || e.side === side)
		);
		if (sets.length > 0) {
			return {
				sessionId: session.id,
				performedAt: session.startedAt,
				sets: [...sets].sort((a, b) => a.setIndex - b.setIndex)
			};
		}
	}
	return undefined;
}

/** "12, 11, 9" or "45 s, 45 s, 40 s". */
export function formatSet(entry: SetEntry, t: Messages): string {
	if (entry.seconds !== undefined) return t.units.seconds(entry.seconds);
	if (entry.reps !== undefined) return t.units.num(entry.reps);
	return '–';
}

/**
 * The same, with the load (§4.5): `12 × 10 kg`, then `11 × 10` for the next set
 * at the same weight. The unit is stated once and again only when the load
 * changes, because a line read at 1 m out of breath does not need "kg" three
 * times to make its point — but it does need to know when the weight moved.
 */
export function formatSetWithLoad(entry: SetEntry, t: Messages, previous?: SetEntry): string {
	const base = formatSet(entry, t);
	if (entry.loadKg === undefined) return base;
	const same = previous?.loadKg !== undefined && previous.loadKg === entry.loadKg;
	return `${base} × ${same ? t.units.kgBare(entry.loadKg) : t.units.kg(entry.loadKg)}`;
}

/** The whole last-time line, in order, so the caller only decides emphasis. */
export function formatSetList(sets: SetEntry[], t: Messages): string[] {
	return sets.map((entry, i) => formatSetWithLoad(entry, t, sets[i - 1]));
}

/** Short, unambiguous, and no year unless it is not this one. */
export function formatWhen(iso: string, t: Messages, now = new Date()): string {
	const then = new Date(iso);
	const days = Math.floor(
		(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
			new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
			86400000
	);
	if (days <= 0) return t.history.earlierToday;
	if (days === 1) return t.history.yesterday;
	if (days < 7) return t.history.daysAgo(days);
	return t.history.shortDate(iso, then.getFullYear() === now.getFullYear());
}
