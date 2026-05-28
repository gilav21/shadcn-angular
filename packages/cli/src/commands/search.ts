import chalk from 'chalk';
import { searchComponents } from '../core/search.js';

interface SearchOptions {
    json?: boolean;
}

export function search(args: string[], options: SearchOptions): void {
    const query = args.join(' ').trim();
    if (query === '') {
        console.log(chalk.dim('Usage: shadcn-angular search <query>'));
        return;
    }

    const hits = searchComponents(query);

    if (options.json) {
        console.log(JSON.stringify(hits, null, 2));
        return;
    }

    if (hits.length === 0) {
        console.log(chalk.dim(`No matches for "${query}".`));
        return;
    }

    for (const hit of hits) {
        const cat = hit.category ? chalk.gray(`[${hit.category}] `) : '';
        console.log(chalk.cyan(hit.name.padEnd(24)) + cat + chalk.dim(hit.description ?? ''));
    }
}
