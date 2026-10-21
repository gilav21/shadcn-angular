/**
 * Real-socket server for the network specs. The behaviour under test IS what
 * undici + `AbortSignal` do with a stalled or reset connection, so a `fetch`
 * stub cannot stand in for it. Test scaffolding only — excluded from the build.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/** What the server does with one request. */
export type Step =
    /** Accept the connection, never answer. */
    | 'stall'
    /** Destroy the socket without a response. */
    | 'reset'
    /** Send the headers and a partial body, then stop. */
    | 'stall-body'
    | { readonly status: number; readonly body?: string };

export interface TestServer {
    readonly url: string;
    /** Requests received so far. */
    readonly requests: () => number;
    readonly close: () => Promise<void>;
}

function respond(step: Step, res: http.ServerResponse): void {
    if (step === 'stall') return;
    if (step === 'reset') {
        res.destroy();
        return;
    }
    if (step === 'stall-body') {
        res.writeHead(200, { 'content-length': '1000' });
        res.write('partial');
        return;
    }
    res.writeHead(step.status, { 'content-length': Buffer.byteLength(step.body ?? '') });
    res.end(step.body ?? '');
}

/** Request `n` (0-based) gets `script[n]`; past the end, the last step repeats. */
export async function startServer(script: readonly Step[]): Promise<TestServer> {
    let received = 0;
    const server = http.createServer((...[, res]) => {
        const step = script[Math.min(received, script.length - 1)];
        received++;
        respond(step, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}`,
        requests: () => received,
        close: () => new Promise<void>((resolve) => {
            server.closeAllConnections();
            server.close(() => resolve());
        }),
    };
}
