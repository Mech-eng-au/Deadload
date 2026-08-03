<script lang="ts">
	import { t } from '$lib/i18n/locale.svelte.js';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { ownedEquipment } from '$lib/catalog/equipment.js';
	import ExerciseDetail from '$lib/components/ExerciseDetail.svelte';
	import { getSettings } from '$lib/db/settings.js';
	import type { Settings } from '$lib/types.js';

	let { data } = $props();
	const e = $derived(data.exercise);

	let settings = $state<Settings | null>(null);
	onMount(async () => {
		settings = await getSettings();
	});

	// This screen is reachable from the catalog and from a ladder rung, so it can be
	// an exercise the user has not ticked the equipment for. ExerciseDetail says so
	// rather than hiding — §5.1 gates what the app offers, never what it shows.
	const owned = $derived(ownedEquipment(settings));
</script>

<svelte:head>
	<title>{e.name} · Deadload</title>
</svelte:head>

<article class="flex flex-col gap-6">
	<ExerciseDetail exercise={e} {owned} {heading} />
</article>

{#snippet heading()}
	<a href="{base}/catalog/" data-sveltekit-replacestate class="text-sm text-zinc-400 hover:text-zinc-100">
		{t.common.backCatalog}
	</a>
	<h1 class="mt-2 font-display text-3xl font-bold">{e.name}</h1>
{/snippet}
