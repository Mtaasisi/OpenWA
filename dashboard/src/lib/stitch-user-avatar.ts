export function stitchUserAvatarUrl(name: string, email?: string | null): string {
  const seed = encodeURIComponent(name.trim() || email?.trim() || 'User');
  return `https://ui-avatars.com/api/?name=${seed}&background=eff6ff&color=2563eb&size=64&bold=true`;
}
