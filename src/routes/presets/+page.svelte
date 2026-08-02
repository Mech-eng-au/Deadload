<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { PRESET_FILES, presetPath, type ReviewModel } from '$lib/import/index.js';
	import { commitReview, itemCount, outstanding, reviewFromText } from '$lib/import/runner.svelte.js';
	import { getExercise } from '$lib/catalog/index.js';
	import { equipmentLabel, missingEquipment, ownedEquipment } from '$lib/catalog/equipment.js';
	import { getSettings } from '$lib/db/settings.js';
	import { locale, t } from '$lib/i18n/locale.svelte.js';
	import type { EquipmentId, Settings } from '$lib/types.js';

	type Loaded = { file: string; review: ReviewModel; problems: number };

	let presets = $state<Loaded[]>([]);
	let loading = $state(true);
	let adding = $state<string | null>(null);
	let settings = $state<Settings | null>(null);

	const owned = $derived(ownedEquipment(settings));

	/**
	 * A preset is never filtered or hidden (§5.1) — it says what it needs. Better
	 * to know before adding it than to find out at the third exercise.
	 */
	function needs(review: ReviewModel, owned: EquipmentId[]): EquipmentId[] {
		const missing = new Set<EquipmentId>();
		for (const block of review.blocks) {
			for (const item of block.items) {
				const exercise = item.chosen ? getExercise(item.chosen) : undefined;
				if (!exercise || item.dropped) continue;
				for (const id of missingEquipment(exercise, owned)) missing.add(id);
			}
		}
		return [...missing];
	}

	// Presets are loaded through the very same parser and resolver as user
	// imports (§9), so any drift between the two fails here first.
	onMount(async () => {
		settings = await getSettings();
		const loaded: Loaded[] = [];
		for (const file of PRESET_FILES) {
			try {
				// The translation if there is one, the English original if not, so a
				// language can be added a file at a time rather than all nine at once.
				let response = await fetch(`${base}${presetPath(file, locale())}`);
				if (!response.ok) response = await fetch(`${base}${presetPath(file, 'en')}`);
				const review = await reviewFromText(await response.text(), file);
				loaded.push({ file, review, problems: outstanding(review) });
			} catch (err) {
				console.error(`preset ${file} failed to load`, err);
			}
		}
		presets = loaded;
		loading = false;
	});

	async function add(preset: Loaded) {
		adding = preset.file;
		try {
			const { routine } = await commitReview(preset.review, 'builtin');
			await goto(`${base}/routines/${routine.id}/`, { replaceState: true });
		} finally {
			adding = null;
		}
	}
</script>

<svelte:head>
	<title>{t.presets.title} · Deadload</title>
</svelte:head>

<a href="{base}/" data-sveltekit-replacestate class="text-sm text-zinc-400">{t.common.backRoutines}</a>
<h1 class="mt-2 font-display text-2xl font-bold">{t.presets.title}</h1>
<p class="mt-2 mb-5 text-sm text-zinc-500">
	{t.presets.notMedicalAdvice}
</p>

{#if loading}
	<p class="text-zinc-500">{t.common.loading}</p>
{:else if presets.length === 0}
	<p class="text-zinc-300">{t.presets.unreadable}</p>
{:else}
	<ul class="flex flex-col gap-3 pb-12">
		{#each presets as preset (preset.file)}
			<li class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<h2 class="font-medium">{preset.review.name}</h2>
				{#if preset.review.description}
					<p class="mt-1 text-sm text-zinc-400">{preset.review.description}</p>
				{/if}
				<p class="mt-2 text-xs text-zinc-500">
					{t.units.exercises(itemCount(preset.review))}
					{#if preset.review.goal}· {preset.review.goal}{/if}
					{#if preset.problems > 0}
						· <span class="text-amber-300">{t.presets.needMatching(preset.problems)}</span>
					{/if}
				</p>
				{#each [needs(preset.review, owned)] as missing (preset.file)}
					{#if missing.length}
						<p class="mt-2 text-xs text-amber-200/90">
							{t.presets.usesUnticked(
								t.units.list(missing.map((id) => equipmentLabel(id, t).toLowerCase()))
							)}
						</p>
					{/if}
				{/each}
				<button
					onclick={() => add(preset)}
					disabled={adding !== null}
					class="mt-4 min-h-14 w-full rounded-xl bg-zinc-100 py-3.5 font-semibold text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
				>
					{adding === preset.file ? t.presets.adding : t.presets.add}
				</button>
			</li>
		{/each}
	</ul>
{/if}
