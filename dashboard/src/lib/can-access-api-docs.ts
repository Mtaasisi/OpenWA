/** Swagger / API docs — visible in local dev or for dashboard admins only. */
export function canAccessApiDocs(isAdmin = false): boolean {
  return import.meta.env.DEV || isAdmin;
}
