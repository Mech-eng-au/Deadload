<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { formatKg, isLoadable } from '$lib/catalog/load.js';
	import { deleteSession, getSession, putSession } from '$lib/db/sessions.js';
	import {
		EditError,
		applyEntryEdit,
		correctedLabel,
		editableReason,
		removeEntry,
		setSessionNotes,
		type EntryEdit
	} from '$lib/session/edit.js';
	import { t } from '$lib/i18n/locale.svelte.js';
	import type { Session, SetEntry } from '$lib/types.js';

	let session = $state<Session | null>(null);
	let loaded = $state(false);
	let confirmingDelete = $state(false);

	onMount(async () => {
		session = (await getSession(page.params.id!)) ?? null;
		loaded = true;
	});

	/**
	 * Consecutive entries for the same exercise read as one block of work. The
	 * position in `entries` travels with each row, because that is what the edit
	 * functions address a set by — the displayed set number is a renumbered thing
	 * and cannot be used to find the row again.
	 */
	const grouped = $derived(
		(session?.entries ?? []).reduce<
			{ exerciseId: string; sets: { entry: SetEntry; index: number }[] }[]
		>((acc, entry, index) => {
			const last = acc[acc.length - 1];
			if (last?.exerciseId === entry.exerciseId) last.sets.push({ entry, index });
			else acc.push({ exerciseId: entry.exerciseId, sets: [{ entry, index }] });
			return acc;
		}, [])
	);

	const minutes = $derived(
		session?.endedAt
			? Math.max(1, Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60000))
			: undefined
	);

	const cannotEdit = $derived(session ? editableReason(session, t) : undefined);
	const corrected = $derived(session ? correctedLabel(session, t) : undefined);

	function describe(entry: SetEntry): string {
		if (entry.skipped) return t.history.skipped;
		const parts: string[] = [];
		if (entry.reps !== undefined) parts.push(t.units.reps(entry.reps));
		if (entry.seconds !== undefined) parts.push(t.units.seconds(entry.seconds));
		if (entry.loadKg !== undefined) parts.push(formatKg(entry.loadKg, t));
		if (entry.side) parts.push(entry.side === 'left' ? t.units.left : t.units.right);
		if (entry.rpe !== undefined) parts.push(t.history.rpe(entry.rpe));
		return parts.join(' · ') || '—';
	}

	// ------------------------------------------------------------ correcting a set

	/**
	 * One set is open for correction at a time, addressed by its position in
	 * `entries`. The form edits a draft rather than the entry: a half-typed number
	 * is not a claim about what happened, and the rules in `$lib/session/edit` only
	 * run on Save.
	 */
	let editing = $state<number | null>(null);
	let draft = $state({
		metric: 'reps' as 'reps' | 'duration',
		amount: '' as string,
		loadKg: '' as string,
		rpe: '' as string,
		skipped: false
	});
	let editError = $state<string | undefined>(undefined);
	let saving = $state(false);

	/** Which number a set is measured in: what it already says, else the exercise's own default. */
	function metricOf(entry: SetEntry): 'reps' | 'duration' {
		if (entry.seconds !== undefined) return 'duration';
		if (entry.reps !== undefined) return 'reps';
		return getExercise(entry.exerciseId)?.defaultMetric ?? 'reps';
	}

	function openEditor(index: number) {
		if (!session || cannotEdit) return;
		const entry = session.entries[index];
		const metric = metricOf(entry);
		draft = {
			metric,
			amount: String((metric === 'duration' ? entry.seconds : entry.reps) ?? ''),
			loadKg: entry.loadKg === undefined ? '' : String(entry.loadKg),
			rpe: entry.rpe === undefined ? '' : String(entry.rpe),
			skipped: entry.skipped
		};
		editError = undefined;
		editing = index;
	}

	function num(text: string): number | undefined {
		const trimmed = text.trim();
		if (trimmed === '') return undefined;
		const n = Number(trimmed);
		return Number.isNaN(n) ? undefined : n;
	}

	/**
	 * Every field is sent, present-but-undefined where the box was cleared, because
	 * `applyEntryEdit` reads `'reps' in edit` — that is how a load or an RPE gets
	 * removed rather than merely left alone.
	 */
	function draftEdit(): EntryEdit {
		const amount = num(draft.amount);
		return {
			reps: draft.metric === 'reps' ? amount : undefined,
			seconds: draft.metric === 'duration' ? amount : undefined,
			loadKg: num(draft.loadKg),
			rpe: num(draft.rpe),
			skipped: draft.skipped
		};
	}

	async function commit(next: Session) {
		saving = true;
		try {
			session = await putSession(next);
			editing = null;
			editError = undefined;
		} finally {
			saving = false;
		}
	}

	async function saveEdit() {
		if (!session || editing === null) return;
		try {
			await commit(applyEntryEdit(session, editing, draftEdit(), t));
		} catch (e) {
			if (e instanceof EditError) editError = e.message;
			else throw e;
		}
	}

	async function dropSet() {
		if (!session || editing === null) return;
		try {
			await commit(removeEntry(session, editing, t));
		} catch (e) {
			if (e instanceof EditError) editError = e.message;
			else throw e;
		}
	}

	// ------------------------------------------------------------- session notes
	let noteDraft = $state<string | null>(null);
	const noteText = $derived(noteDraft ?? session?.notes ?? '');
	const noteDirty = $derived(noteDraft !== null && noteDraft.trim() !== (session?.notes ?? ''));

	async function saveNote() {
		if (!session || noteDraft === null) return;
		await commit(setSessionNotes(session, noteDraft, t));
		noteDraft = null;
	}

	async function remove() {
		if (!session) return;
		await deleteSession(session.id);
		await goto(`${base}/history/`, { replaceState: true });
	}

	const fieldClass =
		'w-20 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-base tabular-nums focus:border-zinc-500 focus:outline-none';
