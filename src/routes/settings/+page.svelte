<script lang="ts">
	import { onMount } from 'svelte';
	import { listRoutines } from '$lib/db/routines.js';
	import { ensureStoragePersisted, storageEstimate } from '$lib/db/settings.js';
	import { DB_VERSION } from '$lib/db/schema.js';
	import type { Settings } from '$lib/types.js';

	let settings = $state<Settings | null>(null);
	let usage = $state<number | undefined>();
	let routineCount = $state(0);

	onMount(async () => {
		settings = await ensureStoragePersisted();
		({ usage } = await storageEstimate());
		routineCount = (await listRoutines()).length;
	});

	function mb(bytes?: number) {
		return bytes === undefined ? 'unknown' : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<svelte:head>
	<title>Settings · Deadload</title>
</svelte:head>

<section class="flex flex-col gap-6 pt-2">
	<h1 class="font-display text-3xl font-bold">Settings</h1>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Storage</h2>
		{#if settings?.persistGranted}
			<p class="mt-2 text-zinc-100">Your data is marked as persistent.</p>
			<p class="mt-1 text-sm text-zinc-400">
				Android will not clear it automatically when the device runs low on space. Uninstalling the
				app still deletes everything.
			</p>
		{:else if settings}
			<p class="mt-2 text-zinc-100">Your data is stored, but not marked as persistent.</p>
			<p class="mt-1 text-sm text-zinc-400">
				It survives restarts, but the system is allowed to clear it if the device runs very low on
				space. Keeping a backup will matter once export lands.
			</p>
		{:else}
			<p class="mt-2 text-zinc-500">Checking…</p>
		{/if}
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Data</h2>
		<dl class="mt-2 flex flex-col gap-1 text-zinc-300">
			<div class="flex justify-between"><dt>Routines</dt><dd>{routineCount}</dd></div>
			<div class="flex justify-between"><dt>Space used</dt><dd>{mb(usage)}</dd></div>
			<div class="flex justify-between"><dt>Database version</dt><dd>{DB_VERSION}</dd></div>
		</dl>
		<p class="mt-3 text-xs text-zinc-500">
			Everything stays on this device. Backup and restore arrive in a later milestone.
		</p>
	</div>
</section>
