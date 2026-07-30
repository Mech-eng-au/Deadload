<script lang="ts">
	import { muscleLabel } from '$lib/catalog/muscles.js';

	/**
	 * A schematic body, front and back, with the trained muscles lit up
	 * (docs/SPEC.md §4.6).
	 *
	 * Deliberately a **diagram rather than a drawing**: a connected silhouette with
	 * a rectangle or an ellipse per muscle region. Two reasons it is not an
	 * anatomical illustration. Licensing — the obvious source, wger's overlays on
	 * two Wikimedia figures, could not have its licence read from the development
	 * environment, and §4.1 requires a recorded licence per image. And coverage:
	 * those overlays carry 12 of the catalog's 17 muscles and are missing
	 * `adductors`, `abductors`, `forearms`, `middle back` and `neck` — very nearly
	 * the list of words a beginner needs explained. See §4.6.
	 *
	 * It is also 4 kB of inline SVG rather than an image per muscle, so §11's media
	 * budget stays spent on the photographs.
	 *
	 * Never shown during a session (§4.6): mid-set the set numbers and the
	 * countdown are what the one available glance is for.
	 */
	let {
		primary = [],
		secondary = [],
		size = 'normal'
	}: { primary?: string[]; secondary?: string[]; size?: 'small' | 'normal' } = $props();

	const primarySet = $derived(new Set(primary));
	const secondarySet = $derived(new Set(secondary));

	/** Bright for a muscle doing the work, mid for one assisting, dim for the rest. */
	function tone(muscle: string): string {
		if (primarySet.has(muscle)) return 'fill-zinc-100';
		if (secondarySet.has(muscle)) return 'fill-zinc-500';
		return 'fill-zinc-700/50';
	}

	function title(muscle: string): string {
		const name = muscleLabel(muscle);
		if (primarySet.has(muscle)) return `${name} — works`;
		if (secondarySet.has(muscle)) return `${name} — assists`;
		return name;
	}

	const frame = $derived(size === 'small' ? 'h-36' : 'h-64');

	// The silhouette, drawn first and never highlighted, so the figure reads as a
	// body whatever is lit. Arms and legs are connected to the torso rather than
	// floating beside it — the first version had detached blobs and looked like an
	// action figure.
	const TORSO = 'M 41 44 Q 60 39 79 44 L 85 66 L 75 100 L 78 122 L 42 122 L 45 100 L 35 66 Z';
	const ARM_L = 'M 38 52 L 27 62 L 21 108 L 19 140 L 30 140 L 30 108 L 41 66 Z';
	const ARM_R = 'M 82 52 L 93 62 L 99 108 L 101 140 L 90 140 L 90 108 L 79 66 Z';
	const LEG_L = 'M 45 120 L 43 172 L 46 196 L 47 230 L 58 230 L 57 196 L 58 172 L 59 120 Z';
	const LEG_R = 'M 75 120 L 77 172 L 74 196 L 73 230 L 62 230 L 63 196 L 62 172 L 61 120 Z';
</script>

