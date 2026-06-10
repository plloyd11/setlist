<script lang="ts">
	import { enhance } from '$app/forms';

	interface MemberData {
		id: string;
		user_id: string;
		role: string;
		joined_at: string;
		display_name: string | null;
		logo_url: string | null;
	}

	let {
		member,
		isOwner,
		currentUserId,
		bandId
	}: {
		member: MemberData;
		isOwner: boolean;
		currentUserId: string;
		bandId: string;
	} = $props();

	let isCurrentUser = $derived(member.user_id === currentUserId);
	let isMemberOwner = $derived(member.role === 'owner');
	let initial = $derived(member.display_name ? member.display_name.charAt(0).toUpperCase() : '?');

	function formatDate(dateStr: string): string {
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	let confirmingRemove = $state(false);
	let confirmingTransfer = $state(false);
</script>

<div
	class="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
>
	<div class="flex items-center gap-3">
		<!-- Avatar -->
		{#if member.logo_url}
			<img
				src={member.logo_url}
				alt={member.display_name ?? 'Member'}
				loading="lazy"
				class="h-9 w-9 rounded-full object-cover"
			/>
		{:else}
			<div
				class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-200 text-sm font-medium text-surface-600 dark:bg-surface-700 dark:text-surface-300"
			>
				{initial}
			</div>
		{/if}

		<div>
			<div class="flex items-center gap-2">
				<span class="font-medium text-surface-900 dark:text-surface-100">
					{member.display_name ?? 'Unknown'}
				</span>
				{#if isMemberOwner}
					<span
						class="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-400"
					>
						Owner
					</span>
				{:else}
					<span
						class="rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-600 dark:bg-surface-700 dark:text-surface-400"
					>
						Member
					</span>
				{/if}
				{#if isCurrentUser}
					<span class="text-xs text-surface-400 dark:text-surface-500">(you)</span>
				{/if}
			</div>
			<p class="text-xs text-surface-500 dark:text-surface-400">
				Joined {formatDate(member.joined_at)}
			</p>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex items-center gap-2">
		{#if isOwner && !isMemberOwner && !isCurrentUser}
			<!-- Owner can remove non-owner members -->
			{#if confirmingRemove}
				<form
					method="POST"
					action="/bands/{bandId}/members?/removeMember"
					use:enhance={() => {
						return async ({ update }) => {
							confirmingRemove = false;
							await update();
						};
					}}
				>
					<input type="hidden" name="member_id" value={member.id} />
					<div class="flex items-center gap-1">
						<button
							type="submit"
							class="rounded-md bg-danger-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-danger-600"
						>
							Confirm
						</button>
						<button
							type="button"
							onclick={() => (confirmingRemove = false)}
							class="rounded-md bg-surface-200 px-2.5 py-1 text-xs font-medium text-surface-700 hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600"
						>
							Cancel
						</button>
					</div>
				</form>
			{:else if confirmingTransfer}
				<form
					method="POST"
					action="/bands/{bandId}/members?/transferOwnership"
					use:enhance={() => {
						return async ({ update }) => {
							confirmingTransfer = false;
							await update();
						};
					}}
				>
					<input type="hidden" name="new_owner_id" value={member.user_id} />
					<div class="flex items-center gap-1">
						<button
							type="submit"
							class="rounded-md bg-accent-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-600"
						>
							Confirm Transfer
						</button>
						<button
							type="button"
							onclick={() => (confirmingTransfer = false)}
							class="rounded-md bg-surface-200 px-2.5 py-1 text-xs font-medium text-surface-700 hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600"
						>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<button
					type="button"
					onclick={() => (confirmingTransfer = true)}
					class="rounded-md border border-surface-300 px-2.5 py-1 text-xs font-medium text-surface-600 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-400 dark:hover:bg-surface-700"
				>
					Transfer Ownership
				</button>
				<button
					type="button"
					onclick={() => (confirmingRemove = true)}
					class="rounded-md border border-danger-300 px-2.5 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50 dark:border-danger-700 dark:text-danger-400 dark:hover:bg-danger-900/20"
				>
					Remove
				</button>
			{/if}
		{/if}

		{#if !isOwner && isCurrentUser && !isMemberOwner}
			<!-- Non-owner member can leave -->
			<form method="POST" action="/bands/{bandId}/members?/leaveBand" use:enhance>
				<button
					type="submit"
					class="rounded-md border border-surface-300 px-2.5 py-1 text-xs font-medium text-surface-600 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-400 dark:hover:bg-surface-700"
				>
					Leave Band
				</button>
			</form>
		{/if}
	</div>
</div>
