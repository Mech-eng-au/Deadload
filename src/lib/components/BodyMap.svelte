<script lang="ts">
	import { muscleLabel } from '$lib/catalog/muscles.js';
	import { slugsFor, type View } from '$lib/catalog/body-map.js';
	import frontSvg from '../../../static/muscles/front.svg?raw';
	import backSvg from '../../../static/muscles/back.svg?raw';

	/**
	 * Front and back body figures with the trained muscles coloured in
	 * (docs/SPEC.md §4.6).
	 *
	 * The figures are from `svelte-body-highlighter` (MIT), credited on the About
	 * page. Every muscle is its own group with a `data-slug`, so this recolours the real
	 * muscle shape rather than overlaying an approximation — which is the whole
	 * reason for the swap away from the previous anatomical drawings.
	 *
	 * Inlined with `?raw` rather than loaded as an `<img>`, because CSS cannot reach
	 * inside an image and recolouring by muscle is the entire point. The build
	 * script has already stripped the baked-in `fill`/`stroke` values and rewritten
	 * `id` to `data-part`, so two figures can sit on one page without duplicate ids
	 * and nothing fights the stylesheet.
	 *
	 * Colour is a ramp, not three unrelated tones: grey for a muscle not involved,
	 * light red for one assisting, strong red for one doing the work. Chosen with
	 * the user, whose objection to the first attempt was exactly that its three
	 * colours did not order.
	 *
	 * Never shown during a session (§4.6): mid-set the one available glance belongs
	 * to the set numbers and the countdown (§12).
	 */
	let {
		primary = [],
		secondary = [],
		size = 'normal',
		/** The legend is worth it once per screen, not once per figure. */
		legend = true
	}: {
		primary?: string[];
		secondary?: string[];
		size?: 'small' | 'normal';
		legend?: boolean;
	} = $props();

	const VIEWS: { id: View; svg: string }[] = [
		{ id: 'front', svg: frontSvg },
		{ id: 'back', svg: backSvg }
	];

	const width = $derived(size === 'small' ? 112 : 140);

	/**
	 * Tag the muscle groups in the markup rather than emitting a stylesheet.
	 *
	 * The first attempt injected a style element per figure, scoped by a wrapper
	 * class derived from the view — so on the compendium, where
	 * seventeen figures share a page, every figure picked up every other figure's
	 * rules and almost everything came out as "works". Marking up each instance's
	 * own copy of the markup cannot collide, because there is nothing global to
	 * collide with.
	 */
	function paint(svg: string, view: View): string {
		const prim = new Set(slugsFor(primary, view));
		const sec = new Set(slugsFor(secondary, view));
		return svg.replace(/data-slug="([^"]+)"/g, (whole, slug: string) =>
			prim.has(slug)
				? `${whole} class="dl-works"`
				: sec.has(slug)
					? `${whole} class="dl-assist"`
					: whole
		);
	}

	/** Read out on a long press, so the diagram is not the only way to know. */
	function described(view: View): string {
		const p = primary.filter((m) => slugsFor([m], view).length);
		const s = secondary.filter((m) => slugsFor([m], view).length);
		const parts = [];
		if (p.length) parts.push(`works ${p.map(muscleLabel).join(', ')}`);
		if (s.length) parts.push(`assists ${s.map(muscleLabel).join(', ')}`);
		return parts.length ? `${view} view: ${parts.join('; ')}` : `${view} view`;
	}
</script>

<!-- The ramp variables live on the outer wrapper, not on each figure: the legend
	 swatches are outside the figures and need the same values. -->
<div class="dl-map flex flex-col items-center gap-2">
	<div class="flex items-start justify-center gap-5">
		{#each VIEWS as view (view.id)}
			<figure class="flex flex-col items-center gap-1.5">
				<div
					class="dl-body"
					style="width:{width}px"
					role="img"
					aria-label={described(view.id)}
				>
					{@html paint(view.svg, view.id)}
				</div>
				<figcaption class="text-[10px] tracking-widest text-zinc-500 uppercase">
					{view.id}
				</figcaption>
			</figure>
		{/each}
	</div>

	{#if legend && (primary.length || secondary.length)}
		<ul class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
			<li class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-sm" style="background:var(--dl-works)"></span>works
			</li>
			{#if secondary.length}
				<li class="flex items-center gap-1.5">
					<span class="h-2.5 w-2.5 rounded-sm" style="background:var(--dl-assist)"></span>assists
				</li>
			{/if}
			<li class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-sm" style="background:var(--dl-body)"></span>not used
			</li>
		</ul>
	{/if}
</div>

<style>
	/* The ramp. Kept here rather than in app.css because nothing else uses it. */
	.dl-map {
		--dl-body: #3f3f46; /* zinc-700 — present, but plainly not involved */
		--dl-outline: #52525b;
		--dl-assist: #fca5a5; /* red-300 */
		--dl-works: #ef4444; /* red-500 */
	}
	.dl-body :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
	/* Default every part to the uninvolved tone; `paint()` tags the ones in play. */
	.dl-body :global(path) {
		fill: var(--dl-body);
	}
	.dl-body :global(.dl-assist path) {
		fill: var(--dl-assist);
	}
	.dl-body :global(.dl-works path) {
		fill: var(--dl-works);
	}
	.dl-body :global([data-part='outline'] path) {
		fill: none;
		stroke: var(--dl-outline);
	}
	/* Head and hands carry no muscle information, so they stay furniture. */
	.dl-body :global(:is([data-part='head'], [data-part='hair'], [data-part='hands']) path) {
		fill: #2e2e33;
	}
</style>
