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

/**
 * "10 kilos", "1 kilo", "2 and a half kilos" (§4.5). Spelled out for the ear
 * like everything else here: an engine handed "10 kg" reads it "ten kay gee",
 * and "2.5" comes out as "two point five" — right, but not how anybody says it
 * about a dumbbell.
 */
export function spokenKg(kg: number): string {
	const rounded = Number(kg.toFixed(2));
	if (rounded === 1) return '1 kilo';
	if (Number.isInteger(rounded)) return `${rounded} kilos`;
	const whole = Math.floor(rounded);
	if (Math.abs(rounded - whole - 0.5) < 0.001) {
		return whole === 0 ? 'half a kilo' : `${whole} and a half kilos`;
	}
	return `${rounded} kilos`;
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
	// The load rides on the target sentence rather than standing alone: "12 reps at
	// 10 kilos" is how a person would say it, and "10 kilos." on its own would need
	// the listener to work out what it belongs to.
	const load = step.loadKg === undefined ? '' : ` at ${spokenKg(step.loadKg)}`;
	parts.push(`${target.charAt(0).toUpperCase()}${target.slice(1)}${load}.`);

	if (step.side) parts.push(`${step.side === 'left' ? 'Left' : 'Right'} side.`);

	return parts.join(' ');
}
