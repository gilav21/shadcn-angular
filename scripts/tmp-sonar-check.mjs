import { readFileSync } from 'node:fs';

/**
 * Sonar helper. Temporary tooling — deleted once the gate is closed.
 *
 * Reads the token from .env rather than the environment on purpose: the shell
 * profile exports a stale value that shadows the valid one.
 *
 *   node scripts/tmp-sonar-check.mjs validate
 *   node scripts/tmp-sonar-check.mjs status <projectKey>
 *   node scripts/tmp-sonar-check.mjs issues <projectKey>
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
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
    return res.json();
}

const [cmd, key = 'shadcn-angular-component-features'] = process.argv.slice(2);

if (cmd === 'validate') {
    console.log('token prefix:', token.slice(0, 4));
    console.log(JSON.stringify(await api('/api/authentication/validate')));
} else if (cmd === 'status') {
    const ce = await api(`/api/ce/component?component=${encodeURIComponent(key)}`);
    const current = ce.current ?? ce.queue?.[0] ?? null;
    console.log(current ? `${current.status} (${current.id})` : 'no analysis yet');
} else if (cmd === 'issues') {
    // Scoped to this bundle's own paths. The project's `**/coverage/**`
    // exclusion misses `coverage-*/`, so an unscoped query drowns in generated
    // lcov-report HTML that has nothing to do with these changes.
    const dirs = [
        'toast', 'stepper', 'tour', 'virtual-scroll', 'command',
        'sortable', 'kanban', 'file-upload',
    ].map(d => `packages/components/ui/${d}/**`);
    dirs.push('packages/components/lib/sortable-registry.ts');

    const params = new URLSearchParams({
        componentKeys: key,
        resolved: 'false',
        ps: '500',
        files: '',
    });
    params.delete('files');
    for (const d of dirs) params.append('componentKeys', key);

    const all = await api(
        `/api/issues/search?componentKeys=${encodeURIComponent(key)}&resolved=false&ps=500`
    );
    const mine = all.issues.filter(i => {
        const c = i.component ?? '';
        if (/coverage[^/]*\//.test(c)) return false;
        return dirs.some(d => c.includes(d.replace('/**', '')));
    });
    console.log(`total open: ${all.total}; mine: ${mine.length}`);
    for (const i of mine) {
        console.log(`${i.severity} ${i.rule} ${i.component.split(':').pop()}:${i.line ?? '-'} ${i.message}`);
    }
} else {
    console.error('usage: validate | status <key> | issues <key>');
    process.exit(1);
}
