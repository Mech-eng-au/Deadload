<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { catalog, getExercise } from '$lib/catalog/index.js';
	import { listSessions } from '$lib/db/sessions.js';
	import {
		activityCalendar,
		currentStreak,
		exerciseProgress,
		hasLoggedLoad,
		loadedWorkPerWeek,
		longestStreak,
		routineUsage,
		sessionsPerWeek,
		summarize,
		totals,
		volumeByMuscle,
		type ExerciseProgress
	} from '$lib/stats/compute.js';
	import { formatKg } from '$lib/catalog/load.js';
	import type { Session } from '$lib/types.js';

	let sessions = $state<Session[]>([]);
	let loaded = $state(false);
	let openExercise = $state<string | null>(null);

	const byId = new Map(catalog.map((e) => [e.id, e]));

	onMount(async () => {
		sessions = await listSessions();
		loaded = true;
	});

	const weeks = $derived(sessionsPerWeek(sessions, 12));
	const peakWeek = $derived(Math.max(1, ...weeks.map((w) => w.count)));
	const summary = $derived(totals(sessions));
	const streak = $derived(currentStreak(sessions));
	const best = $derived(longestStreak(sessions));
	const muscles = $derived(volumeByMuscle(sessions, byId));
	const peakMuscle = $derived(Math.max(1, ...muscles.map((m) => m.sets)));
	const progress = $derived(exerciseProgress(sessions));
	const routines = $derived(routineUsage(sessions));
	const calendar = $derived(activityCalendar(sessions, 16));
	const busiestDay = $derived(
		Math.max(1, ...calendar.flat().map((d) => d.sets))
	);
	const recent = $derived(summarize(sessions).slice(0, 5));

	// The "Loaded work" section does not exist until something has been logged with
	// a load (§10.1). For somebody who owns no dumbbells that is never, and an
	// empty section explaining a feature they do not use is worse than no section.
	const loaded_ = $derived(hasLoggedLoad(sessions));
	const loadWeeks = $derived(loadedWorkPerWeek(sessions, 12));
	const peakKgReps = $derived(Math.max(1, ...loadWeeks.map((w) => w.kgReps)));

	/** Four shades: absent, light, medium, heavy, relative to the busiest day. */
	function shade(sets: number): string {
		if (sets === 0) return 'bg-zinc-900';
		const share = sets / busiestDay;
		if (share > 0.66) return 'bg-zinc-100';
		if (share > 0.33) return 'bg-zinc-400';
		return 'bg-zinc-600';
	}

	function minutes(seconds: number): string {
		if (seconds < 60) return `${seconds} s`;
		return `${Math.round(seconds / 60)} min`;
	}

	/** Sparkline over an exercise's best set per day. */
	function spark(row: ExerciseProgress): string {
		const points = row.history.map((h) => h.bestReps || h.bestSeconds);
		if (points.length < 2) return '';
		const max = Math.max(...points, 1);
		const step = 100 / (points.length - 1);
		return points.map((p, i) => `${i * step},${24 - (p / max) * 22}`).join(' ');
	}
</script>

<svelte:head>
	<title>Statistics · Deadload</title>
</svelte:head>

