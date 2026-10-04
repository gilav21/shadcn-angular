import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyPrefixTransforms } from '../src/utils/prefix.js';
import {
    SELECTOR_REFERENCE_ALLOWLIST,
    checkReferences,
    declaredSelectors,
    findSelectorReferences,
    scanRepo,
    type RepoScan,
    type SelectorReference,
} from './selector-references.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const RESULT_TS = 'packages/components/ui/result/result.component.ts';
const RESULT_HTML = 'packages/components/ui/result/result.component.html';
const RESULT_DETAIL_TS = 'packages/components/ui/result/sub/result-detail.component.ts';

/** The two declarations of the `result` folder, the way they really read. */
const RESULT_SOURCES = new Map([
    [RESULT_TS, [
        '/** A status screen. Pair it with `selector: \'ui-ghost\'` in docs only. */',
        '@Component({',
        "    selector: 'ui-result',",
        "    templateUrl: './result.component.html',",
        '})',
        'export class ResultComponent {}',
    ].join('\n')],
    [RESULT_DETAIL_TS, [
        '@Component({',
        "    selector: 'ui-result-detail, [uiResultDetail]',",
        "    template: '<ng-content />',",
        '})',
        'export class ResultDetailComponent {}',
    ].join('\n')],
]);

const byText = (a: string, b: string): number => a.localeCompare(b);

/** One line per reference, order-insensitive: the contract is the set of references, not the scan order. */
const brief = (refs: readonly SelectorReference[]): string[] =>
    refs.map((r) => `${r.kind} ${r.line} ${r.token}`).sort(byText);

describe('selector-references scanner', () => {
    it('reports a select token that names no declared selector, with file:line', () => {
        const declared = declaredSelectors(RESULT_SOURCES);
        expect([...declared].sort(byText)).toEqual(['ui-result', 'ui-result-detail']);

        // CRLF on purpose: 184 committed blobs are CRLF, and a scan that counts
        // `\r\n` as two breaks would point the reader at the wrong line.
        const html = [
            '<output [class]="classes()" data-slot="result">',
            '  <div data-slot="result-title">{{ title() }}</div>',
            '  <ng-content select="ui-result-details" />',
            '  <ui-result-detail>ok</ui-result-detail>',
            '</output>',
        ].join('\r\n');
        const refs = findSelectorReferences(RESULT_HTML, html, declared);

        expect(brief(refs)).toEqual([
            'select 3 ui-result-details',
            'tag 4 ui-result-detail',
            'tag 4 ui-result-detail',
        ].sort(byText));
        expect(checkReferences(refs, declared, [])).toEqual([
            `  STALE   ${RESULT_HTML}:3  select token "ui-result-details" names no declared selector`,
        ]);
    });

    it('reports an undeclared CSS element selector in a .css file, ignoring class/keyframe/custom-property tokens', () => {
        const file = 'packages/components/ui/calendar/calendar.component.css';
        const declared = new Set(['ui-select-trigger', 'ui-x']);
        const css = [
            '/* ui-ghost { color: red } was the old trigger */',
            ':host ui-select-triggr {',
            '  --ui-select-trigger-h: 2rem;',
            '  animation: ui-x-fade 1s;',
            '}',
            ':host .ui-select-trigger, ui-select-trigger > span { color: red; }',
            '@keyframes ui-x-fade { from { opacity: 0; } }',
        ].join('\n');
        const refs = findSelectorReferences(file, css, declared);

        expect(brief(refs)).toEqual([
            'css-element 2 ui-select-triggr',
            'css-element 6 ui-select-trigger',
        ].sort(byText));
        expect(checkReferences(refs, declared, [])).toEqual([
            `  STALE   ${file}:2  css-element token "ui-select-triggr" names no declared selector`,
        ]);
    });

    it('reports a declared selector token in a TS string that is not a selector position', () => {
        const declared = new Set(['ui-result']);
        const file = 'packages/components/ui/foo/foo.component.ts';
        const ts = [
            "// closest('ui-result') would couple us to the tag",
            '/** Projects <ui-result> through `selector: \'ui-result\'`. */',
            '@Component({',
            "    selector: 'ui-result',",
            '    template: `<ui-result><ng-content select="ui-result" /></ui-result>`,',
            '})',
            'export class FooComponent {',
            "    readonly match = this.el.closest('ui-result');",
            "    readonly sheet = 'ui-result [data-x]{color:red}';",
            "    readonly order = '[&>ui-result]:order-last';",
            "    readonly longer = 'ui-result-foo';",
            '    readonly built = `ui-result-${this.n}`;',
            '}',
        ].join('\n');
        const refs = findSelectorReferences(file, ts, declared);

        expect(brief(refs)).toEqual([
            'selector-metadata 4 ui-result',
            'tag 5 ui-result',
            'select 5 ui-result',
            'tag 5 ui-result',
            'other-string 8 ui-result',
            'other-string 9 ui-result',
            'other-string 10 ui-result',
        ].sort(byText));
        const runtime = (line: number) =>
            `  RUNTIME ${file}:${line}  "ui-result" in a string literal — use ElementRef / data-slot, or allowlist it with a reason`;
        expect(checkReferences(refs, declared, [])).toEqual([runtime(8), runtime(9), runtime(10)]);

        const html = [
            '<!-- <ui-result> used to wrap this -->',
            '<div class="[&>ui-result]:order-last"><ui-result /></div>',
        ].join('\n');
        expect(brief(findSelectorReferences('packages/components/ui/foo/foo.component.html', html, declared))).toEqual([
            'other-string 2 ui-result',
            'tag 2 ui-result',
        ].sort(byText));
    });

    it('honours an allowlist entry only for its exact file and token, and fails on a stale allowlist entry', () => {
        const service = 'packages/components/ui/sidebar/sidebar.service.ts';
        const component = 'packages/components/ui/sidebar/sidebar.component.ts';
        const declared = new Set(['ui-sidebar', 'ui-tour']);
        const refs: SelectorReference[] = [
            { file: service, line: 12, token: 'ui-sidebar', kind: 'other-string' },
            { file: service, line: 30, token: 'ui-tour', kind: 'other-string' },
            { file: component, line: 40, token: 'ui-sidebar', kind: 'other-string' },
        ];
        const allow = [
            { file: service, token: 'ui-sidebar', reason: 'persisted localStorage key prefix' },
            { file: component, token: 'ui-command', reason: 'no longer present' },
        ];

        expect(checkReferences(refs, declared, allow)).toEqual([
            `  RUNTIME ${service}:30  "ui-tour" in a string literal — use ElementRef / data-slot, or allowlist it with a reason`,
            `  RUNTIME ${component}:40  "ui-sidebar" in a string literal — use ElementRef / data-slot, or allowlist it with a reason`,
            `  ALLOW-STALE ${component}  allowlist entry for "ui-command" matches nothing — remove it`,
        ]);
    });
});

