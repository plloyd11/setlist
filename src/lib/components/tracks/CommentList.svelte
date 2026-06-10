<script lang="ts" module>
	import type { TrackComment, Profile } from '$lib/types/database';

	export type EnrichedComment = TrackComment & {
		author_name: string;
		author_logo_url: string | null;
		resolver_name: string | null;
	};

	export type ProfileMap = Record<string, Pick<Profile, 'id' | 'display_name' | 'logo_url'>>;
</script>

<script lang="ts">
	import CommentItem from './CommentItem.svelte';

	let {
		comments,
		profiles,
		currentUserId,
		isOwner,
		currentTime,
		onseek,
		onreply,
		ontoggleresolve,
		ondelete
	}: {
		comments: TrackComment[];
		profiles: ProfileMap;
		currentUserId: string;
		isOwner: boolean;
		currentTime: number;
		onseek: (time: number) => void;
		onreply: (comment: EnrichedComment) => void;
		ontoggleresolve: (comment: EnrichedComment) => void;
		ondelete: (comment: EnrichedComment) => void;
	} = $props();

	let flashedId = $state<string | null>(null);

	function enrich(comment: TrackComment): EnrichedComment {
		const author = comment.author_id ? profiles[comment.author_id] : null;
		const resolver = comment.resolved_by ? profiles[comment.resolved_by] : null;
		return {
			...comment,
			author_name: author?.display_name ?? 'Former member',
			author_logo_url: author?.logo_url ?? null,
			resolver_name: resolver?.display_name ?? null
		};
	}

	// General comments first, then timestamped in playback order
	let topLevel = $derived(
		comments
			.filter((c) => c.parent_id === null)
			.map(enrich)
			.sort((a, b) => {
				if (a.timestamp_seconds === null && b.timestamp_seconds === null) {
					return a.created_at.localeCompare(b.created_at);
				}
				if (a.timestamp_seconds === null) return -1;
				if (b.timestamp_seconds === null) return 1;
				return a.timestamp_seconds - b.timestamp_seconds;
			})
	);

	let repliesByParent = $derived.by(() => {
		const map = new Map<string, EnrichedComment[]>();
		for (const c of comments) {
			if (c.parent_id !== null) {
				const list = map.get(c.parent_id) ?? [];
				list.push(enrich(c));
				map.set(c.parent_id, list);
			}
		}
		for (const list of map.values()) {
			list.sort((a, b) => a.created_at.localeCompare(b.created_at));
		}
		return map;
	});

	// Highlight the most recent timestamped comment at/behind the playhead
	let highlightedId = $derived.by(() => {
		let id: string | null = null;
		for (const c of topLevel) {
			if (c.timestamp_seconds !== null && c.timestamp_seconds <= currentTime) {
				id = c.id;
			}
		}
		return id;
	});

	function canDelete(comment: EnrichedComment): boolean {
		return isOwner || comment.author_id === currentUserId;
	}

	export function scrollToComment(id: string) {
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		document
			.getElementById(`track-comment-${id}`)
			?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
		flashedId = id;
		setTimeout(() => {
			if (flashedId === id) flashedId = null;
		}, 1500);
	}
</script>

{#if topLevel.length === 0}
	<p class="py-6 text-center text-sm text-surface-500 dark:text-surface-300">
		No feedback yet. Play the track and pin a comment at any moment.
	</p>
{:else}
	<div class="space-y-3">
		{#each topLevel as comment (comment.id)}
			<div class="space-y-2">
				<CommentItem
					{comment}
					canDelete={canDelete(comment)}
					highlighted={comment.id === highlightedId}
					flashed={comment.id === flashedId}
					{onseek}
					{onreply}
					{ontoggleresolve}
					{ondelete}
				/>
				{#each repliesByParent.get(comment.id) ?? [] as reply (reply.id)}
					<div class="ml-8">
						<CommentItem
							comment={reply}
							isReply
							canDelete={canDelete(reply)}
							{onseek}
							{ontoggleresolve}
							{ondelete}
						/>
					</div>
				{/each}
			</div>
		{/each}
	</div>
{/if}