<div class="flex items-end justify-center gap-5">
	{#each ['front', 'back'] as const as view (view)}
		<figure class="flex flex-col items-center gap-1.5">
			<svg
				viewBox="0 0 120 244"
				class="{frame} w-auto"
				role="img"
				aria-label="{view} of the body, with the muscles this trains highlighted"
			>
				<g class="fill-zinc-800">
					<ellipse cx="60" cy="20" rx="14" ry="16" />
					<rect x="53" y="31" width="14" height="14" />
					<path d={TORSO} />
					<path d={ARM_L} />
					<path d={ARM_R} />
					<path d={LEG_L} />
					<path d={LEG_R} />
					<ellipse cx="50" cy="233" rx="8" ry="5" />
					<ellipse cx="70" cy="233" rx="8" ry="5" />
				</g>

				<!-- Limbs and hips: same shapes in both views, different muscle on them. -->
				<rect x="53" y="32" width="14" height="12" rx="3" class={tone('neck')}>
					<title>{title('neck')}</title>
				</rect>
				<ellipse cx="38" cy="58" rx="10" ry="9" class={tone('shoulders')} />
				<ellipse cx="82" cy="58" rx="10" ry="9" class={tone('shoulders')}>
					<title>{title('shoulders')}</title>
				</ellipse>
				<ellipse cx="25" cy="114" rx="5.5" ry="17" class={tone('forearms')} />
				<ellipse cx="95" cy="114" rx="5.5" ry="17" class={tone('forearms')}>
					<title>{title('forearms')}</title>
				</ellipse>
				<rect x="42" y="112" width="7" height="18" rx="3.5" class={tone('abductors')} />
				<rect x="71" y="112" width="7" height="18" rx="3.5" class={tone('abductors')}>
					<title>{title('abductors')}</title>
				</rect>
				<rect x="46" y="186" width="9" height="40" rx="4" class={tone('calves')} />
				<rect x="65" y="186" width="9" height="40" rx="4" class={tone('calves')}>
					<title>{title('calves')}</title>
				</rect>

				{#if view === 'front'}
					<polygon points="44,46 53,42 53,53 42,55" class={tone('traps')} />
					<polygon points="76,46 67,42 67,53 78,55" class={tone('traps')}>
						<title>{title('traps')}</title>
					</polygon>
					<rect x="44" y="52" width="15" height="20" rx="5" class={tone('chest')} />
					<rect x="61" y="52" width="15" height="20" rx="5" class={tone('chest')}>
						<title>{title('chest')}</title>
					</rect>
					<rect x="48" y="74" width="24" height="32" rx="5" class={tone('abdominals')}>
						<title>{title('abdominals')}</title>
					</rect>
					<ellipse cx="31" cy="80" rx="6.5" ry="13" class={tone('biceps')} />
					<ellipse cx="89" cy="80" rx="6.5" ry="13" class={tone('biceps')}>
						<title>{title('biceps')}</title>
					</ellipse>
					<rect x="45" y="126" width="13" height="56" rx="6" class={tone('quadriceps')} />
					<rect x="62" y="126" width="13" height="56" rx="6" class={tone('quadriceps')}>
						<title>{title('quadriceps')}</title>
					</rect>
					<!--
						Two clearly separate strips, one per thigh, with a wide gap down the
						centreline and nothing bright reaching the pelvis.

						This is not fussiness. The first version put them at x 56-60 and
						60-64.5 starting at y 126, so they merged into one bright vertical bar
						straddling the crotch, and the user's first reaction to the shipped
						screenshot was that it "just looks like a dick". It did. Keep the gap,
						keep the top below the hip joint, and do not tidy these back into one
						centred shape.
					-->
					<polygon points="48,136 55,140 55,170 48,166" class={tone('adductors')} />
					<polygon points="72,136 65,140 65,170 72,166" class={tone('adductors')}>
						<title>{title('adductors')}</title>
					</polygon>
				{:else}
					<polygon points="46,42 74,42 79,66 60,76 41,66" class={tone('traps')}>
						<title>{title('traps')}</title>
					</polygon>
					<rect x="52" y="68" width="16" height="20" rx="4" class={tone('middle back')}>
						<title>{title('middle back')}</title>
					</rect>
					<polygon points="44,66 52,71 52,98 40,88" class={tone('lats')} />
					<polygon points="76,66 68,71 68,98 80,88" class={tone('lats')}>
						<title>{title('lats')}</title>
					</polygon>
					<rect x="50" y="90" width="20" height="20" rx="5" class={tone('lower back')}>
						<title>{title('lower back')}</title>
					</rect>
					<ellipse cx="31" cy="80" rx="6.5" ry="13" class={tone('triceps')} />
					<ellipse cx="89" cy="80" rx="6.5" ry="13" class={tone('triceps')}>
						<title>{title('triceps')}</title>
					</ellipse>
					<ellipse cx="52" cy="124" rx="9" ry="11" class={tone('glutes')} />
					<ellipse cx="68" cy="124" rx="9" ry="11" class={tone('glutes')}>
						<title>{title('glutes')}</title>
					</ellipse>
					<rect x="46" y="134" width="12" height="50" rx="6" class={tone('hamstrings')} />
					<rect x="62" y="134" width="12" height="50" rx="6" class={tone('hamstrings')}>
						<title>{title('hamstrings')}</title>
					</rect>
				{/if}
			</svg>
			<figcaption class="text-[10px] tracking-widest text-zinc-500 uppercase">{view}</figcaption>
		</figure>
	{/each}
</div>
