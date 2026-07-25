import { putSession } from '../db/sessions.js';
import { uid } from '../db/routines.js';
import type { Routine, Session, SetEntry } from '../types.js';
import { armAudio, beep } from './audio.js';
import { expandRoutine, type Step } from './steps.js';
import { allowScreenSleep, keepScreenAwake } from './wake-lock.js';

export type Phase = 'ready' | 'working' | 'resting' | 'finished';

/**
 * Session state machine (docs/SPEC.md §7).
 *
 *   Ready -> Working -> (log) -> Resting -> Working -> ... -> Finished
 *
 * Manual advance only: nothing here moves the user on except a press or the
 * rest countdown reaching zero. State is written to IndexedDB after every
 * logged set, so killing the app mid-workout loses nothing.
 */
export class SessionPlayer {
	readonly routine: Routine;
	readonly steps: Step[];

	session = $state<Session>()!;
	phase = $state<Phase>('ready');
	stepIndex = $state(0);
	restRemaining = $state(0);
	/** Seconds counted up while a timed set runs. */
	elapsed = $state(0);

	#restTimer: ReturnType<typeof setInterval> | null = null;
	#elapsedTimer: ReturnType<typeof setInterval> | null = null;

	constructor(routine: Routine, session?: Session) {
		this.routine = routine;
		this.steps = expandRoutine(routine);

		this.session = session ?? {
			id: uid(),
			routineId: routine.id,
			routineName: routine.name,
			startedAt: new Date().toISOString(),
			entries: []
		};

		// Resuming: continue after whatever was already logged, and skip the
		// Ready screen since the workout is plainly under way.
		if (session && session.entries.length > 0) {
			this.stepIndex = Math.min(session.entries.length, this.steps.length - 1);
			this.phase = session.entries.length >= this.steps.length ? 'finished' : 'working';
		}
	}

	get step(): Step | undefined {
		return this.steps[this.stepIndex];
	}

	get done(): number {
		return this.session.entries.filter((e) => !e.skipped).length;
	}

	get remaining(): number {
		return this.steps.length - this.stepIndex;
	}

	get isLastStep(): boolean {
		return this.stepIndex >= this.steps.length - 1;
	}

	/** Arms audio inside the user gesture that starts the session (§7). */
	async start(): Promise<void> {
		await armAudio();
		await keepScreenAwake();
		this.phase = 'working';
		this.#startElapsed();
		await this.#persist();
	}

	#startElapsed(): void {
		this.#stopElapsed();
		this.elapsed = 0;
		if (this.step && this.step.target.kind === 'duration') {
			this.#elapsedTimer = setInterval(() => (this.elapsed += 1), 1000);
		}
	}

	#stopElapsed(): void {
		if (this.#elapsedTimer) clearInterval(this.#elapsedTimer);
		this.#elapsedTimer = null;
	}

	async #persist(): Promise<void> {
		this.session = await putSession(this.session);
	}

	/** Write one row per set, never one per exercise (§4.3). */
	async log(value: { reps?: number; seconds?: number; rpe?: number }): Promise<void> {
		const step = this.step;
		if (!step || this.phase === 'finished') return;

		const entry: SetEntry = {
			exerciseId: step.exerciseId,
			itemId: step.itemId,
			setIndex: step.setIndex,
			side: step.side,
			reps: value.reps,
			seconds: value.seconds,
			rpe: value.rpe,
			skipped: false,
			completedAt: new Date().toISOString()
		};
		this.session.entries.push(entry);
		await this.#persist();
		await this.#advance(step.restSeconds);
	}

	/**
	 * Skipping writes a row rather than nothing, so statistics can tell "not
	 * done" from "never prescribed" (§7).
	 */
	async skip(): Promise<void> {
		const step = this.step;
		if (!step || this.phase === 'finished') return;

		this.session.entries.push({
			exerciseId: step.exerciseId,
			itemId: step.itemId,
			setIndex: step.setIndex,
			side: step.side,
			skipped: true,
			completedAt: new Date().toISOString()
		});
		await this.#persist();
		await this.#advance(0);
	}

	async #advance(restSeconds: number): Promise<void> {
		this.#stopElapsed();

		if (this.isLastStep) {
			await this.finish();
			return;
		}

		this.stepIndex += 1;

		if (restSeconds > 0) {
			this.startRest(restSeconds);
		} else {
			this.phase = 'working';
			this.#startElapsed();
		}
	}

	startRest(seconds: number): void {
		this.phase = 'resting';
		this.restRemaining = seconds;
		this.#clearRest();
		this.#restTimer = setInterval(() => {
			this.restRemaining -= 1;
			if (this.restRemaining <= 3 && this.restRemaining > 0) beep();
			if (this.restRemaining <= 0) {
				beep(true);
				this.endRest();
			}
		}, 1000);
	}

	adjustRest(delta: number): void {
		if (this.phase !== 'resting') return;
		this.restRemaining = Math.max(1, this.restRemaining + delta);
	}

	endRest(): void {
		this.#clearRest();
		this.restRemaining = 0;
		this.phase = 'working';
		this.#startElapsed();
	}

	#clearRest(): void {
		if (this.#restTimer) clearInterval(this.#restTimer);
		this.#restTimer = null;
	}

	async finish(): Promise<void> {
		this.#clearRest();
		this.#stopElapsed();
		this.phase = 'finished';
		this.session.endedAt = new Date().toISOString();
		await this.#persist();
		await allowScreenSleep();
	}

	/** Leaving without finishing: keep the session open so it can be resumed. */
	async suspend(): Promise<void> {
		this.#clearRest();
		this.#stopElapsed();
		await allowScreenSleep();
	}

	async setNotes(notes: string): Promise<void> {
		this.session.notes = notes;
		await this.#persist();
	}
}
