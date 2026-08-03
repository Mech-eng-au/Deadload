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
	import { calibrationWindow } from '$lib/progress/index.js';
	import { muscleLabel } from '$lib/catalog/muscles.js';
	import { t } from '$lib/i18n/locale.svelte.js';
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
	// The level only widens §17.2's calibration window for `advanced` work; passing
	// it as a function keeps `compute.ts` free of any catalog dependency.
	const progress = $derived(exerciseProgress(sessions, (id) => getExercise(id)?.level));
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

	const minutes = (seconds: number) => t.stats.duration(seconds);

	/**
	 * Sparkline over an exercise's best set per day.
	 *
	 * **The calibration sessions are drawn but not joined** (§17.2). Performance
	 * on a new movement improves from practising the movement, so the first
	 * sessions on one are substantially motor learning — plotting them into the
	 * trend draws that as progress, which is the thing §17 refuses to do and
	 * would have made this screen contradict the finished screen.
	 *
	 * Drawn rather than dropped: the user did the work, and hiding it would be
	 * its own dishonesty. They are pale dots before the line starts.
	 */
	function spark(row: ExerciseProgress): { x: number; y: number; calibrating: boolean }[] {
		const values = row.history.map((h) => h.bestReps || h.bestSeconds);
		if (values.length < 2) return [];
		const max = Math.max(...values, 1);
		const step = 100 / (values.length - 1);
		return row.history.map((h, i) => ({
			x: i * step,
			y: 24 - (values[i] / max) * 22,
			calibrating: h.calibrating
		}));
	}

	/** The trend itself, over the points the app is willing to stand behind. */
	function trend(row: ExerciseProgress): string {
		const trusted = spark(row).filter((p) => !p.calibrating);
		return trusted.length < 2 ? '' : trusted.map((p) => `${p.x},${p.y}`).join(' ');
	}
</script>

<svelte:head>
	<title>{t.stats.title} · Deadload</title>
</svelte:head>