<section class="flex flex-col gap-6 pt-2 pb-12">
	<h1 class="font-display text-3xl font-bold">Statistics</h1>

	{#if !loaded}
		<p class="text-zinc-500">Loading…</p>
	{:else if summary.sessions === 0}
		<div class="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
			<p class="text-zinc-300">Nothing logged yet.</p>
			<p class="mt-1 text-sm text-zinc-500">Finish a session and the numbers start here.</p>
			<a
				href="{base}/" data-sveltekit-replacestate
				class="mt-5 inline-block min-h-12 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900"
			>
				Go to routines
			</a>
		</div>
	{:else}
		<!-- Headline numbers -->
		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="font-display text-4xl font-bold tabular-nums">{summary.sessions}</div>
				<div class="mt-1 text-xs text-zinc-400">sessions</div>
			</div>
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="font-display text-4xl font-bold tabular-nums">{summary.sets}</div>
				<div class="mt-1 text-xs text-zinc-400">sets logged</div>
			</div>
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="font-display text-4xl font-bold tabular-nums">{streak}</div>
				<div class="mt-1 text-xs text-zinc-400">
					day streak{best > streak ? ` · best ${best}` : ''}
				</div>
			</div>
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="font-display text-4xl font-bold tabular-nums">{summary.reps}</div>
				<div class="mt-1 text-xs text-zinc-400">
					reps{summary.seconds ? ` · ${minutes(summary.seconds)} held` : ''}
				</div>
			</div>
		</div>

		<!-- Sixteen weeks of daily activity, shaded by how much was logged. -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Activity</h2>
			<div class="mt-3 flex gap-[3px] overflow-x-auto pb-1">
				{#each calendar as week (week[0].key)}
					<div class="flex shrink-0 flex-col gap-[3px]">
						{#each week as day (day.key)}
							<div
								class="h-3.5 w-3.5 rounded-[3px] {day.future ? 'bg-transparent' : shade(day.sets)}"
								title={day.future
									? ''
									: `${day.date.toLocaleDateString()} — ${day.sets} set${day.sets === 1 ? '' : 's'}`}
							></div>
						{/each}
					</div>
				{/each}
			</div>
			<div class="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
				<span>16 weeks ago</span>
				<span class="flex items-center gap-1">
					less
					<span class="h-2.5 w-2.5 rounded-[2px] bg-zinc-900"></span>
					<span class="h-2.5 w-2.5 rounded-[2px] bg-zinc-600"></span>
					<span class="h-2.5 w-2.5 rounded-[2px] bg-zinc-400"></span>
					<span class="h-2.5 w-2.5 rounded-[2px] bg-zinc-100"></span>
					more
				</span>
			</div>
		</section>

		<!-- Sessions per week, last 12 -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
				Sessions per week
			</h2>
			<div class="mt-4 flex h-32 items-end gap-1">
				{#each weeks as week (week.label)}
					<div class="flex flex-1 flex-col items-center gap-1">
						<span class="text-[10px] tabular-nums {week.count ? 'text-zinc-300' : 'text-zinc-700'}">
							{week.count || ''}
						</span>
						<div
							class="w-full rounded-t {week.count ? 'bg-zinc-100' : 'bg-zinc-800'}"
							style="height: {week.count ? Math.max(4, (week.count / peakWeek) * 88) : 3}px"
						></div>
					</div>
				{/each}
			</div>
			<div class="mt-2 flex justify-between text-[10px] text-zinc-600">
				<span>{weeks[0]?.label}</span>
				<span>this week</span>
			</div>
		</section>

		<!-- Recent sessions, with the way through to the full log. -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<div class="flex items-baseline justify-between">
				<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Recent sessions</h2>
				<a href="{base}/history/" data-sveltekit-replacestate class="text-sm text-zinc-400 underline">See all</a>
			</div>
			<ul class="mt-3 flex flex-col gap-2 text-sm">
				{#each recent as row (row.id)}
					<li>
						<a href="{base}/history/{row.id}/" class="flex justify-between gap-3">
							<span class="min-w-0 truncate text-zinc-300">{row.routineName}</span>
							<span class="shrink-0 text-zinc-500 tabular-nums">
								{new Date(row.startedAt).toLocaleDateString()} · {row.sets} sets
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>

		<!-- Volume by muscle group -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
				Sets per muscle group
			</h2>
			<ul class="mt-3 flex flex-col gap-2">
				{#each muscles.slice(0, 10) as m (m.muscle)}
					<li>
						<div class="flex justify-between text-sm">
							<span class="text-zinc-300 capitalize">{m.muscle}</span>
							<!-- kg-reps only where there are some (§10.1): "0 kg" beside a
								 muscle trained with bodyweight work reads as a result. -->
							<span class="text-zinc-500 tabular-nums">
								{m.sets} set{m.sets === 1 ? '' : 's'}{m.reps ? ` · ${m.reps} reps` : ''}{m.kgReps
									? ` · ${Math.round(m.kgReps)} kg·reps`
									: ''}
							</span>
						</div>
						<div class="mt-1 h-2 rounded-full bg-zinc-800">
							<div
								class="h-2 rounded-full bg-zinc-300"
								style="width: {(m.sets / peakMuscle) * 100}%"
							></div>
						</div>
					</li>
				{/each}
			</ul>
			{#if muscles.length > 10}
				<p class="mt-3 text-xs text-zinc-600">
					Showing the top 10 of {muscles.length}.
				</p>
			{/if}
		</section>

		{#if loaded_}
			<!-- Loaded work: a separate currency from sets (§10.1). Its own section
				 with its own axis, never stacked on the rep chart — 240 kg·reps and
				 24 reps are not comparable quantities. -->
			<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Loaded work</h2>
				<p class="mt-1 text-xs text-zinc-500">
					Kilogram-reps per week, from sets done with a dumbbell or kettlebell. Counted apart from
					everything above, because there is no unit in which a plank and a 10 kg row add up.
				</p>
				<div class="mt-3 flex h-28 items-end gap-1">
					{#each loadWeeks as w (w.label)}
						<div class="flex flex-1 flex-col items-center gap-1">
							<div
								class="w-full rounded-t bg-amber-300/80"
								style="height: {(w.kgReps / peakKgReps) * 100}%"
								title="{w.label}: {Math.round(w.kgReps)} kg·reps, {w.sets} loaded sets"
							></div>
						</div>
					{/each}
				</div>
				<div class="mt-1 flex gap-1 text-[10px] text-zinc-600">
					{#each loadWeeks as w, i (w.label)}
						<span class="flex-1 text-center">{i % 3 === 0 ? w.label : ''}</span>
					{/each}
				</div>
				{#each [loadWeeks[loadWeeks.length - 1]] as current (current.label)}
					<p class="mt-3 text-xs text-zinc-500">
						This week: {Math.round(current.kgReps)} kg·reps over {current.sets} loaded set{current.sets ===
						1
							? ''
							: 's'}{current.bestKg ? `, heaviest ${formatKg(current.bestKg)}` : ''}.
					</p>
				{/each}
			</section>
		{/if}

		<!-- Per-exercise progression -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">By exercise</h2>
			<ul class="mt-3 flex flex-col gap-2">
				{#each progress.slice(0, 12) as row (row.exerciseId)}
					{@const exercise = getExercise(row.exerciseId)}
					<li class="rounded-xl border border-zinc-800 p-3">
						<button
							onclick={() => (openExercise = openExercise === row.exerciseId ? null : row.exerciseId)}
							class="flex w-full items-center gap-3 text-left"
						>
							{#if exercise}
								<img
									src="{base}{exercise.media[0].path}"
									alt=""
									class="h-10 w-14 shrink-0 rounded bg-white object-cover"
								/>
							{/if}
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-medium">
									{exercise?.name ?? row.exerciseId}
								</span>
								<span class="text-xs text-zinc-500">
									{row.sets} sets · best {row.bestReps || `${row.bestSeconds} s`}{row.bestKg
										? ` at ${formatKg(row.bestKg)}`
										: ''}
								</span>
							</span>
							{#if spark(row)}
								<svg viewBox="0 0 100 24" class="h-6 w-16 shrink-0" preserveAspectRatio="none">
									<polyline
										points={spark(row)}
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										vector-effect="non-scaling-stroke"
										class="text-zinc-400"
									/>
								</svg>
							{/if}
						</button>

						{#if openExercise === row.exerciseId}
							<dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
								<div><dt class="inline">Total reps:</dt> <dd class="inline">{row.totalReps}</dd></div>
								<div>
									<dt class="inline">Time held:</dt>
									<dd class="inline">{minutes(row.totalSeconds)}</dd>
								</div>
								{#if row.bestKg}
									<!-- Load belongs here above all: one exercise, so the unit means
										 the same thing at every point on the series (§10.1). -->
									<div>
										<dt class="inline">Heaviest:</dt>
										<dd class="inline">{formatKg(row.bestKg)}</dd>
									</div>
									<div>
										<dt class="inline">Kg·reps:</dt>
										<dd class="inline">{Math.round(row.kgReps)}</dd>
									</div>
								{/if}
								<div><dt class="inline">Sessions:</dt> <dd class="inline">{row.history.length}</dd></div>
								<div>
									<dt class="inline">Last:</dt>
									<dd class="inline">{new Date(row.lastPerformed).toLocaleDateString()}</dd>
								</div>
							</dl>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<!-- Routine usage -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Routines used</h2>
			<ul class="mt-3 flex flex-col gap-2 text-sm">
				{#each routines as r (r.routineId)}
					<li class="flex justify-between">
						<span class="truncate text-zinc-300">{r.routineName}</span>
						<span class="shrink-0 text-zinc-500 tabular-nums">
							{r.sessions}× · {new Date(r.lastUsed).toLocaleDateString()}
						</span>
					</li>
				{/each}
			</ul>
			<p class="mt-3 text-xs text-zinc-600">
				Anything missing from this list has never been used.
			</p>
		</section>

		{#if summary.skipped > 0}
			<p class="text-xs text-zinc-600">
				{summary.skipped} set{summary.skipped === 1 ? '' : 's'} skipped and recorded as such.
			</p>
		{/if}
	{/if}
</section>
