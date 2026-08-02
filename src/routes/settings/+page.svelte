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
		equipmentLabel,
		equipmentNeeds,
		equipmentNote,
		exerciseCountLabel,
		ownedEquipment
	} from '$lib/catalog/equipment.js';
	import { LOCALES, resolveLocale, type Locale } from '$lib/i18n/index.js';
	import { adoptSaved, locale, setLocale, t } from '$lib/i18n/locale.svelte.js';
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
			exportedAs = shared ? filename : t.settings.savedToAppStorage(filename);
		} catch (err) {
			error = { message: t.settings.backupFailed, detail: String(err) };
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
			error = { message: t.settings.csvFailed, detail: String(err) };
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
			error = { message: t.settings.restoreFailed, detail: String(err) };
		} finally {
			restoring = false;
		}
	}

	function mb(bytes?: number) {
		return bytes === undefined ? t.common.unknown : t.units.megabytes(bytes / 1024 / 1024);
	}

	/**
	 * Language (§16). Three-valued exactly as the equipment above is: "Follow the
	 * phone" is the *absence* of an answer, not a third language, so choosing it
	 * clears the setting rather than writing the phone's current language into it
	 * — otherwise a user who moves the phone to another language keeps the old one
	 * for reasons the app can no longer explain.
	 */
	const deviceLocale = $derived(
		resolveLocale(undefined, typeof navigator === 'undefined' ? [] : navigator.languages)
	);

	async function chooseLanguage(value: Locale | null) {
		if (value === null) {
			settings = await putSettings({ ...(await getSettings()), language: undefined });
			adoptSaved(undefined);
		} else {
			await setLocale(value);
			settings = await getSettings();
		}
	}
</script>

<svelte:head>
	<title>{t.settings.title} · Deadload</title>
</svelte:head>

