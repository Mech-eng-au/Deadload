<script lang="ts">
	/**
	 * Snap-scrolling number column. Spinning to a value beats tapping "+" twenty
	 * times mid-set, but the steppers stay because a single correction is still
	 * one tap.
	 */
	let {
		value = $bindable(),
		min = 0,
		max = 120,
		label = ''
	}: { value: number; min?: number; max?: number; label?: string } = $props();

	const ITEM = 44; // px per row, matched by the CSS below
	const numbers = $derived(Array.from({ length: max - min + 1 }, (_, i) => min + i));

	let track = $state<HTMLDivElement | null>(null);
	/** Set while we scroll programmatically, so we don't fight the user. */
	let settling = false;
	let settleTimer: ReturnType<typeof setTimeout> | null = null;

	function scrollToValue(v: number, smooth = false) {
		if (!track) return;
		settling = true;
		track.scrollTo({ top: (v - min) * ITEM, behavior: smooth ? 'smooth' : 'auto' });
		setTimeout(() => (settling = false), smooth ? 350 : 60);
	}

	// Follow external changes: the steppers, and the prefill on a new set.
	$effect(() => {
		const v = value;
		if (!track) return;
		const shown = Math.round(track.scrollTop / ITEM) + min;
		if (shown !== v) scrollToValue(v);
	});

	function onScroll() {
		if (settling || !track) return;
		if (settleTimer) clearTimeout(settleTimer);
		settleTimer = setTimeout(() => {
			if (!track) return;
			const next = Math.min(max, Math.max(min, Math.round(track.scrollTop / ITEM) + min));
			if (next !== value) value = next;
		}, 80);
	}
</script>

<div class="relative h-[132px] select-none" aria-hidden="true">
	<!-- Highlight band marking the selected row. -->
	<div
		class="pointer-events-none absolute inset-x-0 top-[44px] h-[44px] rounded-lg border-y border-zinc-700 bg-zinc-800/40"
	></div>
	<div bind:this={track} onscroll={onScroll} class="wheel h-full overflow-y-auto">
		<div style="height:44px"></div>
		{#each numbers as n (n)}
			<div
				class="flex h-[44px] snap-center items-center justify-center font-display text-2xl tabular-nums transition-colors {n ===
				value
					? 'font-bold text-zinc-100'
					: 'text-zinc-600'}"
			>
				{n}
			</div>
		{/each}
		<div style="height:44px"></div>
	</div>
</div>
{#if label}
	<p class="mt-1 text-center text-xs text-zinc-500">{label}</p>
{/if}

<style>
	.wheel {
		scroll-snap-type: y mandatory;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}
	.wheel::-webkit-scrollbar {
		display: none;
	}
	.wheel > div {
		scroll-snap-align: center;
	}
</style>
