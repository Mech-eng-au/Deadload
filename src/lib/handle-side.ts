import type { HandleSide } from './types.js';

/**
 * Which edge the drag handle sits on (SPEC §12, added 2026-08-03).
 *
 * It sat on the right because that is where the card ran out of room, which is
 * not a reason. The right edge is the easy reach for a right thumb and the far
 * corner for a left one, so on a one-handed phone app the position is a real
 * accessibility question and the app cannot answer it: there is no
 * `navigator.handedness` and there never will be. So it is a setting, and the
 * setting is named for the edge rather than for a hand — "left-handed" would be
 * the app guessing at the mapping on the user's behalf, and someone who wants
 * the handle on the left for any other reason should not have to agree they are
 * left-handed to get it there.
 *
 * The rules live here, apart from the state that holds the answer, for the
 * reason §15 gives: a plain module can be tested and a `.svelte.ts` one cannot
 * — `$state` is a compiler construct, and vitest imports this directory raw.
 */

export const HANDLE_SIDES: readonly HandleSide[] = ['left', 'right'];

/**
 * Left. Asked for directly, from the phone, and it is also the side that does
 * not put a drag target inside the thumb's resting arc — where the gesture that
 * moves an exercise and the tap that opens it are a few millimetres apart.
 */
export const DEFAULT_HANDLE_SIDE: HandleSide = 'left';

/**
 * Anything unrecognised is treated as never having chosen. The realistic source
 * is a restored backup, which carries whatever was in Settings on the device
 * that wrote it — including a side written by a later version of the app.
 */
export function resolveHandleSide(saved: string | undefined): HandleSide {
	return HANDLE_SIDES.includes(saved as HandleSide) ? (saved as HandleSide) : DEFAULT_HANDLE_SIDE;
}
