import type { Step } from './steps.js';

/**
 * What the app says out loud (docs/SPEC.md §7). Pure, and separate from the
 * speech engine, because the wording is the part worth arguing about and the
 * part worth testing — `speech.ts` is a thin shell over `speechSynthesis`.
 *
 * Written for the ear, not the eye. `describeStep` produces "Set 2 of 3 · 45 s
 * · left", which a screen reads fine and a speech engine reads as "set two of
 * three, middot, forty-five s, middot, left". Everything here is spelled out.
 */

/** "45 seconds", "1 minute", "1 minute 30 seconds". */
export function spokenDuration(seconds: number): string {
	if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	const head = `${minutes} minute${minutes === 1 ? '' : 's'}`;
	return rest === 0 ? head : `${head} ${rest} second${rest === 1 ? '' : 's'}`;
}

function spokenTarget(step: Step): string {
	switch (step.target.kind) {
		case 'reps':
			return `${step.target.reps} rep${step.target.reps === 1 ? '' : 's'}`;
		case 'reps_range':
			return `${step.target.min} to ${step.target.max} reps`;
		case 'duration':
			return spokenDuration(step.target.seconds);
		case 'amrap':
			return 'as many as possible';
	}
}

/**
 * The sentence spoken when a step becomes the one to do next, e.g.
 * "Next up, push-ups. Set 2 of 3. 12 reps." — name first, because that is what
 * you are waiting to hear, then the position in the exercise, then the target.
 *
 * The set counter is left out when there is only one set: "set 1 of 1" is noise
 * in a sentence you are listening to rather than reading.
 */
export function announcementFor(step: Step, exerciseName: string): string {
	const parts = [`Next up, ${exerciseName}.`];

	if (step.round !== undefined && step.roundCount !== undefined && step.roundCount > 1) {
		// In a circuit the round is the number worth knowing (§4.2).
		parts.push(`Round ${step.round + 1} of ${step.roundCount}.`);
	} else if (step.setCount > 1) {
		parts.push(`Set ${step.setIndex + 1} of ${step.setCount}.`);
	}

	// Capitalised because it is its own sentence: "As many as possible." rather
	// than a fragment trailing off the exercise name.
	const target = spokenTarget(step);
	parts.push(`${target.charAt(0).toUpperCase()}${target.slice(1)}.`);

	if (step.side) parts.push(`${step.side === 'left' ? 'Left' : 'Right'} side.`);

	return parts.join(' ');
}