describe('selector-references on the shipped library', () => {
    let scan: RepoScan;
    let elapsedMs = 0;

    beforeAll(() => {
        const started = performance.now();
        scan = scanRepo(REPO_ROOT);
        elapsedMs = performance.now() - started;
    });

    /** Fails loudly if the scan silently saw nothing — a wrong root reads as "clean". */
    function expectRealScan(): void {
        expect(scan.files.size).toBeGreaterThan(1000);
        // A component, a directive, and a selector declared under `sub/`.
        const expected = ['ui-button', 'ui-file-viewer-toolbar', 'ui-result-detail'];
        expect(expected.filter((selector) => !scan.declared.has(selector))).toEqual([]);
        // …and that every file type was read: a `.html` select slot and a `.css` element selector.
        const seen = (file: string, kind: string, token: string) =>
            scan.references.some((r) => r.file === file && r.kind === kind && r.token === token);
        expect(seen(RESULT_HTML, 'select', 'ui-result-detail')).toBe(true);
        expect(seen('packages/components/ui/calendar/calendar.component.css', 'css-element', 'ui-select-trigger')).toBe(true);
    }

    const report = (lines: readonly string[]): string =>
        `selector-references: ${lines.length} finding(s)\n${lines.join('\n')}`;

    it('the shipped library has no stale selector reference', () => {
        expectRealScan();
        const stale = checkReferences(scan.references, scan.declared, SELECTOR_REFERENCE_ALLOWLIST)
            .filter((line) => line.trimStart().startsWith('STALE'));
        expect(stale, report(stale)).toEqual([]);
    });

    it('the shipped library has no selector dependency outside rewritable positions', () => {
        expectRealScan();
        const runtime = checkReferences(scan.references, scan.declared, SELECTOR_REFERENCE_ALLOWLIST)
            .filter((line) => !line.trimStart().startsWith('STALE'));
        expect(runtime, report(runtime)).toEqual([]);
        const unexplained = SELECTOR_REFERENCE_ALLOWLIST.filter((entry) => entry.reason.trim().length < 10);
        expect(unexplained, 'every allowlist entry needs a written reason').toEqual([]);
        console.info(`[selector-references] scanned ${scan.files.size} files in ${Math.round(elapsedMs)} ms`);
    });

    it('every rewritable position is rewritten by --prefix', () => {
        expectRealScan();
        const rewritable = new Set(['tag', 'select', 'css-element', 'selector-metadata']);
        const left: string[] = [];
        for (const [file, content] of scan.files) {
            const prefixed = applyPrefixTransforms(file, content, 'acme');
            for (const ref of findSelectorReferences(file, prefixed, scan.declared)) {
                if (rewritable.has(ref.kind)) left.push(`  ${ref.kind} ${ref.file}:${ref.line}  "${ref.token}"`);
            }
        }
        expect(left, report(left)).toEqual([]);
    });
});
