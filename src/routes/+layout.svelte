<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import { goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { isTabRoot, pushBackGuard, registerBackHandler } from '$lib/nav/back.js';
	import { adoptSaved, t } from '$lib/i18n/locale.svelte.js';
	import { getSettings } from '$lib/db/settings.js';

	/**
	 * Slide between screens in the direction you actually moved: forward from the
	 * right, back from the left. The direction is the point — it says where you
	 * went, which an instant swap does not. Skipped entirely where the View
	 * Transitions API is missing or motion is unwanted (§12).
	 */
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		// `delta` is only set for history navigations; a link is always forward.
		const back = (navigation.delta ?? 0) < 0;
		document.documentElement.dataset.nav = back ? 'back' : 'forward';

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	let { children } = $props();

	/**
	 * Everywhere but mid-session. The tabs are ~64 dp of a 808 dp phone and
	 * nothing on them is worth a tap during a set, and the top inset has to
	 * belong to the player itself so the Leave row is not painted under the
	 * status bar (§7).
	 */
	const chrome = $derived(!page.route.id?.startsWith('/session/'));

	/**
	 * The four places worth going. Everything else in the app is reached by
	 * drilling into one of them, so a tab is always the way back out (§12).
	 *
	 * **`key` is not the label**, and that distinction is the whole point of it:
	 * the icon below used to be chosen with `tab.label === 'Routines'`, so
	 * translating the four labels would have silently given every tab the
	 * Settings icon. A key is a name for the destination; a label is words on a
	 * screen, and only one of the two is allowed to change with the language.
	 */
	const tabs = [
		{ key: 'routines', href: '/', match: (id: string) => id === '/' },
		{ key: 'catalog', href: '/catalog/', match: (id: string) => id.startsWith('/catalog') },
		{
			key: 'stats',
			href: '/stats/',
			match: (id: string) => id.startsWith('/stats') || id.startsWith('/history')
		},
		{
			key: 'settings',
			href: '/settings/',
			match: (id: string) => id.startsWith('/settings') || id.startsWith('/about')
		}
	] as const;
	const activeTab = $derived(tabs.findIndex((t) => t.match(page.route.id ?? '')));

	/**
	 * Back from the root of a tab goes home. Switching tabs replaces rather than
	 * pushes, so there is nothing behind a tab root to go back to and the press
	 * would otherwise leave the app. Anything deeper is left alone: back from an
	 * exercise goes up to the catalog, which is what it should do (§12).
	 */
	onMount(() =>
		pushBackGuard(() => {
			if (!chrome || !isTabRoot(page.route.id)) return false;
			void goto(`${base}/`, { replaceState: true });
			return true;
		})
	);

	/**
	 * The language is worked out synchronously from `localStorage` and the device
	 * before the first paint (see `locale.svelte.ts`); this is where the database
	 * confirms it. The two normally agree, and the one case they do not is a user
	 * who chose a language other than their phone's.
	 */
	onMount(async () => {
		adoptSaved((await getSettings()).language);
	});

	onMount(() => {
		let unregister: (() => void) | undefined;
		void registerBackHandler().then((fn) => (unregister = fn));

		// In the Android build the assets ship inside the APK; a service worker
		// there would only serve stale copies after an app update.
		if (import.meta.env.VITE_CAPACITOR !== '1' && 'serviceWorker' in navigator) {
			void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
		}

		return () => unregister?.();
	});
</script>

<!-- Android 15+ draws the WebView edge to edge, so the system bars overlap the
	 content unless the safe-area insets are honoured. `viewport-fit=cover` in
	 app.html is what makes these resolve to non-zero values. -->
<div
	class="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-[env(safe-area-inset-bottom)] {chrome
		? 'pt-[env(safe-area-inset-top)]'
		: ''}"
>
	<main class="flex-1 {chrome ? 'pt-5 pb-28' : ''}">
		{@render children()}
	</main>
</div>

{#if chrome}
	<!-- Navigation lives at the bottom, within reach of a thumb (§12), and is on
		 every screen: however deep you are, getting out is one tap and never
		 depends on what the back stack happens to contain. -->
	<nav
		class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur"
	>
		<div class="mx-auto flex max-w-2xl">
			{#each tabs as tab, i (tab.href)}
				<a
					href="{base}{tab.href}"
					data-sveltekit-replacestate
					aria-current={i === activeTab ? 'page' : undefined}
					class="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-2 text-[11px] {i ===
					activeTab
						? 'text-zinc-100'
						: 'text-zinc-500'}"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="h-5 w-5">
						{#if tab.key === 'routines'}
							<path d="M4 6h16M4 12h16M4 18h10" stroke-linecap="round" />
						{:else if tab.key === 'catalog'}
							<path d="M4 5h7v14H4zM13 5h7v14h-7z" stroke-linejoin="round" />
						{:else if tab.key === 'stats'}
							<path d="M5 19V11M12 19V5M19 19v-5" stroke-linecap="round" />
						{:else}
							<path d="M6 8h12M6 16h12" stroke-linecap="round" />
							<circle cx="10" cy="8" r="2" />
							<circle cx="15" cy="16" r="2" />
						{/if}
					</svg>
					<span class="w-full truncate px-0.5 text-center">{t.nav[tab.key]}</span>
				</a>
			{/each}
		</div>
	</nav>
{/if}
