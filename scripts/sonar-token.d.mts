/**
 * Resolve the SonarQube token from the environment or a local `.env`; exits
 * the process with guidance when none is found. See sonar-token.mjs.
 */
export function resolveSonarToken(): string;

/**
 * Host-side SonarQube base URL (no trailing slash) for scripts that call the
 * web API from the host. See sonar-token.mjs.
 *
 * @param env environment to read; defaults to `process.env`.
 */
export function resolveSonarHost(env?: Readonly<Record<string, string | undefined>>): string;
