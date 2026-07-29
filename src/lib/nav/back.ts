/**
 * Android back button and back gesture.
 *
 * Capacitor's default is to exit the app when the WebView has nothing to go
 * back to, which makes the system back gesture close Deadload from anywhere.
 * Instead: let whatever is on screen handle it first (a modal closes, an active
 * session asks before leaving), then fall back to history, and only exit from
 * the home screen.
 */

/** Returns true if the guard consumed the press. */
export type BackGuard = () => boolean;

/**
 * The root screen of each tab other than home. Back from one of these means
 * "out of this tab", which is home — the alternative is leaving the app, since
 * switching tabs replaces rather than stacks. Back from anywhere *deeper* than
 * a tab root is left alone: it should go up one level, the way it already does.
 */
const TAB_ROOTS = ['/catalog', '/stats', '/settings'];

export function isTabRoot(routeId: string | null | undefined): boolean {
	return !!routeId && TAB_ROOTS.includes(routeId);
}

const guards: BackGuard[] = [];

export function pushBackGuard(guard: BackGuard): () => void {
	guards.push(guard);
	return () => {
		const at = guards.indexOf(guard);
		if (at !== -1) guards.splice(at, 1);
	};
}

/** Most recently registered guard wins, so a modal beats the page beneath it. */
function consumed(): boolean {
	for (let i = guards.length - 1; i >= 0; i--) {
		if (guards[i]()) return true;
	}
	return false;
}

export async function registerBackHandler(): Promise<() => void> {
	const { Capacitor } = await import('@capacitor/core');
	if (!Capacitor.isNativePlatform()) return () => {};

	const { App } = await import('@capacitor/app');
	const handle = await App.addListener('backButton', ({ canGoBack }) => {
		if (consumed()) return;
		if (canGoBack || window.history.length > 1) window.history.back();
		else void App.exitApp();
	});

	return () => void handle.remove();
}
