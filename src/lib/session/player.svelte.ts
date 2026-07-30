import { putSession } from '../db/sessions.js';
import { uid } from '../db/routines.js';
import type { Routine, Session, SetEntry } from '../types.js';
import { armAudio, cue, setSoundEnabled } from './audio.js';
import { announcementFor } from './announce.js';
import { armSpeech, cancelSpeech, setSpeechEnabled, speak } from './speech.js';
import { getExercise } from '../catalog/index.js';
import { isLoadable } from '../catalog/load.js';
import { getSettings } from '../db/settings.js';
import { expandRoutine, type Step } from './steps.js';
import { easierVariant, harderVariant } from '../catalog/ladders.js';
import { allowScreenSleep, keepScreenAwake } from './wake-lock.js';

export type Phase = 'ready' | 'preview' | 'working' | 'resting' | 'finished';

/** How often the clock is re-read. Only affects display smoothness. */
const TICK_MS = 250;

/**
 * Auto mode (§7). A beat after the announcement finishes, so the set does not
 * begin on the last syllable while the user is still lowering to the floor.
 */
const AUTO_START_AFTER_SPEECH_MS = 1200;
/** Used when nothing was spoken: the whole get-ready window has to fit here. */
const AUTO_START_SILENT_MS = 3500;

/**
 * Session state machine (docs/SPEC.md §7).
 *
 *   Ready -> Preview -> Working -> (log) -> Resting -> Working -> ... -> Finished
 *                  ^                    |
 *                  +---- no rest -------+
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
	/** True while auto mode is counting down to begin the set (§7). */
	autoStartPending = $state(false);
	/** Milliseconds left of that countdown, for the ring on the preview. */
	autoStartRemaining = $state(0);
	autoStartTotal = $state(0);
	#autoStartEndsAt = 0;

	#ticker: ReturnType<typeof setInterval> | null = null;
	#autoStartTimer: ReturnType<typeof setTimeout> | null = null;
	/** Auto mode, read from settings when the session is armed (§7). */
	#autoStart = false;
	#autoLogTimed = false;
	/** So a timed set at zero logs itself once rather than every tick. */
	#autoLogged = false;
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
			} else if (session.activeStepStartedAt) {
				this.phase = 'working';
			} else {
				// Neither clock is running, so the set had not been begun: come back
				// to the preview rather than to a timer that started while the app
				// was closed.
				this.phase = 'preview';
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
		} else if (this.phase === 'preview') {
			// Only the ring on the get-ready screen needs this; there is no clock.
			this.autoStartRemaining = Math.max(0, this.#autoStartEndsAt - Date.now());
		} else if (this.phase === 'working') {
			if (this.session.pausedAt) {
				// Frozen: the elapsed time is what it was when the pause began, and
				// no cue may fire while nothing is moving.
				this.elapsed = Math.max(
					0,
					Math.floor(
						(Date.parse(this.session.pausedAt) -
							Date.parse(this.session.activeStepStartedAt ?? this.session.pausedAt)) /
							1000
					)
				);
				return;
			}
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
				// Auto mode: the target is reached, so record it and move on. The
				// logged value is the target rather than the overtime, which is the
				// trade this mode makes (§7).
				if (left <= 0 && this.#autoLogTimed && !this.#autoLogged) {
					this.#autoLogged = true;
					void this.log({ seconds: this.targetSeconds, loadKg: this.prefillLoadKg() });
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
	#announce(step: Step | undefined, onDone?: () => void): boolean {
		if (!step) return false;
		const name = getExercise(step.exerciseId)?.name;
		return name ? speak(announcementFor(step, name), onDone) : false;
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
		this.#clearAutoStart();
	}

	async #persist(): Promise<void> {
		this.session = await putSession(this.session);
	}

	/** Arms audio inside the user gesture that starts the session (§7). */
	async start(): Promise<void> {
		await this.#armSound();
		await keepScreenAwake();
		this.#toPreview();
		await this.#persist();
	}

	/**
	 * Wait, showing what is coming, with no clock running (§7). Entered wherever
	 * the next set would otherwise begin the instant the last one ended: there is
	 * no rest to reposition in, and a timed set that starts while the phone is
	 * still talking has already eaten two seconds of the hold.
	 */
	#toPreview(): void {
		this.phase = 'preview';
		this.session.activeStepStartedAt = undefined;
		this.session.restEndsAt = undefined;
		this.session.pausedAt = undefined;
		this.elapsed = 0;
		this.#lastSetCueAt = -1;
		this.#stopTicking();
		this.#clearAutoStart();

		if (!this.#autoStart) {
			this.#announce(this.step);
			return;
		}
		// "Start when the reading is over" (§7): wait for the engine to finish, or
		// for a fixed window when there is nothing to wait for.
		const speaking = this.#announce(this.step, () =>
			this.#armAutoStart(AUTO_START_AFTER_SPEECH_MS)
		);
		if (!speaking) this.#armAutoStart(AUTO_START_SILENT_MS);
	}

	#armAutoStart(delayMs: number): void {
		this.#clearAutoStart();
		this.autoStartPending = true;
		this.autoStartTotal = delayMs;
		this.autoStartRemaining = delayMs;
		this.#autoStartEndsAt = Date.now() + delayMs;
		this.#autoStartTimer = setTimeout(() => {
			this.#autoStartTimer = null;
			void this.beginStep();
		}, delayMs);
		// The ring needs a tick of its own: the preview has no clock otherwise.
		this.#startTicking();
	}

	#clearAutoStart(): void {
		if (this.#autoStartTimer) clearTimeout(this.#autoStartTimer);
		this.#autoStartTimer = null;
		this.autoStartPending = false;
		this.autoStartRemaining = 0;
		this.#autoStartEndsAt = 0;
	}

	/** The user is in position: start the set, and the clock with it. */
	async beginStep(): Promise<void> {
		if (this.phase !== 'preview') return;
		this.#clearAutoStart();
		this.#autoLogged = false;
		this.session.pausedAt = undefined;
		this.phase = 'working';
		this.session.activeStepStartedAt = new Date().toISOString();
		this.elapsed = 0;
		await this.#persist();
		this.#enterStep();
		this.#startTicking();
	}

	async #armSound(): Promise<void> {
		const settings = await getSettings();
		setSoundEnabled(settings.soundEnabled ?? true);
		setSpeechEnabled(settings.speechEnabled ?? true);
		// Both default off: manual advance is the rule, and auto mode relaxes it
		// only where the user has said so.
		this.#autoStart = settings.autoStartSets ?? false;
		this.#autoLogTimed = settings.autoLogTimedSets ?? false;
		await armAudio();
		await armSpeech();
	}

	/** Re-arm after a resume, since the AudioContext did not survive. */
	async resumeFromStored(): Promise<void> {
		await this.#armSound();
		await keepScreenAwake();
		// Reopening on a preview says it again and re-arms auto mode: otherwise a
		// resumed session in auto mode would wait on a timer that died with the app.
		if (this.phase === 'preview') {
			this.#toPreview();
			await this.#persist();
			return;
		}
		// A set that was under way keeps its deadline; one that had not begun
		// waits on the preview rather than starting a clock nobody asked for.
		if (this.phase === 'working' && !this.session.activeStepStartedAt) {
			this.session.activeStepStartedAt = new Date().toISOString();
			await this.#persist();
		}
		if (this.phase === 'working' || this.phase === 'resting') this.#startTicking();
	}

	/**
	 * What the load stepper should start at (§4.5): whatever this exercise was
	 * last logged with in this session, falling back to what the routine planned.
	 * Changing the dumbbell once should not mean changing it again on every set —
	 * and the change stays on the session, not on the routine, for the same reason
	 * a swap does (§7).
	 */
	prefillLoadKg(step: Step | undefined = this.step): number | undefined {
		if (!step) return undefined;
		// A swap keeps the item's id but changes the exercise (§7), so a load carried
		// forward has to be checked against what is actually being performed now:
		// swapping a kettlebell row for a bodyweight one must not keep the 10 kg.
		const exercise = getExercise(step.exerciseId);
		if (!exercise || !isLoadable(exercise)) return undefined;
		for (let i = this.session.entries.length - 1; i >= 0; i--) {
			const entry = this.session.entries[i];
			if (entry.itemId === step.itemId && !entry.skipped && entry.loadKg !== undefined) {
				return entry.loadKg;
			}
		}
		return step.loadKg;
	}

	async log(value: {
		reps?: number;
		seconds?: number;
		rpe?: number;
		loadKg?: number;
	}): Promise<void> {
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
			loadKg: value.loadKg,
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

	/** Whether auto mode will begin this set without a tap (§7). */
	get autoStartOn(): boolean {
		return this.#autoStart;
	}

	get paused(): boolean {
		return !!this.session.pausedAt;
	}

	/**
	 * Pause a timed set, and resume it (§7). There is no counter to stop: the
	 * pause is a timestamp, and resuming moves the start of the set forward by
	 * exactly as long as the pause lasted, so the remaining time is unchanged
	 * and the whole thing survives the app being killed while paused.
	 */
	async togglePause(): Promise<void> {
		if (this.phase !== 'working' || this.targetSeconds === undefined) return;

		if (this.session.pausedAt) {
			const paused = Date.now() - Date.parse(this.session.pausedAt);
			const startedAt = Date.parse(this.session.activeStepStartedAt ?? new Date().toISOString());
			this.session.activeStepStartedAt = new Date(startedAt + Math.max(0, paused)).toISOString();
			this.session.pausedAt = undefined;
			// The last three seconds should tick again if the pause crossed them.
			this.#lastSetCueAt = -1;
		} else {
			this.session.pausedAt = new Date().toISOString();
		}
		await this.#persist();
		this.#syncFromClock();
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
		this.restRemaining = 0;
		this.#lastRestCueAt = -1;
		this.session.endedAt = undefined;
		this.#toPreview();
		await this.#persist();
		await keepScreenAwake();
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
			this.#announce(this.step);
			await this.#persist();
			this.#startTicking();
			return;
		}

		this.#toPreview();
		await this.#persist();
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
		this.session.pausedAt = undefined;
		this.elapsed = 0;
		this.#lastRestCueAt = -1;
		void this.#persist();
		this.#enterStep();
		this.#startTicking();
	}

	async finish(): Promise<void> {
		this.#stopTicking();
		this.#clearAutoStart();
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
		this.#clearAutoStart();
		cancelSpeech();
		await allowScreenSleep();
	}

	async setNotes(notes: string): Promise<void> {
		this.session.notes = notes;
		await this.#persist();
	}
}
