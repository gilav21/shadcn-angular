import { afterEach, describe, expect, it } from 'vitest';
import { fetchText, fetchWithTimeout, resolveTimeoutMs } from './http.js';
import { startServer, type Step, type TestServer } from './http-fixtures.js';

const FAST = { retryDelayMs: 10 } as const;

describe('fetchWithTimeout', () => {
    let server: TestServer | undefined;
    afterEach(async () => {
        await server?.close();
        server = undefined;
    });

    it('fails within the budget when the host never answers, and names the URL', async () => {
        server = await startServer(['stall']);
        const url = `${server.url}/registry.json`;

        const started = Date.now();
        await expect(fetchWithTimeout(url, undefined, { timeoutMs: 200, retries: 0 }))
            .rejects.toMatchObject({
                kind: 'timeout',
                url,
                message: `Timed out after 200 ms: ${url}`,
            });

        expect(Date.now() - started).toBeLessThan(1000);
    });

    it.each<{ name: string; script: Step[]; status: number; requests: number }>([
        { name: 'connection reset, then ok', script: ['reset', { status: 200, body: 'ok' }], status: 200, requests: 2 },
        { name: '503, then ok', script: [{ status: 503 }, { status: 200, body: 'ok' }], status: 200, requests: 2 },
        { name: '429, then ok', script: [{ status: 429 }, { status: 200, body: 'ok' }], status: 200, requests: 2 },
        { name: 'stall, then ok', script: ['stall', { status: 200, body: 'ok' }], status: 200, requests: 2 },
        { name: '404 is the caller\'s to interpret, never retried', script: [{ status: 404 }, { status: 200 }], status: 404, requests: 1 },
        { name: 'a second 503 is returned as is, after exactly one retry', script: [{ status: 503, body: 'first' }, { status: 503, body: 'second' }], status: 503, requests: 2 },
    ])('retries once on a transient failure and not on a client error: $name', async ({ script, status, requests }) => {
        server = await startServer(script);

        const response = await fetchWithTimeout(`${server.url}/x`, undefined, { timeoutMs: 200, ...FAST });

        expect(response.status).toBe(status);
        expect(server.requests()).toBe(requests);
    });

    it('returns the second 503 body, not the first', async () => {
        server = await startServer([{ status: 503, body: 'first' }, { status: 503, body: 'second' }]);

        const result = await fetchText(`${server.url}/x`, undefined, { timeoutMs: 200, ...FAST });

        expect(result).toEqual({ status: 503, statusText: 'Service Unavailable', ok: false, text: 'second' });
    });

    it('covers the body too: headers sent, body stalls, rejects within the budget', async () => {
        server = await startServer(['stall-body']);
        const url = `${server.url}/x`;

        const started = Date.now();
        await expect(fetchText(url, undefined, { timeoutMs: 200, retries: 0 }))
            .rejects.toThrow(`Timed out after 200 ms: ${url}`);

        expect(Date.now() - started).toBeLessThan(1000);
    });

    it('reports an unreachable host as unreachable, with the cause', async () => {
        server = await startServer(['stall']);
        const url = `${server.url}/x`;
        await server.close();

        const failure = await fetchWithTimeout(url, undefined, { timeoutMs: 200, retries: 0 })
            .catch((error: unknown) => error);

        expect(failure).toMatchObject({
            kind: 'unreachable',
            url,
            message: expect.stringContaining(`Could not reach the registry (${url}): `),
        });
        expect(failure).toHaveProperty('message', expect.stringContaining('ECONNREFUSED'));
    });

    it('SHADCN_ANGULAR_FETCH_TIMEOUT_MS sets the budget when none is passed', async () => {
        server = await startServer(['stall']);
        const saved = process.env['SHADCN_ANGULAR_FETCH_TIMEOUT_MS'];
        process.env['SHADCN_ANGULAR_FETCH_TIMEOUT_MS'] = '150';
        try {
            await expect(fetchWithTimeout(`${server.url}/x`, undefined, { retries: 0 }))
                .rejects.toThrow(/^Timed out after 150 ms: /);
        } finally {
            if (saved === undefined) delete process.env['SHADCN_ANGULAR_FETCH_TIMEOUT_MS'];
            else process.env['SHADCN_ANGULAR_FETCH_TIMEOUT_MS'] = saved;
        }
    });
});

describe('resolveTimeoutMs', () => {
    it.each([
        { env: undefined, expected: 15_000 },
        { env: '2000', expected: 2000 },
        { env: 'abc', expected: 15_000 },
        { env: '0', expected: 15_000 },
        { env: '-5', expected: 15_000 },
        { env: '', expected: 15_000 },
    ])('uses the env budget only when it is a positive number: $env', ({ env, expected }) => {
        expect(resolveTimeoutMs(env)).toBe(expected);
    });
});
