// T-8, T-9, T-10 from `specs/stackblitz-playground-spec.md` §2.2.
//
// The payload is the contract with StackBlitz. The probe in §3.1 established
// the exact shape that boots; these tests pin it so a refactor cannot quietly
// drift back to something that hangs.
import { describe, it, expect } from 'vitest';
import { buildPayload, payloadBytes, POST_URL, MAX_PAYLOAD_BYTES } from './payload';
import type { PlaygroundProject } from './project';

const PROJECT: PlaygroundProject = {
    files: {
        'package.json': '{"name":"x"}',
        'src/main.ts': 'export const a = 1;',
        'src/components/ui/button/button.component.ts': 'export class B {}',
    },
};

describe('T-8 the payload uses the shape the probe proved boots', () => {
    it('posts to stackblitz.com/run', () => {
        expect(POST_URL.startsWith('https://stackblitz.com/run')).toBe(true);
    });

    it('opens on the app component, not package.json', () => {
        // StackBlitz opens the first file when told nothing, which put the
        // reader in `package.json` — a dependency list — on a page whose whole
        // promise is "see this component work".
        expect(POST_URL).toContain('file=src%2Fapp%2Fapp.ts');
    });

    it('keys every file as project[files][<path>]', () => {
        const fields = buildPayload(PROJECT, 'button');
        expect(fields.get('project[files][package.json]')).toBe('{"name":"x"}');
        expect(fields.get('project[files][src/main.ts]')).toBe('export const a = 1;');
        expect(fields.get('project[files][src/components/ui/button/button.component.ts]'))
            .toBe('export class B {}');
    });

    it('declares the node template — not a legacy angular-cli one', () => {
        // The WebContainer `node` template is what ran `npm install && npm start`
        // in the probe. The legacy EngineBlock templates cannot build Angular 21.
        expect(buildPayload(PROJECT, 'button').get('project[template]')).toBe('node');
    });

    it('titles the project after the component, so a shared link is legible', () => {
        expect(buildPayload(PROJECT, 'button').get('project[title]')).toContain('button');
    });

    it('carries every file and nothing else under project[files]', () => {
        const fields = buildPayload(PROJECT, 'button');
        const fileKeys = [...fields.keys()].filter(k => k.startsWith('project[files]'));
        expect(fileKeys).toHaveLength(Object.keys(PROJECT.files).length);
    });
});

describe('T-9 no generated path escapes the project root', () => {
    it('rejects a traversal segment rather than posting it', () => {
        expect(() => buildPayload(
            { files: { '../../etc/passwd': 'x' } },
            'evil',
        )).toThrow(/\.\./);
    });

    it('rejects an absolute path', () => {
        expect(() => buildPayload({ files: { '/etc/passwd': 'x' } }, 'evil'))
            .toThrow(/absolute/i);
    });

    it('accepts ordinary nested paths', () => {
        expect(() => buildPayload(PROJECT, 'button')).not.toThrow();
    });
});

describe('T-10 payload size is measured and reported, never truncated', () => {
    it('measures the encoded size of the whole project', () => {
        const bytes = payloadBytes(PROJECT);
        expect(bytes).toBeGreaterThan(0);
        // Every file's contents must be counted, not just the keys.
        expect(bytes).toBeGreaterThan(
            Object.values(PROJECT.files).join('').length,
        );
    });

    it('throws with the measured size when a project is too large to post', () => {
        const huge: PlaygroundProject = {
            files: { 'src/big.ts': 'x'.repeat(MAX_PAYLOAD_BYTES + 1) },
        };
        // Explicitly NOT truncating: a silently smaller project would boot and
        // then fail to compile, which reads as a StackBlitz fault.
        expect(() => buildPayload(huge, 'big')).toThrow(/too large/i);
    });

    it('reports the size in the error so the limit can be judged', () => {
        const huge: PlaygroundProject = {
            files: { 'src/big.ts': 'x'.repeat(MAX_PAYLOAD_BYTES + 1) },
        };
        expect(() => buildPayload(huge, 'big')).toThrow(/\d/);
    });

    it('allows a project just under the limit', () => {
        const nearly: PlaygroundProject = {
            files: { 'src/big.ts': 'x'.repeat(1000) },
        };
        expect(() => buildPayload(nearly, 'ok')).not.toThrow();
    });
});
