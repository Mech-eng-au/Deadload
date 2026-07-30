<script lang="ts">
	import { base } from '$app/paths';
	import { muscleLabel } from '$lib/catalog/muscles.js';
	import { FIGURE_HEIGHT, FIGURE_WIDTH, VIEWS, type Region } from '$lib/catalog/body-map.js';

	/**
	 * Front and back anatomical figures with the trained muscles highlighted
	 * (docs/SPEC.md §4.6).
	 *
	 * The figures are `File:Muscular_system.svg` and `File:Muscular_system-back.svg`
	 * from Wikimedia Commons by Termininja, **CC BY-SA 3.0**, downloaded by
	 * `build-catalog.ts`, recorded in `attribution.json` and credited on the About
	 * page. They replaced a hand-drawn schematic at the user's request.
	 *
	 * The highlight positions live in `$lib/catalog/body-map.ts` so they can be
	 * unit-tested; this component only decides how they are drawn.
	 *
	 * Never shown during a session (§4.6): mid-set the one available glance belongs
	 * to the set numbers and the countdown (§12).
	 */
	let {
		primary = [],
		secondary = [],
		size = 'normal'
	}: { primary?: string[]; secondary?: string[]; size?: 'small' | 'normal' } = $props();

	const primarySet = $derived(new Set(primary));
	const secondarySet = $derived(new Set(secondary));

	/** Only the muscles in play get a shape; the rest of the figure is left alone. */
	function shown(regions: readonly Region[]): Region[] {
		return regions.filter((r) => primarySet.has(r.m) || secondarySet.has(r.m));
	}

	function opacity(muscle: string): number {
		return primarySet.has(muscle) ? 0.62 : 0.3;
	}

	function title(muscle: string): string {
		return `${muscleLabel(muscle)} — ${primarySet.has(muscle) ? 'works' : 'assists'}`;
	}

	const width = $derived(size === 'small' ? 104 : 136);
</script>

<div class="flex items-start justify-center gap-4">
	{#each VIEWS as view (view.id)}
		<figure class="flex flex-col items-center gap-1.5">
			<div class="relative" style="width:{width}px">
				<!-- A plain img, so the figure's ~300 kB of path data is fetched once and
					 cached rather than inlined into every page that shows one. -->
				<img
					src="{base}/muscles/{view.id}.svg"
					alt="The body from the {view.label}, with the muscles this trains highlighted"
					width={FIGURE_WIDTH}
					height={FIGURE_HEIGHT}
					style="width:{width}px;display:block"
				/>
				<svg
					viewBox="0 0 {FIGURE_WIDTH} {FIGURE_HEIGHT}"
					class="pointer-events-none absolute inset-0"
					style="width:{width}px"
					aria-hidden="true"
				>
					{#each shown(view.regions) as r, i (r.m + i)}
						<!-- hard-light keeps the drawing's shading visible through the wash
							 rather than flooding it flat. Where the blend mode is not
							 supported it falls back to a plain translucent fill, which still
							 reads. -->
						<ellipse
							cx={r.cx}
							cy={r.cy}
							rx={r.rx}
							ry={r.ry}
							transform={r.rot ? `rotate(${r.rot} ${r.cx} ${r.cy})` : undefined}
							fill="#7dd3fc"
							opacity={opacity(r.m)}
							style="mix-blend-mode:hard-light"
						>
							<title>{title(r.m)}</title>
						</ellipse>
					{/each}
				</svg>
			</div>
			<figcaption class="text-[10px] tracking-widest text-zinc-500 uppercase">
				{view.label}
			</figcaption>
		</figure>
	{/each}
</div>
