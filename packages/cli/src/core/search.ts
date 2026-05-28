import { registry, getComponentNames, levenshtein, type ComponentName } from '../registry/index.js';

export interface SearchHit {
    name: ComponentName;
    score: number;
    category?: string;
    description?: string;
}

/**
 * Rank registry components against a free-text query. Matches on name, tags,
 * and description; exact/substring name matches rank highest, then tag/
 * description substring, then fuzzy (Levenshtein) name proximity.
 */
export function searchComponents(query: string, limit = 20): SearchHit[] {
    const q = query.trim().toLowerCase();
    if (q === '') return [];
    const hits: SearchHit[] = [];

    for (const name of getComponentNames()) {
        const def = registry[name];
        const tags = (def.tags ?? []).join(' ').toLowerCase();
        const desc = (def.description ?? '').toLowerCase();
        const score = scoreComponent(q, name, tags, desc);
        if (score > 0) {
            hits.push({ name, score, category: def.category, description: def.description });
        }
    }

    hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return hits.slice(0, limit);
}

function scoreComponent(q: string, name: string, tags: string, desc: string): number {
    if (name === q) return 100;
    if (name.includes(q)) return 80;
    if (tags.includes(q)) return 60;
    if (desc.includes(q)) return 40;
    const dist = levenshtein(q, name);
    if (dist <= Math.max(2, Math.floor(q.length / 2))) return 30 - dist;
    return 0;
}
