<script lang="ts" generics="T extends { id: string }">
	import { displacement, dropIndex, type Span } from '$lib/reorder.js';
	import type { Snippet } from 'svelte';

	/**
	 * A list whose items are dragged into order by a handle (§12).
	 *
	 * Pointer events rather than HTML5 drag-and-drop, which does not exist on touch.
	 * Measured in **page** coordinates, so the list can auto-scroll under the finger
	 * without the arithmetic going wrong: a page-space centre stays true whatever
	 * the window does.
	 *
	 * The dragged card is the only thing that moves during the gesture, and the
	 * array is rewritten once on release — see `$lib/reorder` for why.
	 */
	let {
		items,
		onreorder,
		describe,
		itemClass = '',
		row
	}: {
		items: T[];
		/** Called once, on release, with the item's old and new index. */
		onreorder: (from: number, to: number) => void;
		/** Name of an item, for the handle's label — the only text a blind user gets. */
		describe: (item: T) => string;
		itemClass?: string;
		/** The card. `grip` must be rendered somewhere inside it, or nothing can drag. */
		row: Snippet<[T, number, Snippet<[number]>]>;
	} = $props();

	let lis = $state<(HTMLLIElement | null)[]>([]);
	let drag = $state<{ from: number; to: number; dy: number } | null>(null);

	/** Measured once at pointerdown; see the component comment for why that is safe. */
	let spans: Span[] = [];
	let startPageY = 0;
	let lastClientY = 0;
	let scrolling: number | null = null;

	/** How far a card that steps aside travels: the hole the dragged one left, plus the gap. */
	const GAP_PX = 8; // gap-2 on the list
	let stride = $state(0);

	/** The transform for one card: the finger for the dragged one, a step aside for the rest. */
	function offset(index: number): string | undefined {
		if (!drag) return undefined;
		if (index === drag.from) return `translateY(${drag.dy}px)`;
		const by = displacement(drag.from, drag.to, index);
		return by === 0 ? undefined : `translateY(${by * stride}px)`;
	}

	function start(event: PointerEvent, index: number) {
		if (items.length < 2) return;
		const cards = lis.slice(0, items.length);
		if (cards.some((li) => !li)) return;
		event.preventDefault();
		spans = cards.map((li) => {
			const r = li!.getBoundingClientRect();
			return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
		});
		startPageY = event.pageY;
		lastClientY = event.clientY;
		stride = spans[index].bottom - spans[index].top + GAP_PX;
		drag = { from: index, to: index, dy: 0 };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		scrolling = requestAnimationFrame(edgeScroll);
	}

	function track(pageY: number) {
		if (!drag) return;
		const dy = pageY - startPageY;
		const span = spans[drag.from];
		const middle = (span.top + span.bottom) / 2 + dy;
		drag = { ...drag, dy, to: dropIndex(spans, drag.from, middle) };
	}

	function move(event: PointerEvent) {
		if (!drag) return;
		lastClientY = event.clientY;
		track(event.pageY);
	}

	/**
	 * Scroll when the finger nears an edge, because a twelve-exercise routine is
	 * taller than the screen and a drag that cannot leave the viewport cannot
	 * reorder it. Recomputed from the last known client Y each frame: the page moves
	 * under a still finger, and no pointer event fires for that.
	 */
	function edgeScroll() {
		if (!drag) return;
		const margin = 96;
		const speed = 12;
		let by = 0;
		if (lastClientY < margin) by = -speed;
		else if (lastClientY > window.innerHeight - margin) by = speed;
		if (by !== 0) {
			const before = window.scrollY;
			window.scrollBy(0, by);
			if (window.scrollY !== before) track(lastClientY + window.scrollY);
		}
		scrolling = requestAnimationFrame(edgeScroll);
	}

	function end() {
		if (scrolling !== null) cancelAnimationFrame(scrolling);
		scrolling = null;
		const finished = drag;
		drag = null;
		if (finished && finished.to !== finished.from) onreorder(finished.from, finished.to);
	}

	/**
	 * The handle is a button, so the arrow keys have to work: it is the only way to
	 * reorder without a pointer, and it replaced two buttons that could be tabbed to.
	 */
	function key(event: KeyboardEvent, index: number) {
		const by = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
		if (by === 0) return;
		event.preventDefault();
		const to = index + by;
		if (to < 0 || to >= items.length) return;
		onreorder(index, to);
		// The button travels with its card, so focus has to follow it to the new
		// position — otherwise a second Arrow-Down moves whatever landed here instead.
		requestAnimationFrame(() => {
			lis[to]?.querySelector<HTMLElement>('[data-dl-grip]')?.focus();
		});
	}
</script>

{#snippet grip(index: number)}
	<button
		data-dl-grip
		aria-label="Reorder {describe(items[index])}"
		onpointerdown={(e) => start(e, index)}
		onpointermove={move}
		onpointerup={end}
		onpointercancel={end}
		onkeydown={(e) => key(e, index)}
		class="min-h-11 min-w-11 shrink-0 cursor-grab touch-none rounded-lg text-zinc-500 active:cursor-grabbing disabled:opacity-25"
		disabled={items.length < 2}
	>
		<!-- The two-bar grab handle every reorderable list on a phone uses. -->
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			aria-hidden="true"
			class="mx-auto h-5 w-5"
		>
			<path d="M6 9h12M6 15h12" stroke-linecap="round" />
		</svg>
	</button>
{/snippet}

<ul class="flex flex-col gap-2">
	{#each items as item, i (item.id)}
		<!-- The card under the finger must not be animated — it *is* the finger. The
			 ones stepping aside are, so the gap opening up reads as movement. -->
		<li
			bind:this={lis[i]}
			class="{itemClass} {drag?.from === i
				? 'relative z-20 ring-2 ring-zinc-100/25 shadow-xl shadow-black/60'
				: 'transition-transform duration-150'}"
			style={offset(i) ? `transform: ${offset(i)}` : undefined}
		>
			{@render row(item, i, grip)}
		</li>
	{/each}
</ul>
