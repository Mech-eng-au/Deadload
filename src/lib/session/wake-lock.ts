/**
 * Screen Wake Lock (§7). Without it the screen sleeps mid-set. The lock is
 * dropped by the system whenever the page is hidden, so it has to be taken
 * again on the way back rather than assumed to survive.
 */

let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire(): Promise<void> {
	if (!wanted || sentinel || !('wakeLock' in navigator)) return;
	try {
		sentinel = await navigator.wakeLock.request('screen');
		sentinel.addEventListener('release', () => {
			sentinel = null;
		});
	} catch {
		// Denied (often on low battery). Nothing else to do.
	}
}

function onVisibilityChange(): void {
	if (document.visibilityState === 'visible') void acquire();
}

export async function keepScreenAwake(): Promise<void> {
	wanted = true;
	document.addEventListener('visibilitychange', onVisibilityChange);
	await acquire();
}

export async function allowScreenSleep(): Promise<void> {
	wanted = false;
	document.removeEventListener('visibilitychange', onVisibilityChange);
	try {
		await sentinel?.release();
	} catch {
		// Already gone.
	}
	sentinel = null;
}

export function screenIsHeldAwake(): boolean {
	return sentinel !== null;
}
