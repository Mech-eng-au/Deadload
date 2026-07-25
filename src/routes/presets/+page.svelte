<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { PRESET_FILES, type ReviewModel } from '$lib/import/index.js';
	import { commitReview, itemCount, outstanding, reviewFromText } from '$lib/import/runner.svelte.js';

	type Loaded = { file: string; review: ReviewModel; problems: number };

	let presets = $state<Loaded[]>([]);
	let loading = $state(true);
	let adding = $state<string | null>(null);

	// Presets are loaded through the very same parser and resolver as user
	// imports (§9), so any drift between the two fails here first.
	onMount(async () => {
		const loaded: Loaded[] = [];
		for (const file of PRESET_FILES) {
			try {
				const text = await (await fetch(`${base}/presets/${file}`)).text();
				const review = await reviewFromText(text, file);
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
			await goto(`${base}/routines/${routine.id}/`);
		} finally {
			adding = null;
		}
	}
</script>

<svelte:head>
	<title>Built-in routines · Deadload</title>
</svelte:head>

<a href="{base}/" class="text-sm text-zinc-400">← Routines</a>
<h1 class="mt-2 font-display text-2xl font-bold">Built-in routines</h1>
<p class="mt-2 mb-5 text-sm text-zinc-500">
	These are general training routines, not medical advice.
</p>

{#if loading}
	<p class="text-zinc-500">Loading…</p>
{:else if presets.length === 0}
	<p class="text-zinc-300">The built-in routines could not be read.</p>
{:else}
	<ul class="flex flex-col gap-3 pb-12">
		{#each presets as preset (preset.file)}
			<li class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<h2 class="font-medium">{preset.review.name}</h2>
				{#if preset.review.description}
					<p class="mt-1 text-sm text-zinc-400">{preset.review.description}</p>
				{/if}
				<p class="mt-2 text-xs text-zinc-500">
					{itemCount(preset.review)} exercises
					{#if preset.review.goal}· {preset.review.goal}{/if}
					{#if preset.problems > 0}
						· <span class="text-amber-300">{preset.problems} need matching</span>
					{/if}
				</p>
				<button
					onclick={() => add(preset)}
					disabled={adding !== null}
					class="mt-4 min-h-14 w-full rounded-xl bg-zinc-100 py-3.5 font-semibold text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
				>
					{adding === preset.file ? 'Adding…' : 'Add to my routines'}
				</button>
			</li>
		{/each}
	</ul>
{/if}
