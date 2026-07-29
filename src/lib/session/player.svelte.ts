import { putSession } from '../db/sessions.js';
import { uid } from '../db/routines.js';
import type { Routine, Session, SetEntry } from '../types.js';
import { armAudio, cue, setSoundEnabled } from './audio.js';
import { announcementFor } from './announce.js';
import { armSpeech, cancelSpeech, setSpeechEnabled, speak } from './speech.js';
import { getExercise } from '../catalog/index.js';
import { getSettings } from '../db/settings.js';
import { expandRoutine, type Step } from './steps.js';
import { easierVariant, harderVariant } from '../catalog/ladders.js';
import { allowScreenSleep, keepScreenAwake } from './wake-lock.js';

export type Phase = 'ready' | 'working' | 'resting' | 'finished';

/** How often the clock is re-read. Only affects display smoothness. */
const TICK_MS = 250;

/**
 * Session state machine (docs/SPEC.md §7).
 *
 *   Ready -> Working -> (log) -> Resting -> Working -> ... -> Finished
 *
 * Manual advance only. Two rules matter more than the rest:
 *
 * 1. One SetEntry row per performed set, written as it happens (§4.3).
 * 2. **Time is wall-clock, never counted.** Both the countdown on a timed set
 *    and the rest countdown are derived from timestamps persisted on the
 *    session. Counting ticks in memory loses the clock when the app is killed
 *    and drifts while the screen is off; deadlines survive both.
 * 3. **Every moment that needs a decision makes a sound.** During a plank the
 *    user cannot look at the screen at all, so a silent timer is useless.
 */
export class SessionPlayer {
	readonly routine: Routine;
	/** Rebuilt when an exercise is swapped, so the screen follows the change. */
	steps = $state<Step[]>([]);

	session = $state<Session>()!;
	phase = $state<Phase>('ready');
	stepIndex = $state(0);
	/** Seconds counted up on a timed set. */
	elapsed = $state(0);
	/** Seconds left of rest, never below zero. */
	restRemaining = $state(0);

	#ticker: ReturnType<typeof setInterval> | null = null;
	/** Last whole second announced during rest, so a 250 ms tick beeps once. */
	#lastRestCueAt = -1;
	/** The same, for the countdown on a timed set. */
	#lastSetCueAt = -1;

	constructor(routine: Routine, session?: Session) {
		this.routine = routine;
		// Swaps come off the stored session, so an exercise substituted before the
		// app was killed is still substituted after it is reopened.
		this.steps = expandRoutine(routine, session?.swaps ?? {});

		this.session = session ?? {
			id: uid(),
			routineId: routine.id,
			routineName: routine.name,
			startedAt: new Date().toISOString(),
			entries: []
		};

		if (session && session.endedAt) {
			this.stepIndex = Math.max(0, this.steps.length - 1);
			this.phase = 'finished';
			return;
		}

		// A session is under way once it has been started, which is not the same
		// as having logged something: being killed during the very first set
		// leaves no entries but a running clock, and that must still resume.
		const underWay =
			session &&
			(session.entries.length > 0 || !!session.activeStepStartedAt || !!session.restEndsAt);

		if (session && underWay) {
			this.stepIndex = Math.min(session.entries.length, this.steps.length - 1);

			const restLeft = this.#secondsUntil(session.restEndsAt);
			if (restLeft > 0) {
				this.phase = 'resting';
				this.restRemaining = restLeft;
			} else {
				this.phase = 'working';
				// Rest that expired while the app was closed is simply over.
				this.session.restEndsAt = undefined;
			}
			this.#syncFromClock();
		}
	}

	get step(): Step | undefined {
		return this.steps[this.stepIndex];
	}

	get done(): number {
		return this.session.entries.filter((e) => !e.skipped).length;
	}

	get isLastStep(): boolean {
		return this.stepIndex >= this.steps.length - 1;
	}

	get canUndo(): boolean {
		return this.session.entries.length > 0 && this.phase !== 'finished';
	}

	/** Seconds a timed set is meant to last, or undefined for a reps set. */
	get targetSeconds(): number | undefined {
		return this.step?.target.kind === 'duration' ? this.step.target.seconds : undefined;
	}

