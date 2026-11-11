<script lang="ts">
	import logo from '#lib/assets/tone3000-logo.svg';
	import { secondaryButton } from './practiceStyles.js';
	import type { IrSlot } from '#lib/utils/rig.svelte.js';
	import { tone3000 } from '#lib/utils/tone3000Browser.svelte.js';
	import {
		creatorName,
		formatLabel,
		gearLabel,
		httpsUrl,
		licenseLabel,
		T3K_ORIGIN,
		tone3000Enabled,
		type T3kKind
	} from '#lib/utils/tone3000.js';

	/**
	 * Browse TONE3000 for the rig: its own window does the browsing (the Select flow),
	 * and the tone picked there comes back as a short list, each file one tap to add.
	 * Their terms ask for the logo at the way in, and the creator, gear, format and
	 * license wherever a tone is shown.
	 */
	let { kind, slot = 0 }: { kind: T3kKind; /** For IRs: the first or the second */ slot?: IrSlot } =
		$props();

	let mine = $derived(tone3000.kind === kind && tone3000.slot === slot);
	let status = $derived(mine ? tone3000.status : 'idle');
	let tone = $derived(mine ? tone3000.tone : null);
	let image = $derived(httpsUrl(tone?.images?.[0]));
	let avatar = $derived(httpsUrl(tone?.user.avatar_url));
	// Sizes only matter when a tone has more than one
	let showSizes = $derived(new Set(tone3000.models.map((model) => model.size)).size > 1);

	const link =
		'focus-live rounded-sm font-medium text-accent-700 underline underline-offset-2 dark:text-accent-300';
	const muted = 'text-xs text-surface-500 dark:text-surface-300';
</script>

{#if tone3000Enabled}
	<div class="mt-2">
		{#if status === 'idle'}
			<button
				type="button"
				class="{secondaryButton} flex w-full items-center justify-center gap-2"
				aria-label="Browse TONE3000 for {kind === 'nam'
					? 'amps'
					: slot === 1
						? 'a second cab IR'
						: 'cab IRs'}"
				onclick={() => tone3000.browse(kind, slot)}
			>
				Browse
				<img src={logo} alt="" width="92" height="14" class="h-3.5 w-auto" />
			</button>
		{:else if status === 'choosing' || status === 'loading'}
			<div
				class="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-dashed border-surface-300 px-3 dark:border-surface-600"
			>
				<p class={muted} aria-live="polite">
					{status === 'choosing'
						? `Pick ${kind === 'nam' ? 'an amp' : 'a cab'} in the TONE3000 window.`
						: 'Loading from TONE3000…'}
				</p>
				<button type="button" class="{link} shrink-0 text-xs" onclick={() => tone3000.close()}>
					Cancel
				</button>
			</div>
		{:else if tone}
			<div class="rounded-lg border border-surface-300 dark:border-surface-600">
				<div class="flex items-start gap-2.5 p-2.5">
					{#if image}
						<img
							src={image}
							alt=""
							width="40"
							height="40"
							loading="lazy"
							class="h-10 w-10 shrink-0 rounded-md object-cover"
						/>
					{/if}
					<div class="min-w-0 flex-1">
						<a
							href={httpsUrl(tone.url) ?? T3K_ORIGIN}
							target="_blank"
							rel="noopener noreferrer"
							class="focus-live line-clamp-2 rounded-sm text-sm leading-snug font-semibold text-surface-900 hover:underline dark:text-surface-100"
						>
							{tone.title}
						</a>
						<!-- Their own lines, so the creator and license never get cut short -->
						<p class="mt-1 flex min-w-0 items-center gap-1.5 {muted}">
							{#if avatar}
								<img
									src={avatar}
									alt=""
									width="16"
									height="16"
									loading="lazy"
									class="h-4 w-4 shrink-0 rounded-full object-cover"
								/>
							{/if}
							<span class="truncate">{creatorName(tone.user)}</span>
						</p>
						<p class="mt-0.5 {muted}">
							{gearLabel(tone.gear)} · {formatLabel(tone.format)} · {licenseLabel(tone.license)}
						</p>
					</div>
					<button
						type="button"
						onclick={() => tone3000.close()}
						aria-label="Close {tone.title}"
						title="Close"
						class="focus-live -mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-surface-500 transition-colors duration-150 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							aria-hidden="true"
						>
							<path d="M18 6 6 18M6 6l12 12" />
						</svg>
					</button>
				</div>

				{#if tone3000.models.length === 0}
					<p class="border-t border-surface-200 px-2.5 py-2 {muted} dark:border-surface-700">
						This tone has no {kind === 'nam' ? 'A2 captures' : 'IRs'} to add.
					</p>
				{:else}
					<ul
						aria-label="Files in {tone.title}"
						class="max-h-52 divide-y divide-surface-200 overflow-y-auto border-t border-surface-200 dark:divide-surface-700 dark:border-surface-700"
					>
						{#each tone3000.models as model (model.id)}
							{@const chosen = tone3000.isChosen(model)}
							{@const saved = !!tone3000.saved(model)}
							{@const adding = tone3000.adding === model.id}
							<li class="flex min-h-11 items-center gap-2 px-2.5">
								<span
									class="min-w-0 flex-1 truncate text-sm text-surface-800 dark:text-surface-100"
								>
									{model.name}
									{#if showSizes}
										<span class={muted}>{model.size}</span>
									{/if}
								</span>
								{#if chosen}
									<span
										class="shrink-0 px-2 text-xs font-medium text-surface-600 dark:text-surface-300"
									>
										In use
									</span>
								{:else}
									<button
										type="button"
										aria-label="{saved ? 'Use' : 'Add'} {model.name}"
										disabled={tone3000.adding !== null}
										onclick={() => tone3000.add(model)}
										class="focus-live min-h-9 shrink-0 rounded-md border border-accent-300 bg-accent-100 px-3 text-xs font-semibold text-accent-800 transition-colors duration-150 hover:bg-accent-200 disabled:opacity-50 dark:border-accent-600 dark:bg-accent-800/50 dark:text-accent-200 dark:hover:bg-accent-800"
									>
										{adding ? 'Adding…' : saved ? 'Use' : 'Add'}
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				<div
					class="flex items-center justify-between gap-2 border-t border-surface-200 px-2.5 py-1.5 {muted} dark:border-surface-700"
				>
					<span>
						{tone3000.models.length}
						{kind === 'nam'
							? tone3000.models.length === 1
								? 'capture'
								: 'captures'
							: tone3000.models.length === 1
								? 'IR'
								: 'IRs'}
					</span>
					<a href={T3K_ORIGIN} target="_blank" rel="noopener noreferrer" class="{link} shrink-0">
						Powered by TONE3000
					</a>
				</div>
			</div>
		{/if}

		{#if mine && tone3000.error}
			<p role="alert" class="mt-1.5 text-xs text-danger-700 dark:text-danger-300">
				{tone3000.error}
			</p>
		{/if}
	</div>
{/if}
