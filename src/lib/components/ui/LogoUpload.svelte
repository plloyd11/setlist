<script lang="ts">
	import { createBrowserClient } from '@supabase/ssr';
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
	import { invalidateAll } from '$app/navigation';

	let {
		currentLogoUrl = null,
		userId,
		table = 'profiles',
		storagePath
	}: {
		currentLogoUrl: string | null;
		userId: string;
		table?: 'profiles' | 'bands';
		storagePath?: string;
	} = $props();

	let uploading = $state(false);
	let error = $state('');
	let previewUrl = $state<string | null>(null);

	// Sync preview with prop changes
	$effect(() => {
		previewUrl = currentLogoUrl;
	});

	const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
	const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

	function getSupabase() {
		return createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		error = '';

		// Validate type
		if (!ACCEPTED_TYPES.includes(file.type)) {
			error = 'Please upload a PNG, JPEG, WebP, or SVG image.';
			return;
		}

		// Validate size
		if (file.size > MAX_FILE_SIZE) {
			error = 'Image must be under 2MB.';
			return;
		}

		uploading = true;

		try {
			const supabase = getSupabase();
			const ext = file.name.split('.').pop() || 'png';
			const filePath = storagePath ? storagePath.replace('{ext}', ext) : `${userId}/logo.${ext}`;

			// Upload to storage
			const { error: uploadError } = await supabase.storage
				.from('logos')
				.upload(filePath, file, { upsert: true, contentType: file.type });

			if (uploadError) {
				error = 'Failed to upload image. Please try again.';
				return;
			}

			// Get public URL
			const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filePath);
			const publicUrl = urlData.publicUrl;

			// Save URL to database
			const { error: saveError } =
				table === 'profiles'
					? await supabase.from('profiles').upsert({
							id: userId,
							logo_url: publicUrl,
							updated_at: new Date().toISOString()
						})
					: await supabase
							.from('bands')
							.update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
							.eq('id', userId);

			if (saveError) {
				error = 'Failed to save logo. Please try again.';
				return;
			}

			previewUrl = publicUrl;
			await invalidateAll();
		} catch {
			error = 'An unexpected error occurred.';
		} finally {
			uploading = false;
			// Reset input so same file can be re-selected
			input.value = '';
		}
	}

	async function removeLogo() {
		uploading = true;
		error = '';

		try {
			const supabase = getSupabase();

			// Clear logo_url in database
			const { error: saveError } =
				table === 'profiles'
					? await supabase.from('profiles').upsert({
							id: userId,
							logo_url: null,
							updated_at: new Date().toISOString()
						})
					: await supabase
							.from('bands')
							.update({ logo_url: null, updated_at: new Date().toISOString() })
							.eq('id', userId);

			if (saveError) {
				error = 'Failed to remove logo.';
				return;
			}

			previewUrl = null;
			await invalidateAll();
		} catch {
			error = 'An unexpected error occurred.';
		} finally {
			uploading = false;
		}
	}
</script>

<div class="space-y-3">
	<p class="text-sm font-medium text-surface-700 dark:text-surface-300">
		Profile Photo / Band Logo
	</p>

	<!-- Upload area / preview -->
	<div
		class="relative flex min-h-[120px] items-center justify-center rounded-xl border-2 border-dashed border-surface-300 bg-surface-50 transition-colors hover:border-accent-400 dark:border-surface-600 dark:bg-surface-800/50 dark:hover:border-accent-600"
	>
		{#if previewUrl}
			<div class="flex flex-col items-center gap-3 p-4">
				<img src={previewUrl} alt="Logo preview" class="max-h-24 w-auto rounded" />
				<div class="flex gap-2">
					<label
						class="cursor-pointer rounded px-3 py-1 text-xs font-medium text-accent-600 hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-900/20"
					>
						Replace
						<input
							type="file"
							accept="image/png,image/jpeg,image/webp,image/svg+xml"
							onchange={handleFileSelect}
							class="hidden"
							disabled={uploading}
						/>
					</label>
					<button
						onclick={removeLogo}
						disabled={uploading}
						class="rounded px-3 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20"
					>
						Remove
					</button>
				</div>
			</div>
		{:else}
			<label class="flex cursor-pointer flex-col items-center gap-2 p-6">
				<svg
					class="h-8 w-8 text-surface-400 dark:text-surface-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
					/>
				</svg>
				<span class="text-sm text-surface-500 dark:text-surface-400">
					{uploading ? 'Uploading...' : 'Click to upload logo'}
				</span>
				<span class="text-xs text-surface-400 dark:text-surface-500"
					>PNG, JPEG, WebP, or SVG (max 2MB)</span
				>
				<input
					type="file"
					accept="image/png,image/jpeg,image/webp,image/svg+xml"
					onchange={handleFileSelect}
					class="hidden"
					disabled={uploading}
				/>
			</label>
		{/if}

		{#if uploading}
			<div
				class="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-50/70 dark:bg-surface-900/70"
			>
				<svg class="h-6 w-6 animate-spin text-accent-500" viewBox="0 0 24 24" fill="none">
					<circle
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
						class="opacity-25"
					/>
					<path
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						class="opacity-75"
					/>
				</svg>
			</div>
		{/if}
	</div>

	{#if error}
		<p class="text-sm text-danger-600 dark:text-danger-400">{error}</p>
	{/if}
</div>
