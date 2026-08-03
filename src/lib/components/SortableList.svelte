<script lang="ts" generics="T extends { id: string }, S extends { id: string; items: T[] }">
	import {
		displacementAcross,
		dropTarget,
		sameSlot,
		stepSlot,
		type SectionSpans,
		type Slot
	} from '$lib/reorder.js';
	import { t } from '$lib/i18n/locale.svelte.js';
	import type { Snippet } from 'svelte';

	/**
	 * A routine's exercises, dragged into order by a handle (§12).
	 *
	 * Pointer events rather than HTML5 drag-and-drop, which does not exist on
	 * touch. Measured in **page** coordinates, so the list can auto-scroll under
	 * the finger without the arithmetic going wrong: a page-space centre stays
	 * true whatever the window does.
	 *
	 * The dragged card is the only thing that moves during the gesture, and the
	 * arrays are rewritten once on release — see `$lib/reorder` for why.
	 *
	 * **Amended 2026-08-03: it owns every section, not one list.** It used to be
	 * mounted once per section, which is exactly why a drag could not cross one:
	 * no instance could see another's cards, so a drop had nowhere else to land.
	 * A registry shared between sibling instances would have worked, and would
	 * have meant two components sharing the state of one gesture. One component
	 * rendering all the sections is simpler, and it gives the measuring pass —
	 * the thing that must happen exactly once, at pointerdown — a single owner.
	 *
	 * The chrome around each section belongs to the caller, through the `section`
	 * snippet: the routine screen puts a heading there, and the editor puts a
	 * whole card with a label field, a circuit switch and an Add button. That
	 * snippet is handed a `list` snippet to render wherever the cards belong.
	 */
	let {
		sections,
		onreorder,
		describe,
		itemClass = '',
		section,
		row
	}: {
		/**
		 * Generic in the section as well as the item, so a caller keeps its own
		 * fields on the way through — the routine screen needs `label` and `mode`
		 * in the snippet, and narrowing them to `{ id, items }` here would make
		 * every section a bag the caller has to look its real data back up from.
		 */
		sections: S[];
		/** Called once, on release, with where the item was and where it goes. */
		onreorder: (from: Slot, to: Slot) => void;
		/** Name of an item, for the handle's label — the only text a blind user gets. */
		describe: (item: T) => string;
		itemClass?: string;
		/** The chrome around one section. Must render `list` somewhere inside it. */
		section: Snippet<[S, number, Snippet]>;
		/** One card. `grip` must be rendered inside it, or nothing can drag. */
		row: Snippet<[T, Slot, Snippet<[Slot]>]>;
	} = $props();

	let sectionEls = $state<(HTMLElement | null)[]>([]);
	/**
	 * Keyed `section:index` rather than nested arrays. `bind:this={els[s][i]}`
	 * throws on the first render, because `els[s]` does not exist yet and Svelte
	 * is assigning into it — a flat key writes into an object that always does.
	 */
	let itemEls = $state<Record<string, HTMLLIElement | null>>({});
	const elKey = (slot: Slot) => `${slot.section}:${slot.index}`;
	let drag = $state<{ from: Slot; to: Slot; dy: number } | null>(null);

	/** Measured once at pointerdown; see the component comment for why that is safe. */
	let measured: SectionSpans[] = [];
	let startPageY = 0;
	let lastClientY = 0;
	let scrolling: number | null = null;

	/** How far a card that steps aside travels: the hole the dragged one left, plus the gap. */
	const GAP_PX = 8; // gap-2 on the list
	let stride = $state(0);

	const totalItems = $derived(sections.reduce((n, s) => n + s.items.length, 0));

	/** The transform for one card: the finger for the dragged one, a step aside for the rest. */
	function offset(slot: Slot): string | undefined {
		if (!drag) return undefined;
		if (sameSlot(slot, drag.from)) return `translateY(${drag.dy}px)`;
		const by = displacementAcross(drag.from, drag.to, slot);
		return by === 0 ? undefined : `translateY(${by * stride}px)`;
	}

	function measure(): boolean {
		const next: SectionSpans[] = [];
		for (let s = 0; s < sections.length; s++) {
			const el = sectionEls[s];
			if (!el) return false;
			const spans = [];
			for (let i = 0; i < sections[s].items.length; i++) {
				const li = itemEls[elKey({ section: s, index: i })];
				if (!li) return false;
				const r = li.getBoundingClientRect();
				spans.push({ top: r.top + window.scrollY, bottom: r.bottom + window.scrollY });
			}
			next.push({ top: el.getBoundingClientRect().top + window.scrollY, spans });
		}
		measured = next;
		return true;
	}

	function start(event: PointerEvent, slot: Slot) {
		// One exercise in the whole routine has nowhere to go, however many
		// sections there are to put it in.
		if (totalItems < 2) return;
		if (!measure()) return;
		event.preventDefault();
		startPageY = event.pageY;
		lastClientY = event.clientY;
		const span = measured[slot.section].spans[slot.index];
		stride = span.bottom - span.top + GAP_PX;
		drag = { from: slot, to: slot, dy: 0 };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		scrolling = requestAnimationFrame(edgeScroll);
	}

	function track(pageY: number) {
		if (!drag) return;
		const dy = pageY - startPageY;
		const span = measured[drag.from.section].spans[drag.from.index];
		const middle = (span.top + span.bottom) / 2 + dy;
		drag = { ...drag, dy, to: dropTarget(measured, drag.from, middle) };
	}

	function move(event: PointerEvent) {
		if (!drag) return;
		lastClientY = event.clientY;
		track(event.pageY);
	}

	/**
	 * Scroll when the finger nears an edge, because a twelve-exercise routine is
	 * taller than the screen and a drag that cannot leave the viewport cannot
	 * reorder it. It matters more than it did: another section is usually a
	 * longer journey than another card. Recomputed from the last known client Y
	 * each frame, since the page moves under a still finger and no pointer event
	 * fires for that.
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
		if (finished && !sameSlot(finished.to, finished.from)) onreorder(finished.from, finished.to);
	}

	/**
	 * The handle is a button, so the arrow keys have to work: it is the only way
	 * to reorder without a pointer, and it replaced two buttons that could be
	 * tabbed to. Past the end of a section they now step into the next one, so
	 * the keyboard reaches everywhere the finger can.
	 */
	function key(event: KeyboardEvent, slot: Slot) {
		const by = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
		if (by === 0) return;
		event.preventDefault();
		const to = stepSlot(
			sections.map((s) => s.items.length),
			slot,
			by
		);
		if (!to) return;
		onreorder(slot, to);
		// The button travels with its card, so focus has to follow it — otherwise
		// a second Arrow-Down moves whatever landed here instead. Clamped, because
		// stepping off the top of a section lands *after* the last card there.
		requestAnimationFrame(() => {
			const items = sections[to.section]?.items.length ?? 0;
			const index = Math.min(to.index, Math.max(0, items - 1));
			itemEls[elKey({ section: to.section, index })]
				?.querySelector<HTMLElement>('[data-dl-grip]')
				?.focus();
		});
	}