</script>

<svelte:head>
	<title>{session?.routineName ?? t.session.fallbackTitle} · Deadload</title>
</svelte:head>

<a href="{base}/history/" data-sveltekit-replacestate class="text-sm text-zinc-400">{t.common.backHistory}</a>

{#if !loaded}
	<p class="mt-8 text-zinc-500">{t.common.loading}</p>
{:else if !session}
	<p class="mt-8 text-zinc-300">{t.history.gone}</p>
{:else}
	<article class="mt-2 flex flex-col gap-6 pb-12">
		<header>
			<h1 class="font-display text-2xl font-bold">{session.routineName}</h1>
			<p class="mt-1 text-sm text-zinc-400">
				{t.history.fullDate(session.startedAt)}
				{#if minutes}{t.history.minutes(minutes)}{/if}
			</p>
			{#if corrected}
				<!-- Said out loud, because the statistics are built on this log (§4.3). -->
				<p class="mt-1 text-xs text-zinc-500">{corrected}</p>
			{/if}
			{#if cannotEdit}
				<p class="mt-2 rounded-lg bg-amber-950/40 p-3 text-sm text-amber-300">{cannotEdit}</p>
			{/if}
		</header>

		{#each grouped as group, i (group.exerciseId + i)}
			{@const exercise = getExercise(group.exerciseId)}
			<section class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
				<div class="flex items-center gap-3">
					{#if exercise}
						<img
							src="{base}{exercise.media[0].path}"
							alt=""
							loading="lazy"
							class="h-12 w-16 shrink-0 rounded bg-white object-cover"
						/>
					{/if}
					<h2 class="min-w-0 flex-1 truncate font-medium">
						{exercise?.name ?? group.exerciseId}
					</h2>
				</div>
				<ol class="mt-3 flex flex-col gap-1 text-sm">
					{#each group.sets as { entry, index } (index)}
						<li>
							{#if editing === index}
								<div class="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
									<div class="flex items-baseline justify-between">
										<span class="text-zinc-400">
											{entry.side
												? t.history.setWithSide(
														entry.setIndex + 1,
														entry.side === 'left' ? t.units.left : t.units.right
													)
												: t.history.setNumber(entry.setIndex + 1)}
										</span>
										<button onclick={() => (editing = null)} class="min-h-11 text-zinc-500">
											{t.common.cancel}
										</button>
									</div>

									<label class="mt-1 flex min-h-11 items-center gap-2">
										<input
											type="checkbox"
											bind:checked={draft.skipped}
											class="h-5 w-5 rounded border-zinc-700 bg-zinc-950"
										/>
										<span class="text-zinc-300">{t.history.skippedCheckbox}</span>
									</label>

									{#if !draft.skipped}
										<!-- Hidden while skipped, because a skipped row carries no numbers at
											 all (§4.3) and offering boxes that Save would empty is a lie. -->
										<div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
											<label class="flex items-center gap-2">
												<span class="text-zinc-400">
													{draft.metric === 'duration' ? t.history.seconds : t.history.reps}
												</span>
												<input
													type="number"
													inputmode="numeric"
													min="1"
													value={draft.amount}
													oninput={(e) => (draft.amount = e.currentTarget.value)}
													class={fieldClass}
												/>
											</label>

											{#if exercise && isLoadable(exercise)}
												<label class="flex items-center gap-2">
													<span class="text-zinc-400">{t.history.loadKg}</span>
													<input
														type="number"
														inputmode="decimal"
														min="0"
														step="0.5"
														placeholder="–"
														value={draft.loadKg}
														oninput={(e) => (draft.loadKg = e.currentTarget.value)}
														class={fieldClass}
													/>
												</label>
											{/if}

											<label class="flex items-center gap-2">
												<span class="text-zinc-400">{t.history.rpeLabel}</span>
												<input
													type="number"
													inputmode="numeric"
													min="1"
													max="10"
													placeholder="–"
													value={draft.rpe}
													oninput={(e) => (draft.rpe = e.currentTarget.value)}
													class={fieldClass}
												/>
											</label>
										</div>
									{/if}

									{#if editError}
										<p class="mt-2 text-sm text-red-300">{editError}</p>
									{/if}

									<div class="mt-3 flex gap-2">
										<button
											onclick={saveEdit}
											disabled={saving}
											class="min-h-12 flex-1 rounded-lg bg-zinc-100 font-medium text-zinc-900 disabled:opacity-50"
										>
											{t.common.save}
										</button>
										<button
											onclick={dropSet}
											disabled={saving}
											class="min-h-12 rounded-lg border border-zinc-700 px-4 text-zinc-400 disabled:opacity-50"
										>
											{t.history.removeSet}
										</button>
									</div>
								</div>
							{:else if cannotEdit}
								<div class="flex justify-between {entry.skipped ? 'text-zinc-600' : 'text-zinc-300'}">
									<span class="text-zinc-500">{t.history.setNumber(entry.setIndex + 1)}</span>
									<span class="tabular-nums">{describe(entry)}</span>
								</div>
							{:else}
								<button
									onclick={() => openEditor(index)}
									class="flex min-h-11 w-full items-center justify-between rounded text-left {entry.skipped
										? 'text-zinc-600'
										: 'text-zinc-300'}"
								>
									<span class="text-zinc-500">{t.history.setNumber(entry.setIndex + 1)}</span>
									<span class="flex items-center gap-2">
										<span class="tabular-nums">{describe(entry)}</span>
										<!-- The row is the tap target; the pencil is what says so. Same
											 viewBox and stroke weight as the tab bar icons. -->
										<svg
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="1.75"
											aria-hidden="true"
											class="h-4 w-4 shrink-0 text-zinc-500"
										>
											<path d="M4 20h4L19 9l-4-4L4 16z" stroke-linejoin="round" />
										</svg>
									</span>
								</button>
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/each}

		{#if grouped.length === 0}
			<p class="text-zinc-500">{t.history.nothingLogged}</p>
		{:else if !cannotEdit}
			<p class="-mt-4 text-xs text-zinc-600">{t.history.tapToCorrect}</p>
		{/if}

		<div>
			<h2 class="text-sm font-medium text-zinc-400">{t.history.note}</h2>
			{#if cannotEdit}
				{#if session.notes}
					<p class="mt-2 rounded-lg bg-zinc-900 p-3 text-sm text-zinc-300">{session.notes}</p>
				{/if}
			{:else}
				<textarea
					value={noteText}
					oninput={(e) => (noteDraft = e.currentTarget.value)}
					rows="2"
					placeholder={t.history.notePlaceholder}
					class="mt-2 w-full rounded-lg bg-zinc-900 p-3 text-sm placeholder:text-zinc-600 focus:outline-none"
				></textarea>
				{#if noteDirty}
					<button
						onclick={saveNote}
						disabled={saving}
						class="mt-1 min-h-12 w-full rounded-lg bg-zinc-100 font-medium text-zinc-900 disabled:opacity-50"
					>
						{t.history.saveNote}
					</button>
				{/if}
			{/if}
		</div>

		<div class="border-t border-zinc-800 pt-6">
			{#if confirmingDelete}
				<div class="flex gap-3">
					<button
						onclick={remove}
						class="min-h-14 flex-1 rounded-xl bg-red-900/70 py-4 font-medium text-red-50"
					>
						{t.routine.deleteForGood}
					</button>
					<button
						onclick={() => (confirmingDelete = false)}
						class="min-h-14 flex-1 rounded-xl border border-zinc-700 py-4"
					>
						{t.routine.keepIt}
					</button>
				</div>
			{:else}
				<button
					onclick={() => (confirmingDelete = true)}
					class="min-h-14 w-full rounded-xl border border-zinc-800 py-4 text-zinc-400"
				>
					{t.history.deleteSession}
				</button>
			{/if}
			<p class="mt-2 text-xs text-zinc-600">{t.history.deleteAlsoStats}</p>
		</div>
	</article>
{/if}