<section class="flex flex-col gap-6 pt-2 pb-12">
	<h1 class="font-display text-3xl font-bold">{t.stats.title}</h1>

	{#if !loaded}
		<p class="text-zinc-500">{t.common.loading}</p>
	{:else if summary.sessions === 0}
		<div class="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
			<p class="text-zinc-300">{t.stats.empty}</p>
			<p class="mt-1 text-sm text-zinc-500">{t.stats.emptyHint}</p>
			<a
				href="{base}/" data-sveltekit-replacestate
				class="mt-5 inline-block min-h-12 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900"
			>
				{t.stats.goToRoutines}
			</a>
		</div>
	{:else}
		<!-- Headline numbers -->
		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="font-display text-4xl font-bold tabular-nums">{summary.sessions}</div>
				<div class="mt-1 text-xs text-zinc-400">{t.stats.sessions}</div>
			</div>
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="font-display text-4xl font-bold tabular-nums">{summary.sets}</div>
				<div class="mt-1 text-xs text-zinc-400">{t.stats.setsLogged}</div>
			</div>
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="font-display text-4xl font-bold tabular-nums">{streak}</div>
				<div class="mt-1 text-xs text-zinc-400">
					{t.stats.dayStreak}{best > streak ? t.stats.bestStreak(best) : ''}
				</div>
			</div>
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="font-display text-4xl font-bold tabular-nums">{summary.reps}</div>
				<div class="mt-1 text-xs text-zinc-400">
					{t.stats.reps}{summary.seconds ? t.stats.heldFor(minutes(summary.seconds)) : ''}
				</div>
			</div>
		</div>

		<!-- Sixteen weeks of daily activity, shaded by how much was logged. -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.stats.activity}</h2>
			<div class="mt-3 flex gap-[3px] overflow-x-auto pb-1">
				{#each calendar as week (week[0].key)}
					<div class="flex shrink-0 flex-col gap-[3px]">
						{#each week as day (day.key)}
							<div
								class="h-3.5 w-3.5 rounded-[3px] {day.future ? 'bg-transparent' : shade(day.sets)}"
								title={day.future
									? ''
									: t.stats.daySets(t.units.date(day.date, {}), day.sets)}
							></div>
						{/each}
					</div>
				{/each}
			</div>
			<div class="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
				<span>{t.stats.weeksAgo(16)}</span>
				<span class="flex items-center gap-1">
					{t.stats.less}
					<span class="h-2.5 w-2.5 rounded-[2px] bg-zinc-900"></span>
					<span class="h-2.5 w-2.5 rounded-[2px] bg-zinc-600"></span>
					<span class="h-2.5 w-2.5 rounded-[2px] bg-zinc-400"></span>
					<span class="h-2.5 w-2.5 rounded-[2px] bg-zinc-100"></span>
					{t.stats.more}
				</span>
			</div>
		</section>

		<!-- Sessions per week, last 12 -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
				{t.stats.sessionsPerWeek}
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
				<span>{t.stats.thisWeek}</span>
			</div>
		</section>

		<!-- Recent sessions, with the way through to the full log. -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<div class="flex items-baseline justify-between">
				<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.stats.recentSessions}</h2>
				<a href="{base}/history/" data-sveltekit-replacestate class="text-sm text-zinc-400 underline">{t.stats.seeAll}</a>
			</div>
			<ul class="mt-3 flex flex-col gap-2 text-sm">
				{#each recent as row (row.id)}
					<li>
						<a href="{base}/history/{row.id}/" class="flex justify-between gap-3">
							<span class="min-w-0 truncate text-zinc-300">{row.routineName}</span>
							<span class="shrink-0 text-zinc-500 tabular-nums">
								{t.stats.sessionLine(t.units.date(row.startedAt, {}), row.sets)}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>

		<!-- Volume by muscle group -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
				{t.stats.setsPerMuscle}
			</h2>
			<ul class="mt-3 flex flex-col gap-2">
				{#each muscles.slice(0, 10) as m (m.muscle)}
					<li>
						<div class="flex justify-between text-sm">
							<span class="text-zinc-300 capitalize">{muscleLabel(m.muscle, t)}</span>
							<!-- kg-reps only where there are some (§10.1): "0 kg" beside a
								 muscle trained with bodyweight work reads as a result. -->
							<span class="text-zinc-500 tabular-nums">
								{t.stats.muscleLine(m.sets, m.reps, m.kgReps)}
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
					{t.stats.topTen(muscles.length)}
				</p>
			{/if}
		</section>

		{#if loaded_}
			<!-- Loaded work: a separate currency from sets (§10.1). Its own section
				 with its own axis, never stacked on the rep chart — 240 kg·reps and
				 24 reps are not comparable quantities. -->
			<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
				<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.stats.loadedWork}</h2>
				<p class="mt-1 text-xs text-zinc-500">
					{t.stats.loadedWorkIntro}
				</p>
				<div class="mt-3 flex h-28 items-end gap-1">
					{#each loadWeeks as w (w.label)}
						<div class="flex flex-1 flex-col items-center gap-1">
							<div
								class="w-full rounded-t bg-amber-300/80"
								style="height: {(w.kgReps / peakKgReps) * 100}%"
								title={t.stats.loadedWeekTitle(w.label, w.kgReps, w.sets)}
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
						{t.stats.thisWeekLoaded(
							current.kgReps,
							current.sets,
							current.bestKg ? formatKg(current.bestKg, t) : null
						)}
					</p>
				{/each}
			</section>
		{/if}

		<!-- Per-exercise progression -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.stats.byExercise}</h2>
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
									{t.stats.exerciseLine(
										row.sets,
										row.bestReps ? t.units.num(row.bestReps) : t.units.seconds(row.bestSeconds),
										row.bestKg ? formatKg(row.bestKg, t) : null
									)}
								</span>
							</span>
							{#if spark(row).length}
								<!-- The viewBox is inset by the dot radius: a calibration dot sits at
									 x=0 and would otherwise be sliced in half by the edge. -->
								<svg
									viewBox="-3 -1 106 26"
									class="h-6 w-16 shrink-0"
									preserveAspectRatio="none"
								>
									{#if trend(row)}
										<polyline
											points={trend(row)}
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											vector-effect="non-scaling-stroke"
											class="text-zinc-400"
										/>
									{/if}
									<!-- The calibration sessions: recorded, shown, and left out of
										 the line above (§17.2). -->
									{#each spark(row).filter((p) => p.calibrating) as p, i (i)}
										<circle
											cx={p.x}
											cy={p.y}
											r="2"
											vector-effect="non-scaling-stroke"
											class="fill-zinc-700"
										/>
									{/each}
								</svg>
							{/if}
						</button>

						{#if openExercise === row.exerciseId}
							<dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
								<div>
									<dt class="inline">{t.stats.totalReps}</dt>
									<dd class="inline">{row.totalReps}</dd>
								</div>
								<div>
									<dt class="inline">{t.stats.timeHeld}</dt>
									<dd class="inline">{minutes(row.totalSeconds)}</dd>
								</div>
								{#if row.bestKg}
									<!-- Load belongs here above all: one exercise, so the unit means
										 the same thing at every point on the series (§10.1). -->
									<div>
										<dt class="inline">{t.stats.heaviest}</dt>
										<dd class="inline">{formatKg(row.bestKg, t)}</dd>
									</div>
									<div>
										<dt class="inline">{t.stats.kgReps}</dt>
										<dd class="inline">{Math.round(row.kgReps)}</dd>
									</div>
								{/if}
								<div>
									<dt class="inline">{t.stats.sessionCount}</dt>
									<dd class="inline">{row.history.length}</dd>
								</div>
								<div>
									<dt class="inline">{t.stats.last}</dt>
									<dd class="inline">{t.units.date(row.lastPerformed, {})}</dd>
								</div>
							</dl>
							<!-- Only where there is a pale dot to explain, and worded about the
								 measurement rather than about the user (§17.2, §17.5). -->
							{#if row.history.some((h) => h.calibrating)}
								<p class="mt-2 text-xs text-zinc-600">
									{t.stats.calibrating(
										calibrationWindow(getExercise(row.exerciseId)?.level)
									)}
								</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<!-- Routine usage -->
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t.stats.routinesUsed}</h2>
			<ul class="mt-3 flex flex-col gap-2 text-sm">
				{#each routines as r (r.routineId)}
					<li class="flex justify-between">
						<span class="truncate text-zinc-300">{r.routineName}</span>
						<span class="shrink-0 text-zinc-500 tabular-nums">
							{t.stats.timesUsed(r.sessions)} · {t.units.date(r.lastUsed, {})}
						</span>
					</li>
				{/each}
			</ul>
			<p class="mt-3 text-xs text-zinc-600">
				{t.stats.neverUsed}
			</p>
		</section>

		{#if summary.skipped > 0}
			<p class="text-xs text-zinc-600">
				{t.stats.skipped(summary.skipped)}
			</p>
		{/if}
	{/if}
</section>
