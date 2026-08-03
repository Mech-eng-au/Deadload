import { getSettings, putSettings } from './db/settings.js';
import { DEFAULT_HANDLE_SIDE, resolveHandleSide } from './handle-side.js';
import type { HandleSide, Settings } from './types.js';

/**
 * The answer to `handle-side.ts`'s question, held for the whole app.
 *
 * Global rather than threaded down as a prop because the handle is rendered by
 * `SortableList`, which is mounted by the routine screen, by the editor, and by
 * the two routes that wrap the editor. Four call sites for one preference is
 * four chances to forget one, and the one that gets forgotten is always the
 * screen nobody opened — which is the lesson `tests/untranslated.test.ts` was
 * written for.
 *
 * Not mirrored into `localStorage` the way the language is. The language needed
 * that because `<html lang>` is set on a document that exists immediately,
 * before any database read can have finished. Here the worst case is one frame
 * with the handle on the default side, on a screen that is itself still waiting
 * for a routine to come out of IndexedDB — and it can only happen to a user who
 * chose the *non*-default side, since choosing the default is indistinguishable
 * from not having chosen. That is a small enough prize for a second copy of the
 * truth to keep in sync.
 */
let current = $state<HandleSide>(DEFAULT_HANDLE_SIDE);

export function handleSide(): HandleSide {
	return current;
}

/**
 * Tailwind's `order`, so the handle moves without the DOM order moving with it:
 * a screen reader still meets the exercise before the control that moves it,
 * whichever way the setting is pointing.
 */
export function handleOrderClass(): string {
	return current === 'left' ? 'order-first' : '';
}

/** Called once from the root layout, with whatever Settings holds. */
export function adoptHandleSide(saved: string | undefined): void {
	current = resolveHandleSide(saved);
}

export async function setHandleSide(value: HandleSide): Promise<Settings> {
	current = value;
	return putSettings({ ...(await getSettings()), handleSide: value });
}
