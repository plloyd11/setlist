<script lang="ts">
	import { memberName } from '#lib/utils/memberName.js';
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
	class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
>
	<div class="flex min-w-0 flex-1 basis-56 items-center gap-3">
		<!-- Avatar -->
		{#if member.logo_url}
			<img
				src={member.logo_url}
				alt={member.display_name ?? 'Member'}
				loading="lazy"
				class="h-9 w-9 shrink-0 rounded-full object-cover"
			/>
		{:else}
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-200 text-sm font-medium text-surface-600 dark:bg-surface-700 dark:text-surface-300"
			>
				{initial}
			</div>
		{/if}

		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
				<span class="min-w-0 truncate font-medium text-surface-900 dark:text-surface-100">
					{memberName(member)}
				</span>
				{#if isMemberOwner}
					<span
						class="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-400"
					>
						Owner
					</span>
				{:else}
					<span
						class="rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-600 dark:bg-surface-700 dark:text-surface-300"
					>
						Member
					</span>
				{/if}
				{#if isCurrentUser}
					<span class="text-xs text-surface-500 dark:text-surface-300">(you)</span>
					{#if !member.display_name}
						<a
							href="/settings"
							class="hit-44 focus-live rounded text-xs font-medium text-accent-600 hover:underline dark:text-accent-300"
						>
							Add your name
						</a>
					{/if}
				{/if}
			</div>
			<p class="text-xs text-surface-500 dark:text-surface-300">
				Joined {formatDate(member.joined_at)}
			</p>
		</div>
	</div>

	<!-- Actions -->
	<div class="ml-auto flex items-center gap-2 empty:hidden">
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
							class="min-h-11 rounded-md bg-danger-500 px-3 py-1 text-xs font-medium text-white hover:bg-danger-600 md:min-h-0"
						>
							Confirm
						</button>
						<button
							type="button"
							onclick={() => (confirmingRemove = false)}
							class="min-h-11 rounded-md bg-surface-200 px-3 py-1 text-xs font-medium text-surface-700 hover:bg-surface-300 md:min-h-0 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600"
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
							class="min-h-11 rounded-md bg-accent-500 px-3 py-1 text-xs font-medium text-white hover:bg-accent-600 md:min-h-0"
						>
							Confirm transfer
						</button>
						<button
							type="button"
							onclick={() => (confirmingTransfer = false)}
							class="min-h-11 rounded-md bg-surface-200 px-3 py-1 text-xs font-medium text-surface-700 hover:bg-surface-300 md:min-h-0 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600"
						>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<button
					type="button"
					onclick={() => (confirmingTransfer = true)}
					class="min-h-11 rounded-md border border-surface-300 px-3 py-1 text-xs font-medium text-surface-600 hover:bg-surface-100 md:min-h-0 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-700"
				>
					Transfer ownership
				</button>
				<button
					type="button"
					onclick={() => (confirmingRemove = true)}
					class="min-h-11 rounded-md border border-danger-300 px-3 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50 md:min-h-0 dark:border-danger-700 dark:text-danger-300 dark:hover:bg-danger-900/20"
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
					class="min-h-11 rounded-md border border-surface-300 px-3 py-1 text-xs font-medium text-surface-600 hover:bg-surface-100 md:min-h-0 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-700"
				>
					Leave band
				</button>
			</form>
		{/if}
	</div>
</div>
