<script lang="ts">
	import { formatDuration } from '#lib/utils/duration.js';
	import { timeAgo } from '#lib/utils/timeAgo.js';
	import { joinDetails, type DemoActivity } from './shared.js';

	let { demo, showBand }: { demo: DemoActivity; showBand: boolean } = $props();

	let happened = $derived.by(() => {
		if (demo.kind === 'version') return `${demo.actor} uploaded v${demo.versionNumber}`;
		const at =
			demo.timestampSeconds === null
				? ''
				: ` at ${formatDuration(Math.floor(demo.timestampSeconds))}`;
		return `${demo.actor} commented${at}: “${demo.body}”`;
	});
</script>

<a
	href={demo.href}
	class="focus-live -mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-surface-100 sm:gap-4 dark:hover:bg-surface-900"
>
	<div class="min-w-0 flex-1">
		<p class="truncate font-display font-semibold text-surface-900 dark:text-surface-100">
			{demo.title}
		</p>
		<p class="truncate text-xs text-surface-500 dark:text-surface-300">
			{joinDetails([showBand && demo.bandName, happened])}
		</p>
	</div>
	<span class="shrink-0 text-xs whitespace-nowrap text-surface-500 dark:text-surface-300">
		{timeAgo(demo.at)}
	</span>
</a>
