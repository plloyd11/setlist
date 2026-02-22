<script lang="ts">
	import { enhance } from '$app/forms';
	import MemberRow from '$lib/components/bands/MemberRow.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';

	let { data, form } = $props();

	let toast: Toast;
	let inviteUrl = $state('');
	let showInviteUrl = $state(false);

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(inviteUrl);
			toast.show('Invite link copied');
		} catch {
			// Fallback: select the input text
			const input = document.querySelector<HTMLInputElement>('#invite-url-input');
			if (input) {
				input.select();
				toast.show('Select and copy the link');
			}
		}
	}
</script>

<div class="p-6 md:p-8">
	<div class="flex items-center justify-between">
		<h2 class="font-display text-2xl text-stone-900 dark:text-stone-100">Members</h2>

		{#if data.isOwner}
			<form
				method="POST"
				action="?/createInvite"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success' && result.data?.inviteUrl) {
							inviteUrl = result.data.inviteUrl as string;
							showInviteUrl = true;
							toast.show('Invite link generated');
						} else {
							await update();
						}
					};
				}}
			>
				<button
					type="submit"
					class="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-stone-900"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
						<path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
					</svg>
					Generate Invite Link
				</button>
			</form>
		{/if}
	</div>

	{#if form?.error}
		<div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
			{form.error}
		</div>
	{/if}

	<!-- Invite URL display -->
	{#if showInviteUrl && inviteUrl}
		<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
			<p class="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
				Share this one-time invite link:
			</p>
			<div class="flex gap-2">
				<input
					id="invite-url-input"
					type="text"
					readonly
					value={inviteUrl}
					class="flex-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-stone-900 dark:border-amber-700 dark:bg-stone-800 dark:text-stone-100"
				/>
				<button
					type="button"
					onclick={copyToClipboard}
					class="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
				>
					Copy
				</button>
			</div>
			<p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
				This link can only be used once and expires in 7 days.
			</p>
		</div>
	{/if}

	<!-- Member list -->
	<div class="mt-6 space-y-2">
		{#each data.members as member (member.id)}
			<MemberRow
				{member}
				isOwner={data.isOwner}
				currentUserId={data.currentUserId}
				bandId={data.band.id}
			/>
		{/each}

		{#if data.members.length === 0}
			<p class="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
				No members yet. Generate an invite link to add members.
			</p>
		{/if}
	</div>
</div>

<Toast bind:this={toast} />
