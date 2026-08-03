<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import RoutineEditor from '$lib/components/RoutineEditor.svelte';
	import { emptyRoutine, putRoutine } from '$lib/db/routines.js';
	import { t } from '$lib/i18n/locale.svelte.js';

	// Held in memory until saved, so abandoning the screen leaves nothing behind.
	let routine = $state(emptyRoutine());
	let saving = $state(false);

	async function save() {
		saving = true;
		try {
			const saved = await putRoutine({ ...routine, name: routine.name.trim() });
			await goto(`${base}/routines/${saved.id}/`, { replaceState: true });
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{t.routine.newTitle} · Deadload</title>
</svelte:head>

<a href="{base}/" data-sveltekit-replacestate class="text-sm text-zinc-400">{t.common.backRoutines}</a>
<h1 class="mt-2 mb-5 font-display text-2xl font-bold">{t.routine.newTitle}</h1>

<RoutineEditor bind:routine onsave={save} {saving} />
