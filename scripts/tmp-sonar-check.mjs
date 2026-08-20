import { readFileSync } from 'node:fs';

/**
 * Sonar query helper. Temporary tooling — deleted once the gate is closed.
 *
 * Reads the token from .env on purpose: the shell profile exports a stale
 * value that shadows the valid one.
 *
 *   node scripts/tmp-sonar-check.mjs raw <apiPath>
 *   node scripts/tmp-sonar-check.mjs issues [projectKey]
 */
const token = /^SONAR_TOKEN=(.*)$/m.exec(readFileSync('.env', 'utf8'))?.[1]?.trim();
if (!token) {
    console.error('BLOCKED: no SONAR_TOKEN in .env');
    process.exit(2);
}
const auth = 'Basic ' + Buffer.from(`${token}:`).toString('base64');
const base = 'http://localhost:9000';

async function api(path) {
    const res = await fetch(base + path, { headers: { Authorization: auth } });
    const text = await res.text();
    if (!res.ok) return { __error: `${res.status} ${res.statusText}`, body: text.slice(0, 300) };
    return JSON.parse(text);
}

const [cmd, arg] = process.argv.slice(2);
const key = arg ?? 'shadcn-angular-component-features';

if (cmd === 'raw') {
    console.log(JSON.stringify(await api(arg), null, 1).slice(0, 3000));
    process.exit(0);
}

// Only this bundle's own paths. The project's `**/coverage/**` exclusion misses
// `coverage-*/`, so an unscoped query drowns in generated lcov-report HTML.
const mineRe = /packages\/components\/(ui\/(toast|stepper|tour|virtual-scroll|command|sortable|kanban|file-upload)\/|lib\/sortable-registry\.ts)/;

let page = 1;
const mine = [];
let total = 0;
for (;;) {
    const res = await api(
        `/api/issues/search?componentKeys=${encodeURIComponent(key)}&resolved=false&ps=500&p=${page}`
    );
    if (res.__error) { console.error('API error:', res.__error, res.body); process.exit(3); }
    total = res.total;
    for (const i of res.issues) {
        const c = i.component ?? '';
        if (/coverage[^/]*\//.test(c)) continue;
        if (mineRe.test(c)) mine.push(i);
    }
    if (page * 500 >= Math.min(total, 10000) || res.issues.length === 0) break;
    page++;
}

console.log(`project open issues: ${total}`);
console.log(`on MY changed paths: ${mine.length}`);
for (const i of mine) {
    console.log(`  ${i.severity}\t${i.rule}\t${i.component.split(':').pop()}:${i.line ?? '-'}\t${i.message}`);
}