</script>

{#snippet grip(slot: Slot)}
	<button
		data-dl-grip
		aria-label={t.routine.dragHandle(describe(sections[slot.section].items[slot.index]))}
		onpointerdown={(e) => start(e, slot)}
		onpointermove={move}
		onpointerup={end}
		onpointercancel={end}
		onkeydown={(e) => key(e, slot)}
		class="min-h-11 min-w-11 shrink-0 cursor-grab touch-none rounded-lg text-zinc-500 active:cursor-grabbing disabled:opacity-25"
		disabled={totalItems < 2}
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

{#each sections as sec, s (sec.id)}
	{#snippet list()}
		<!--
			A section being dragged into is outlined, which is the only cue an empty
			one can give: it has no cards to open a gap between, so without this it
			is an invisible target. Not drawn on the section the card came from —
			there it would say "you are here", which is not the question.
		-->
		<ul
			class="flex flex-col gap-2 {drag && drag.to.section === s && drag.from.section !== s
				? 'rounded-xl outline-2 outline-offset-4 outline-dashed outline-zinc-600'
				: ''} {sec.items.length === 0 ? 'min-h-11' : ''}"
		>
			{#each sec.items as item, i (item.id)}
				{@const slot = { section: s, index: i }}
				<!-- The card under the finger must not be animated — it *is* the finger.
					 The ones stepping aside are, so the gap opening up reads as movement. -->
				<li
					bind:this={itemEls[elKey(slot)]}
					class="{itemClass} {drag && sameSlot(drag.from, slot)
						? 'relative z-20 shadow-xl shadow-black/60 ring-2 ring-zinc-100/25'
						: 'transition-transform duration-150'}"
					style={offset(slot) ? `transform: ${offset(slot)}` : undefined}
				>
					{@render row(item, slot, grip)}
				</li>
			{/each}
		</ul>
	{/snippet}

	<!-- The wrapper belongs to the component, because a section's *top* is what
		 decides which one a card has been dragged into. What goes inside it is the
		 caller's business. -->
	<div bind:this={sectionEls[s]}>
		{@render section(sec, s, list)}
	</div>
{/each}
