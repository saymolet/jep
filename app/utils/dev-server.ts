const DEFAULT_PORT = 3000;

/** Vite dev-server options derived from the app's public origin.
 *
 * `PORT` wins so the server can listen locally behind a reverse proxy whose
 * public origin has no port (e.g. https://jep.example.com). The origin's host
 * is allowed explicitly because Vite rejects unknown `Host` headers. */
export function devServerOptions({
  baseUrl,
  port,
}: {
  baseUrl: string;
  port?: number;
}): { port: number; allowedHosts: string[] } {
  const url = new URL(baseUrl);
  const originPort = url.port ? Number(url.port) : undefined;
  return {
    port: port ?? originPort ?? DEFAULT_PORT,
    allowedHosts: [url.hostname],
  };
}
