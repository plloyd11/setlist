<script lang="ts">
	import { goto } from '$app/navigation';

	interface VersionOption {
		version_number: number;
		file_name: string;
		created_at: string;
	}

	let {
		versions,
		selected
	}: {
		versions: VersionOption[];
		selected: number;
	} = $props();

	function label(v: VersionOption): string {
		const date = new Date(v.created_at).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		});
		return `v${v.version_number} — ${v.file_name} — ${date}`;
	}

	function handleChange(e: Event) {
		const value = (e.target as HTMLSelectElement).value;
		goto(`?version=${value}`, { noScroll: true });
	}
</script>

<select
	value={String(selected)}
	onchange={handleChange}
	aria-label="Track version"
	class="focus-live rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
>
	{#each versions as version (version.version_number)}
		<option value={String(version.version_number)}>{label(version)}</option>
	{/each}
</select>