	/**
	 * Seconds left of a timed set. Goes negative when the hold continues past
	 * the target, which is worth showing rather than clamping.
	 */
	get remaining(): number | undefined {
		const target = this.targetSeconds;
		return target === undefined ? undefined : target - this.elapsed;
	}

	#secondsUntil(iso?: string): number {
		if (!iso) return 0;
		return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000));
	}

	#secondsSince(iso?: string): number {
		if (!iso) return 0;
		return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
	}

	/** Recompute both clocks from the stored deadlines. */
	#syncFromClock(): void {
		if (this.phase === 'resting') {
			const left = this.#secondsUntil(this.session.restEndsAt);
			this.restRemaining = left;

			if (left > 0 && left <= 3 && left !== this.#lastRestCueAt) {
				this.#lastRestCueAt = left;
				cue('countdown');
			}
			if (left <= 0) {
				if (this.#lastRestCueAt !== 0) {
					this.#lastRestCueAt = 0;
					cue('done');
				}
				this.endRest();
			}
		} else if (this.phase === 'working') {
			this.elapsed = this.#secondsSince(this.session.activeStepStartedAt);

			// A timed set is the case where the user cannot look at the screen at
			// all, so the end of it has to be audible.
			const left = this.remaining;
			if (left !== undefined) {
				if (left > 0 && left <= 3 && left !== this.#lastSetCueAt) {
					this.#lastSetCueAt = left;
					cue('countdown');
				}
				if (left <= 0 && this.#lastSetCueAt !== 0) {
					this.#lastSetCueAt = 0;
					cue('done');
				}
			}
		}
	}

	/** Announce the start of a timed set, so it is clear it is running. */
	#enterStep(): void {
		this.#lastSetCueAt = -1;
		if (this.targetSeconds !== undefined) cue('go');
	}

	/**
	 * Say what is coming, at the moment it becomes the next thing to do: as rest
	 * begins, or as the step itself begins when there is no rest. Not when rest
	 * ends — by then it has already been said, and repeating it would talk over
	 * the `done` cue that means "go".
	 */
	#announce(step: Step | undefined): void {
		if (!step) return;
		const name = getExercise(step.exerciseId)?.name;
		if (name) speak(announcementFor(step, name));
	}

	#startTicking(): void {
		this.#stopTicking();
		this.#ticker = setInterval(() => this.#syncFromClock(), TICK_MS);
		this.#syncFromClock();
	}

	#stopTicking(): void {
		if (this.#ticker) clearInterval(this.#ticker);
		this.#ticker = null;
	}

	/**
	 * Resume ticking after the component remounts. Safe to call repeatedly; the
	 * clocks come from the session, so nothing is lost by having been stopped.
	 */
	attach(): void {
		if (this.phase === 'working' || this.phase === 'resting') this.#startTicking();
	}

	detach(): void {
		this.#stopTicking();
	}

	async #persist(): Promise<void> {
		this.session = await putSession(this.session);
	}

	/** Arms audio inside the user gesture that starts the session (§7). */
	async start(): Promise<void> {
		await this.#armSound();
		await keepScreenAwake();
		this.phase = 'working';
		this.session.activeStepStartedAt = new Date().toISOString();
		await this.#persist();
		this.#enterStep();
		this.#announce(this.step);
		this.#startTicking();
	}

	async #armSound(): Promise<void> {
		const settings = await getSettings();
		setSoundEnabled(settings.soundEnabled ?? true);
		setSpeechEnabled(settings.speechEnabled ?? true);
		await armAudio();
		armSpeech();
	}

	/** Re-arm after a resume, since the AudioContext did not survive. */
	async resumeFromStored(): Promise<void> {
		await this.#armSound();
		await keepScreenAwake();
		if (!this.session.activeStepStartedAt) {
			this.session.activeStepStartedAt = new Date().toISOString();
			await this.#persist();
		}
		this.#startTicking();
	}

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
		cue('logged');
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
		await this.#advance(0);
	}

	/** The rung below the current exercise, if the ladders know one (§4.1). */
	get easier(): string | undefined {
		return this.step && easierVariant(this.step.exerciseId);
	}

	get harder(): string | undefined {
		return this.step && harderVariant(this.step.exerciseId);
	}

	/**
	 * Perform a different exercise for the rest of this item: the next rung on
	 * the ladder when a set was too easy or too hard, or any catalog exercise
	 * when something hurts today.
	 *
	 * Sets already logged keep the exercise they were actually done with — the
	 * log is what happened, not what was planned. The routine is left alone
	 * until the user says to keep the change on the finished screen.
	 */
	async swapTo(exerciseId: string): Promise<void> {
		const step = this.step;
		if (!step || this.phase === 'finished' || exerciseId === step.exerciseId) return;

		this.session.swaps = { ...this.session.swaps, [step.itemId]: exerciseId };
		this.steps = expandRoutine(this.routine, this.session.swaps);

		// The set begins again: you are not carrying the seconds already spent on
		// a movement you have just decided against into its replacement.
		if (this.phase === 'working') {
			this.session.activeStepStartedAt = new Date().toISOString();
			this.elapsed = 0;
			this.#enterStep();
		}
		this.#announce(this.step);
		await this.#persist();
	}

	/**
	 * Step back after an accidental log: drop the last entry and return to the
	 * set it belonged to. Rest is cancelled, because the point is to redo the
	 * set rather than to wait.
	 */
	async undo(): Promise<void> {
		if (!this.canUndo) return;
		this.session.entries.pop();
		this.stepIndex = Math.max(0, Math.min(this.session.entries.length, this.steps.length - 1));
		this.phase = 'working';
		this.restRemaining = 0;
		this.#lastRestCueAt = -1;
		this.#lastSetCueAt = -1;
		this.session.restEndsAt = undefined;
		this.session.endedAt = undefined;
		this.session.activeStepStartedAt = new Date().toISOString();
		this.#announce(this.step);
		await this.#persist();
		await keepScreenAwake();
		this.#startTicking();
	}

	async #advance(restSeconds: number): Promise<void> {
		if (this.isLastStep) {
			await this.finish();
			return;
		}

		this.stepIndex += 1;
		this.#lastRestCueAt = -1;

		if (restSeconds > 0) {
			this.phase = 'resting';
			this.restRemaining = restSeconds;
			this.session.restEndsAt = new Date(Date.now() + restSeconds * 1000).toISOString();
			this.session.activeStepStartedAt = undefined;
			this.#lastSetCueAt = -1;
		} else {
			this.phase = 'working';
			this.session.restEndsAt = undefined;
			this.session.activeStepStartedAt = new Date().toISOString();
			this.#enterStep();
		}
		this.#announce(this.step);

		await this.#persist();
		this.#startTicking();
	}

	adjustRest(delta: number): void {
		if (this.phase !== 'resting' || !this.session.restEndsAt) return;
		const next = Math.max(1, this.restRemaining + delta);
		this.restRemaining = next;
		this.session.restEndsAt = new Date(Date.now() + next * 1000).toISOString();
		this.#lastRestCueAt = -1;
		void this.#persist();
	}

	endRest(): void {
		this.restRemaining = 0;
		this.phase = 'working';
		this.session.restEndsAt = undefined;
		this.session.activeStepStartedAt = new Date().toISOString();
		this.elapsed = 0;
		this.#lastRestCueAt = -1;
		void this.#persist();
		this.#enterStep();
		this.#startTicking();
	}

	async finish(): Promise<void> {
		this.#stopTicking();
		cancelSpeech();
		cue('finished');
		this.phase = 'finished';
		this.session.endedAt = new Date().toISOString();
		this.session.restEndsAt = undefined;
		this.session.activeStepStartedAt = undefined;
		await this.#persist();
		await allowScreenSleep();
	}

	/** Leaving without finishing: the session stays open and resumable. */
	async suspend(): Promise<void> {
		this.#stopTicking();
		cancelSpeech();
		await allowScreenSleep();
	}

	async setNotes(notes: string): Promise<void> {
		this.session.notes = notes;
		await this.#persist();
	}
}