<section class="flex flex-col gap-6 pt-2 pb-12">
	<h1 class="font-display text-3xl font-bold">{t.settings.title}</h1>

	{#if due}
		<div class="rounded-2xl border border-amber-800/70 bg-amber-950/30 p-4 text-sm">
			<p class="font-medium text-amber-100">{t.settings.backupDue(sessionCount)}</p>
			<p class="mt-1 text-amber-200/80">
				{t.settings.backupDueHint}
			</p>
		</div>
	{/if}

	<!-- §16. First, because it changes every other word on this screen. -->
	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.settings.language}</h2>
		<p class="mt-2 text-sm text-zinc-400">{t.settings.languageIntro}</p>
		<ul class="mt-4 flex flex-col gap-2">
			{#each [{ id: null, endonym: t.settings.followDevice }, ...LOCALES] as option (option.id ?? 'device')}
				{@const chosen =
					option.id === null ? settings?.language === undefined : settings?.language === option.id}
				<li>
					<button
						onclick={() => chooseLanguage(option.id)}
						aria-pressed={chosen}
						class="flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left {chosen
							? 'border-zinc-500 bg-zinc-800/60'
							: 'border-zinc-800'}"
					>
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm {chosen
								? 'border-zinc-100 bg-zinc-100 font-bold text-zinc-900'
								: 'border-zinc-600'}"
							aria-hidden="true">{chosen ? '✓' : ''}</span
						>
						<span class="min-w-0 flex-1">
							<span class="block font-medium">{option.endonym}</span>
							{#if option.id === null}
								<span class="mt-0.5 block text-xs text-zinc-500">
									{t.settings.followDeviceHint(
										LOCALES.find((l) => l.id === deviceLocale)?.endonym ?? deviceLocale
									)}
								</span>
							{/if}
						</span>
					</button>
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-xs text-zinc-500">{t.settings.spokenStaysEnglish}</p>
	</div>

	<!-- §5.1. The app assumes a floor, a wall and a chair; everything else is
		 something that had to be bought, so it is asked about rather than assumed. -->
	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.settings.whatYouOwn}</h2>
		<p class="mt-2 text-sm text-zinc-400">
			{t.settings.whatYouOwnIntro}
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
							<span class="block font-medium">{equipmentLabel(type.id, t)}</span>
							<span class="mt-0.5 block text-xs text-zinc-500">{equipmentNeeds(type.id, t)}</span>
						</span>
						<span class="shrink-0 text-xs whitespace-nowrap text-zinc-500 tabular-nums">
							{exerciseCountLabel(type.id, t)}
						</span>
					</button>
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-xs text-zinc-500">
			{t.settings.availableCount(availableCount, catalog.length)}
			{#if owned.length === 0}
				{t.settings.nothingTicked}
			{/if}
		</p>
		{#if chair}
			<p class="mt-2 text-xs text-zinc-500">{equipmentNote(chair.id, t)}</p>
		{/if}
		<p class="mt-2 text-xs text-zinc-500">
			{t.settings.gatingScope}
		</p>
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.settings.sound}</h2>
		<p class="mt-2 text-sm text-zinc-400">
			{t.settings.soundIntro}
		</p>
		<button
			onclick={toggleSound}
			class="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-700 px-4"
		>
			<span class="font-medium">{t.settings.sessionSounds}</span>
			<span
				class="rounded-full px-3 py-1 text-sm {settings?.soundEnabled === false
					? 'bg-zinc-800 text-zinc-400'
					: 'bg-zinc-100 font-medium text-zinc-900'}"
			>
				{settings?.soundEnabled === false ? t.common.off : t.common.on}
			</span>
		</button>

		<p class="mt-5 text-sm text-zinc-400">
			{t.settings.speechIntro}
		</p>
		{#if canSpeak}
			<button
				onclick={toggleSpeech}
				class="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-700 px-4"
			>
				<span class="font-medium">{t.settings.speakNext}</span>
				<span
					class="rounded-full px-3 py-1 text-sm {settings?.speechEnabled === false
						? 'bg-zinc-800 text-zinc-400'
						: 'bg-zinc-100 font-medium text-zinc-900'}"
				>
					{settings?.speechEnabled === false ? t.common.off : t.common.on}
				</span>
			</button>
		{:else}
			<p class="mt-4 text-sm text-zinc-500">
				{t.settings.noSpeechEngine}
			</p>
		{/if}
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.settings.autoMode}</h2>
		<p class="mt-2 text-sm text-zinc-400">
			{t.settings.autoModeIntro}
		</p>
		<button
			onclick={toggleAutoStart}
			class="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-700 px-4"
		>
			<span class="font-medium">{t.settings.autoStart}</span>
			<span
				class="rounded-full px-3 py-1 text-sm {settings?.autoStartSets
					? 'bg-zinc-100 font-medium text-zinc-900'
					: 'bg-zinc-800 text-zinc-400'}"
			>
				{settings?.autoStartSets ? t.common.on : t.common.off}
			</span>
		</button>
		<p class="mt-2 text-xs text-zinc-500">
			{t.settings.autoStartHint}
		</p>
		<button
			onclick={toggleAutoLog}
			class="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-700 px-4"
		>
			<span class="font-medium">{t.settings.autoLog}</span>
			<span
				class="rounded-full px-3 py-1 text-sm {settings?.autoLogTimedSets
					? 'bg-zinc-100 font-medium text-zinc-900'
					: 'bg-zinc-800 text-zinc-400'}"
			>
				{settings?.autoLogTimedSets ? t.common.on : t.common.off}
			</span>
		</button>
		<p class="mt-2 text-xs text-zinc-500">
			{t.settings.autoLogHint}
		</p>
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.settings.backup}</h2>
		<p class="mt-2 text-sm text-zinc-400">
			{t.settings.backupIntro}
		</p>
		<button
			onclick={doExport}
			disabled={exporting}
			class="mt-4 min-h-14 w-full rounded-xl bg-zinc-100 py-3.5 font-semibold text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
		>
			{exporting ? t.settings.preparing : t.settings.exportBackup}
		</button>
		{#if exportedAs}
			<p class="mt-2 text-xs text-zinc-400">{t.settings.wrote(exportedAs)}</p>
		{/if}
		<button
			onclick={doExportCsv}
			disabled={exporting || sessionCount === 0}
			class="mt-3 min-h-14 w-full rounded-xl border border-zinc-700 py-3.5 font-medium disabled:opacity-40"
		>
			{t.settings.exportCsv}
		</button>
		<p class="mt-2 text-xs text-zinc-500">
			{t.settings.exportHint}
		</p>
		{#if settings?.lastExportAt}
			<p class="mt-2 text-xs text-zinc-500">
				{t.settings.lastExport(t.units.dateTime(settings.lastExportAt))}
			</p>
		{:else}
			<p class="mt-2 text-xs text-zinc-500">{t.settings.neverExported}</p>
		{/if}
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.settings.restore}</h2>
		{#if !pending && !summary}
			<p class="mt-2 text-sm text-zinc-400">
				{t.settings.restoreIntro}
			</p>
			<label
				class="mt-4 block min-h-14 cursor-pointer rounded-xl border border-zinc-700 py-3.5 text-center font-medium"
			>
				{t.settings.chooseBackup}
				<input type="file" accept=".json,application/json" class="hidden" onchange={pickFile} />
			</label>
		{:else if pending}
			<p class="mt-2 text-sm text-zinc-300">
				{t.settings.fileHolds(
					t.units.routines(pending.routines.length),
					t.units.sessions(pending.sessions.length),
					t.units.learnedNames(Object.keys(pending.aliasOverrides).length)
				)}
			</p>
			<p class="mt-1 text-xs text-zinc-500">
				{t.settings.exportedOn(t.units.dateTime(pending.exportedAt))}
			</p>
			<div class="mt-4 flex flex-col gap-3">
				<button
					onclick={() => applyRestore('merge')}
					disabled={restoring}
					class="min-h-14 w-full rounded-xl bg-zinc-100 py-3.5 font-semibold text-zinc-900"
				>
					{t.settings.merge}
				</button>
				<button
					onclick={() => applyRestore('replace')}
					disabled={restoring}
					class="min-h-14 w-full rounded-xl border border-red-900 py-3.5 font-medium text-red-200"
				>
					{t.settings.replace}
				</button>
				<button onclick={() => (pending = null)} class="min-h-12 text-sm text-zinc-500 underline">
					{t.common.cancel}
				</button>
			</div>
			<p class="mt-3 text-xs text-zinc-500">
				{t.settings.restoreHint}
			</p>
		{:else if summary}
			<p class="mt-2 text-sm text-zinc-100">{t.settings.restored}</p>
			<ul class="mt-2 flex flex-col gap-1 text-sm text-zinc-400">
				<li>
					{t.settings.routinesAdded(
						summary.routinesAdded,
						summary.routinesUpdated,
						summary.routinesSkipped
					)}
				</li>
				<li>{t.settings.sessionsAdded(summary.sessionsAdded, summary.sessionsSkipped)}</li>
				<li>{t.settings.aliasesAdded(summary.aliasesAdded)}</li>
			</ul>
			<button onclick={() => (summary = null)} class="mt-4 min-h-12 text-sm text-zinc-400 underline">
				{t.common.done}
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
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.settings.storage}</h2>
		{#if settings?.persistGranted}
			<p class="mt-2 text-zinc-100">{t.settings.persistent}</p>
			<p class="mt-1 text-sm text-zinc-400">
				{t.settings.persistentHint}
			</p>
		{:else if settings}
			<p class="mt-2 text-zinc-100">{t.settings.notPersistent}</p>
			<p class="mt-1 text-sm text-zinc-400">
				{t.settings.notPersistentHint}
			</p>
		{:else}
			<p class="mt-2 text-zinc-500">{t.common.checking}</p>
		{/if}
	</div>

	<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.settings.data}</h2>
		<dl class="mt-2 flex flex-col gap-1 text-zinc-300">
			<div class="flex justify-between"><dt>{t.settings.routines}</dt><dd>{routineCount}</dd></div>
			<div class="flex justify-between"><dt>{t.settings.sessions}</dt><dd>{sessionCount}</dd></div>
			<div class="flex justify-between"><dt>{t.settings.learnedNames}</dt><dd>{aliasCount}</dd></div>
			<div class="flex justify-between"><dt>{t.settings.spaceUsed}</dt><dd>{mb(usage)}</dd></div>
			<div class="flex justify-between"><dt>{t.settings.databaseVersion}</dt><dd>{DB_VERSION}</dd></div>
			<div class="flex justify-between"><dt>{t.settings.appBuild}</dt><dd>{BUILD_LABEL}</dd></div>
		</dl>
		<p class="mt-3 text-xs text-zinc-500">{t.settings.staysOnDevice}</p>
	</div>

	<a href="{base}/about/" class="text-center text-sm text-zinc-500 underline">
		{t.settings.aboutLink}
	</a>
</section>
