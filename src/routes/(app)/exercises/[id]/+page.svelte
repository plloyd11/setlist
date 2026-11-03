<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import ShedScreen from '#lib/components/practice/ShedScreen.svelte';
	import AudioUploadZone from '#lib/components/ui/AudioUploadZone.svelte';
	import FileUploadZone from '#lib/components/ui/FileUploadZone.svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';

	let { data, form } = $props();

	let exerciseId = $derived(data.exercise.id);
	let confirmDialog: ConfirmDialog | undefined = $state();
	let deleteForm: HTMLFormElement | undefined = $state();

	async function handleDelete() {
		const confirmed = await confirmDialog?.confirm(
			'Delete this exercise?',
			`"${data.exercise.title}" and its files will be gone. Your practice history keeps its name.`
		);
		if (confirmed) deleteForm?.requestSubmit();
	}

	const fieldClass =
		'focus-live mt-1 block min-h-11 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100';
	const labelClass =
		'text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300';
</script>

<svelte:head>
	<title>{data.exercise.title} — Practice</title>
</svelte:head>

{#snippet noAudio()}
	<div
		class="rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-6 text-center dark:border-surface-700 dark:bg-surface-900/50"
	>
		<p class="text-sm text-surface-500 dark:text-surface-300">
			No audio or chart yet. Add one, or just play it to the metronome.
		</p>
	</div>
{/snippet}

{#key data.exercise.id}
	<ShedScreen
		item={{ kind: 'exercise', refId: data.exercise.id, label: data.exercise.title }}
		title={data.exercise.title}
		lengthSeconds={data.exercise.target_seconds}
		variants={data.variants}
		charts={data.charts}
		notes={data.exercise.notes}
		backHref={data.backHref}
		emptyAudio={noAudio}
		sideLabel="Edit"
	>
		{#snippet side()}
			<div class="flex flex-col gap-4">
				<form method="POST" action="?/update" use:enhance class="flex flex-col gap-2">
					<label>
						<span class={labelClass}>Name</span>
						<input name="title" value={data.exercise.title} required class={fieldClass} />
					</label>
					<label>
						<span class={labelClass}>Minutes</span>
						<input
							name="minutes"
							type="number"
							min="0.5"
							max="240"
							step="0.5"
							value={data.exercise.target_seconds / 60}
							required
							class={fieldClass}
						/>
					</label>
					<label>
						<span class={labelClass}>How to play it</span>
						<textarea
							name="notes"
							rows="3"
							class="{fieldClass} py-2"
							value={data.exercise.notes ?? ''}></textarea>
					</label>
					{#if form?.error}
						<p role="alert" class="text-sm text-danger-600 dark:text-danger-400">{form.error}</p>
					{/if}
					<button
						type="submit"
						class="focus-live min-h-11 rounded-lg border border-surface-300 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800"
					>
						Save changes
					</button>
				</form>

				<div>
					<p class={labelClass}>Add a chart or Guitar Pro file</p>
					<div class="mt-1">
						<FileUploadZone
							supabase={page.data.supabase}
							bucket="exercise-files"
							makePath={(ext) => `exercises/${exerciseId}/${crypto.randomUUID()}.${ext}`}
							action="?/uploadFile"
							uploadLabel="Upload chart"
							dense
						>
							{#snippet fields()}
								<input type="hidden" name="exercise_id" value={exerciseId} />
							{/snippet}
						</FileUploadZone>
					</div>
				</div>

				<div>
					<p class={labelClass}>Add a backing track</p>
					<div class="mt-1">
						<AudioUploadZone
							supabase={page.data.supabase}
							bucket="exercise-files"
							makePath={(ext) => `exercises/${exerciseId}/${crypto.randomUUID()}.${ext}`}
							action="?/uploadAudio"
							uploadLabel="Upload audio"
							dense
						>
							{#snippet fields()}
								<input type="hidden" name="exercise_id" value={exerciseId} />
							{/snippet}
						</AudioUploadZone>
					</div>
				</div>

				{#if data.charts.length + data.variants.length > 0}
					<ul class="flex flex-col gap-1">
						{#each data.charts as chart (chart.id)}
							<li class="flex items-center justify-between gap-2 text-sm">
								<span class="min-w-0 truncate text-surface-700 dark:text-surface-300">
									{chart.label ?? chart.file_name}
								</span>
								<form method="POST" action="?/deleteFile" use:enhance>
									<input type="hidden" name="id" value={chart.id} />
									<button
										type="submit"
										aria-label="Remove {chart.file_name}"
										class="focus-live min-h-11 rounded-lg px-3 text-sm text-surface-500 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
									>
										Remove
									</button>
								</form>
							</li>
						{/each}
						{#each data.variants as variant (variant.id)}
							<li class="flex items-center justify-between gap-2 text-sm">
								<span class="min-w-0 truncate text-surface-700 dark:text-surface-300">
									{variant.label ?? variant.file_name}
								</span>
								<form method="POST" action="?/deleteAudio" use:enhance>
									<input type="hidden" name="id" value={variant.id} />
									<button
										type="submit"
										aria-label="Remove {variant.file_name}"
										class="focus-live min-h-11 rounded-lg px-3 text-sm text-surface-500 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
									>
										Remove
									</button>
								</form>
							</li>
						{/each}
					</ul>
				{/if}

				<form
					bind:this={deleteForm}
					method="POST"
					action="?/delete"
					use:enhance
					class="hidden"
				></form>
				<button
					type="button"
					onclick={handleDelete}
					class="focus-live min-h-11 rounded-lg text-sm font-medium text-danger-600 hover:bg-surface-100 dark:text-danger-400 dark:hover:bg-surface-800"
				>
					Delete exercise
				</button>
			</div>
		{/snippet}
	</ShedScreen>
{/key}

<ConfirmDialog bind:this={confirmDialog} />
