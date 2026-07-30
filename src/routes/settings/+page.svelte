<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { listRoutines } from '$lib/db/routines.js';
	import { countSessions } from '$lib/db/sessions.js';
	import { countAliasOverrides } from '$lib/db/aliases.js';
	import {
		backupIsDue,
		ensureStoragePersisted,
		getSettings,
		putSettings,
		recordExport,
		storageEstimate
	} from '$lib/db/settings.js';
	import { armAudio, cue, setSoundEnabled } from '$lib/session/audio.js';
	import { armSpeech, setSpeechEnabled, speak, speechAvailable } from '$lib/session/speech.js';
	import { DB_VERSION } from '$lib/db/schema.js';
	import { BUILD_LABEL } from '$lib/build-info.js';
	import {
		BackupError,
		parseBackup,
		restoreBackup,
		type BackupFile,
		type RestoreSummary
	} from '$lib/db/backup.js';
	import { exportBackupFile, exportCsvFile } from '$lib/db/export-file.js';
	import { catalog } from '$lib/catalog/index.js';
	import {
		EQUIPMENT,
		GATED_EQUIPMENT,
		availableCatalog,
		exerciseCountLabel,
		ownedEquipment
	} from '$lib/catalog/equipment.js';
	import type { EquipmentId, Settings } from '$lib/types.js';

	let settings = $state<Settings | null>(null);
	// Read once on mount rather than during render: it touches window.
	let canSpeak = $state(false);
	let usage = $state<number | undefined>();
	let routineCount = $state(0);
	let sessionCount = $state(0);
	let aliasCount = $state(0);

	let exporting = $state(false);
	let exportedAs = $state<string | null>(null);
	let error = $state<{ message: string; detail?: string } | null>(null);

	let pending = $state<BackupFile | null>(null);
	let restoring = $state(false);
	let summary = $state<RestoreSummary | null>(null);

	const due = $derived(backupIsDue(sessionCount, settings));

	async function refresh() {
		settings = await getSettings();
		routineCount = (await listRoutines()).length;
		sessionCount = await countSessions();
		aliasCount = await countAliasOverrides();
		({ usage } = await storageEstimate());
	}

	onMount(async () => {
		canSpeak = await speechAvailable();
		settings = await ensureStoragePersisted();
		await refresh();
	});

	async function toggleSound() {
		const next = !(settings?.soundEnabled ?? true);
		settings = await putSettings({ ...(await getSettings()), soundEnabled: next });
		setSoundEnabled(next);
		// Play the cue so the choice is audible rather than theoretical.
		if (next) {
			await armAudio();
			cue('done');
		}
	}

	async function toggleSpeech() {
		const next = !(settings?.speechEnabled ?? true);
		settings = await putSettings({ ...(await getSettings()), speechEnabled: next });
		setSpeechEnabled(next);
		// Same rule as the tones: hear the choice rather than read about it.
		if (next) {
			await armSpeech();
			speak('Next up, Side Plank. 45 seconds. Left side.');
		}
	}

	async function toggleAutoStart() {
		const next = !(settings?.autoStartSets ?? false);
		settings = await putSettings({ ...(await getSettings()), autoStartSets: next });
	}

	async function toggleAutoLog() {
		const next = !(settings?.autoLogTimedSets ?? false);
		settings = await putSettings({ ...(await getSettings()), autoLogTimedSets: next });
	}

	const owned = $derived(ownedEquipment(settings));
	const availableCount = $derived(availableCatalog(owned).length);
	const chair = EQUIPMENT.find((t) => !t.gated);

	/**
	 * Writing the resolved list rather than a patch is what keeps §5.1's
	 * three-valued setting honest: the first tap turns "never answered" into an
	 * actual answer, so unticking the last box stores `[]` — owns nothing — rather
	 * than dropping back to undefined and handing pull-ups back.
	 */
	async function toggleEquipment(id: EquipmentId) {
		const current = ownedEquipment(await getSettings());
		const next = current.includes(id)
			? current.filter((x) => x !== id)
			: EQUIPMENT.filter((t) => t.id === id || current.includes(t.id)).map((t) => t.id);
		settings = await putSettings({ ...(await getSettings()), ownedEquipment: next });
	}

	async function doExport() {
		exporting = true;
		error = null;
		exportedAs = null;
		try {
			const { filename, shared } = await exportBackupFile();
			settings = await recordExport(sessionCount);
			exportedAs = shared ? filename : `${filename} (saved to app storage)`;
		} catch (err) {
			error = { message: 'The backup could not be written.', detail: String(err) };
		} finally {
			exporting = false;
		}
	}

	async function doExportCsv() {
		exporting = true;
		error = null;
		exportedAs = null;
		try {
			const { filename } = await exportCsvFile();
			exportedAs = filename;
		} catch (err) {
			error = { message: 'The CSV could not be written.', detail: String(err) };
		} finally {
			exporting = false;
		}
	}

	async function pickFile(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		error = null;
		summary = null;
		try {
			pending = parseBackup(await file.text());
		} catch (err) {
			pending = null;
			if (err instanceof BackupError) error = { message: err.message, detail: err.detail };
			else error = { message: String(err) };
		}
	}

	async function applyRestore(mode: 'merge' | 'replace') {
		if (!pending) return;
		restoring = true;
		try {
			summary = await restoreBackup(pending, mode);
			pending = null;
			await refresh();
		} catch (err) {
			error = { message: 'The restore failed part way.', detail: String(err) };
		} finally {
			restoring = false;
		}
	}

	function mb(bytes?: number) {
		return bytes === undefined ? 'unknown' : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<svelte:head>
	<title>Settings · Deadload</title>
</svelte:head>

<section class="flex flex-col gap-6 pt-2 pb-12">
	<h1 class="font-display text-3xl font-bold">Settings</h1>

	{#if due}
		<div class="rounded-2xl border border-amber-800/70 bg-amber-950/30 p-4 text-sm">
			<p class="font-medium text-amber-100">You have {sessionCount} sessions logged.</p>
			<p class="mt-1 text-amber-200/80">
				Worth exporting a backup — it all lives on this phone and nowhere else.
			</p>
		</div>
	{/if}

	<!-- §5.1. The app assumes a floor, a wall and a chair; everything else is
		 something that had to be bought, so it is asked about rather than assumed. -->
	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">What you own</h2>
		<p class="mt-2 text-sm text-zinc-400">
			Tick what you have. Unticked equipment is left out of the catalog and out of the exercise
			picker, so you are only ever offered what you can actually do.
		</p>
		<ul class="mt-4 flex flex-col gap-2">
			{#each GATED_EQUIPMENT as type (type.id)}
				<li>
					<button
						onclick={() => toggleEquipment(type.id)}
						aria-pressed={owned.includes(type.id)}
						class="flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left {owned.includes(
							type.id
						)
							? 'border-zinc-500 bg-zinc-800/60'
							: 'border-zinc-800'}"
					>
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm {owned.includes(
								type.id
							)
								? 'border-zinc-100 bg-zinc-100 font-bold text-zinc-900'
								: 'border-zinc-600'}"
							aria-hidden="true"
						>
							{owned.includes(type.id) ? '✓' : ''}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block font-medium">{type.label}</span>
							<span class="mt-0.5 block text-xs text-zinc-500">{type.needs}</span>
						</span>
						<span class="shrink-0 text-xs whitespace-nowrap text-zinc-500 tabular-nums">
							{exerciseCountLabel(type.id)}
						</span>
					</button>
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-xs text-zinc-500">
			{availableCount} of {catalog.length} exercises available.
			{#if owned.length === 0}
				Nothing ticked, so that is everything you can do with a floor, a wall and a chair.
			{/if}
		</p>
		{#if chair}
			<p class="mt-2 text-xs text-zinc-500">{chair.note}</p>
		{/if}
		<p class="mt-2 text-xs text-zinc-500">
			This only changes what you get offered. A routine you already have, anything you have logged,
			and the built-in routines all keep every exercise in them — with a note about what they need.
		</p>
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Sound</h2>
		<p class="mt-2 text-sm text-zinc-400">
			Cues during a session: when a timed set starts, the last three seconds, time being up, a set
			logged, and the end of the workout. Without them you have to watch the screen.
		</p>
		<button
			onclick={toggleSound}
			class="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-700 px-4"
		>
			<span class="font-medium">Session sounds</span>
			<span
				class="rounded-full px-3 py-1 text-sm {settings?.soundEnabled === false
					? 'bg-zinc-800 text-zinc-400'
					: 'bg-zinc-100 font-medium text-zinc-900'}"
			>
				{settings?.soundEnabled === false ? 'Off' : 'On'}
			</span>
		</button>

		<p class="mt-5 text-sm text-zinc-400">
			The tones say that something changed. Speech says what: the next exercise, its set and its
			target, spoken as the rest starts. It is the last reason to look at the phone mid-workout.
		</p>
		{#if canSpeak}
			<button
				onclick={toggleSpeech}
				class="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-700 px-4"
			>
				<span class="font-medium">Speak the next exercise</span>
				<span
					class="rounded-full px-3 py-1 text-sm {settings?.speechEnabled === false
						? 'bg-zinc-800 text-zinc-400'
						: 'bg-zinc-100 font-medium text-zinc-900'}"
				>
					{settings?.speechEnabled === false ? 'Off' : 'On'}
				</span>
			</button>
		{:else}
			<p class="mt-4 text-sm text-zinc-500">
				This device has no speech engine, so there is nothing to turn on.
			</p>
		{/if}
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Auto mode</h2>
		<p class="mt-2 text-sm text-zinc-400">
			Normally the app waits for you at every set. These two hand it the parts it can be sure
			about. They work independently, and take effect on the next session you start.
		</p>
		<button
			onclick={toggleAutoStart}
			class="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-700 px-4"
		>
			<span class="font-medium">Start sets by itself</span>
			<span
				class="rounded-full px-3 py-1 text-sm {settings?.autoStartSets
					? 'bg-zinc-100 font-medium text-zinc-900'
					: 'bg-zinc-800 text-zinc-400'}"
			>
				{settings?.autoStartSets ? 'On' : 'Off'}
			</span>
		</button>
		<p class="mt-2 text-xs text-zinc-500">
			The set begins once the announcement has been read, instead of waiting for Start.
		</p>
		<button
			onclick={toggleAutoLog}
			class="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-700 px-4"
		>
			<span class="font-medium">Log timed sets by itself</span>
			<span
				class="rounded-full px-3 py-1 text-sm {settings?.autoLogTimedSets
					? 'bg-zinc-100 font-medium text-zinc-900'
					: 'bg-zinc-800 text-zinc-400'}"
			>
				{settings?.autoLogTimedSets ? 'On' : 'Off'}
			</span>
		</button>
		<p class="mt-2 text-xs text-zinc-500">
			A hold logs its target at zero and moves on. Overtime is not recorded in this mode, and reps
			sets are untouched — the app cannot see you finish those.
		</p>
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Backup</h2>
		<p class="mt-2 text-sm text-zinc-400">
			One file with every routine, every logged session, your learned exercise names and your
			settings.
		</p>
		<button
			onclick={doExport}
			disabled={exporting}
			class="mt-4 min-h-14 w-full rounded-xl bg-zinc-100 py-3.5 font-semibold text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
		>
			{exporting ? 'Preparing…' : 'Export backup'}
		</button>
		{#if exportedAs}
			<p class="mt-2 text-xs text-zinc-400">Wrote {exportedAs}</p>
		{/if}
		<button
			onclick={doExportCsv}
			disabled={exporting || sessionCount === 0}
			class="mt-3 min-h-14 w-full rounded-xl border border-zinc-700 py-3.5 font-medium disabled:opacity-40"
		>
			Export sets as CSV
		</button>
		<p class="mt-2 text-xs text-zinc-500">
			The JSON restores the app. The CSV is one row per set, for reading in a spreadsheet.
		</p>
		{#if settings?.lastExportAt}
			<p class="mt-2 text-xs text-zinc-500">
				Last export: {new Date(settings.lastExportAt).toLocaleString()}
			</p>
		{:else}
			<p class="mt-2 text-xs text-zinc-500">Never exported.</p>
		{/if}
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Restore</h2>
		{#if !pending && !summary}
			<p class="mt-2 text-sm text-zinc-400">
				Read a backup file back in. You choose whether to merge it with what is here or replace
				everything.
			</p>
			<label
				class="mt-4 block min-h-14 cursor-pointer rounded-xl border border-zinc-700 py-3.5 text-center font-medium"
			>
				Choose a backup file
				<input type="file" accept=".json,application/json" class="hidden" onchange={pickFile} />
			</label>
		{:else if pending}
			<p class="mt-2 text-sm text-zinc-300">
				{pending.routines.length} routine{pending.routines.length === 1 ? '' : 's'},
				{pending.sessions.length} session{pending.sessions.length === 1 ? '' : 's'},
				{Object.keys(pending.aliasOverrides).length} learned name{Object.keys(pending.aliasOverrides)
					.length === 1
					? ''
					: 's'}.
			</p>
			<p class="mt-1 text-xs text-zinc-500">
				Exported {new Date(pending.exportedAt).toLocaleString()}
			</p>
			<div class="mt-4 flex flex-col gap-3">
				<button
					onclick={() => applyRestore('merge')}
					disabled={restoring}
					class="min-h-14 w-full rounded-xl bg-zinc-100 py-3.5 font-semibold text-zinc-900"
				>
					Merge into what is here
				</button>
				<button
					onclick={() => applyRestore('replace')}
					disabled={restoring}
					class="min-h-14 w-full rounded-xl border border-red-900 py-3.5 font-medium text-red-200"
				>
					Replace everything
				</button>
				<button onclick={() => (pending = null)} class="min-h-12 text-sm text-zinc-500 underline">
					Cancel
				</button>
			</div>
			<p class="mt-3 text-xs text-zinc-500">
				Merge keeps what is on this phone, adds anything missing, and updates a routine only when
				the file's copy is newer. Replace deletes everything here first.
			</p>
		{:else if summary}
			<p class="mt-2 text-sm text-zinc-100">Restored.</p>
			<ul class="mt-2 flex flex-col gap-1 text-sm text-zinc-400">
				<li>{summary.routinesAdded} routines added, {summary.routinesUpdated} updated{summary.routinesSkipped ? `, ${summary.routinesSkipped} already current` : ''}</li>
				<li>{summary.sessionsAdded} sessions added{summary.sessionsSkipped ? `, ${summary.sessionsSkipped} already here` : ''}</li>
				<li>{summary.aliasesAdded} learned names added</li>
			</ul>
			<button onclick={() => (summary = null)} class="mt-4 min-h-12 text-sm text-zinc-400 underline">
				Done
			</button>
		{/if}
	</div>

	{#if error}
		<div class="rounded-xl border border-red-900 bg-red-950/40 p-4">
			<p class="font-medium text-red-200">{error.message}</p>
			{#if error.detail}
				<p class="mt-1 text-xs break-words text-red-300/80">{error.detail}</p>
			{/if}
		</div>
	{/if}

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Storage</h2>
		{#if settings?.persistGranted}
			<p class="mt-2 text-zinc-100">Your data is marked as persistent.</p>
			<p class="mt-1 text-sm text-zinc-400">
				Android will not clear it automatically when the device runs low on space. Uninstalling the
				app still deletes everything, so keep a backup.
			</p>
		{:else if settings}
			<p class="mt-2 text-zinc-100">Your data is stored, but not marked as persistent.</p>
			<p class="mt-1 text-sm text-zinc-400">
				It survives restarts, but the system may clear it if the device runs very low on space.
				Export a backup.
			</p>
		{:else}
			<p class="mt-2 text-zinc-500">Checking…</p>
		{/if}
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Data</h2>
		<dl class="mt-2 flex flex-col gap-1 text-zinc-300">
			<div class="flex justify-between"><dt>Routines</dt><dd>{routineCount}</dd></div>
			<div class="flex justify-between"><dt>Sessions</dt><dd>{sessionCount}</dd></div>
			<div class="flex justify-between"><dt>Learned names</dt><dd>{aliasCount}</dd></div>
			<div class="flex justify-between"><dt>Space used</dt><dd>{mb(usage)}</dd></div>
			<div class="flex justify-between"><dt>Database version</dt><dd>{DB_VERSION}</dd></div>
			<div class="flex justify-between"><dt>App build</dt><dd>{BUILD_LABEL}</dd></div>
		</dl>
		<p class="mt-3 text-xs text-zinc-500">Everything stays on this device.</p>
	</div>

	<a href="{base}/about/" class="text-center text-sm text-zinc-500 underline">
		About and attribution
	</a>
</section>
