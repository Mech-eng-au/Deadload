import type { Exercise, ExerciseId, Session } from '../types.js';

/**
 * One row per logged set (docs/SPEC.md §8). The JSON backup is for restoring
 * the app; this is for looking at the numbers somewhere else, which for this
 * user means a spreadsheet.
 *
 * Skipped sets are included with a flag rather than dropped, for the same
 * reason they are stored: "not done" and "never prescribed" are different.
 */

const COLUMNS = [
	'session_id',
	'date',
	'time',
	'routine',
	'exercise_id',
	'exercise',
	'category',
	'set',
	'side',
	'reps',
	'seconds',
	'rpe',
	'skipped'
] as const;

/** Quote only where required, and double any quotes inside. */
export function csvCell(value: string | number | undefined | null): string {
	if (value === undefined || value === null) return '';
	const text = String(value);
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function localDate(iso: string): [string, string] {
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, '0');
	return [
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
		`${pad(d.getHours())}:${pad(d.getMinutes())}`
	];
}

export function sessionsToCsv(
	sessions: Session[],
	byId: Map<ExerciseId, Exercise> = new Map()
): string {
	const rows: string[] = [COLUMNS.join(',')];

	const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
	for (const session of ordered) {
		for (const entry of session.entries) {
			const [date, time] = localDate(entry.completedAt || session.startedAt);
			const exercise = byId.get(entry.exerciseId);
			rows.push(
				[
					session.id,
					date,
					time,
					session.routineName,
					entry.exerciseId,
					exercise?.name ?? entry.exerciseId,
					exercise?.category ?? '',
					entry.setIndex + 1,
					entry.side ?? '',
					entry.reps,
					entry.seconds,
					entry.rpe,
					entry.skipped ? 'yes' : 'no'
				]
					.map(csvCell)
					.join(',')
			);
		}
	}

	return rows.join('\n') + '\n';
}
