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
export function formatSet(entry: SetEntry): string {
	if (entry.seconds !== undefined) return `${entry.seconds} s`;
	if (entry.reps !== undefined) return String(entry.reps);
	return '–';
}

/** Short, unambiguous, and no year unless it is not this one. */
export function formatWhen(iso: string, now = new Date()): string {
	const then = new Date(iso);
	const days = Math.floor(
		(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
			new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
			86400000
	);
	if (days <= 0) return 'earlier today';
	if (days === 1) return 'yesterday';
	if (days < 7) return `${days} days ago`;
	const sameYear = then.getFullYear() === now.getFullYear();
	return then.toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		...(sameYear ? {} : { year: 'numeric' })
	});
}
