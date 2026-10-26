/** Shared by the admin server code and the admin pages (no server imports). */

/** The hidden form field carrying the CSRF token in every admin form. */
export const CSRF_FIELD_NAME = "csrf";

export const ADMIN_LOGIN_PATH = "/admin/login";

export const GAME_VISIBILITIES = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;

/** Rows per page in the admin lists. */
export const ADMIN_PAGE_SIZE = 20;

/** The Supabase free plan includes 1 GB of Storage. */
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
/** The Supabase free plan includes a 500 MB database. */
export const DATABASE_LIMIT_BYTES = 500 * 1024 * 1024;

/** pagePath is the page a form was posted from, for redirecting back to it
 * after an action. React Router posts to `<path>.data` (single fetch) and
 * adds its own search params; both are removed. */
export function pagePath(requestUrl: string): string {
  const url = new URL(requestUrl);
  const pathname = url.pathname.replace(/\.data$/, "");
  url.searchParams.delete("index");
  url.searchParams.delete("_routes");
  const search = url.searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}
