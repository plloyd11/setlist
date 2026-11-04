/**
 * Profile rows only exist once someone saves a name in Settings, so a missing
 * name means "hasn't set one", not "left the band".
 */
export const UNNAMED_MEMBER = 'Unnamed member';

export function memberName(profile: { display_name?: string | null } | null | undefined): string {
	return profile?.display_name?.trim() || UNNAMED_MEMBER;
}
