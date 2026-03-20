import fs from 'fs-extra';
import path from 'node:path';

export interface Config {
    style: 'default';
    registry?: string;
    tailwind: {
        css: string;
        baseColor: 'neutral' | 'slate' | 'stone' | 'gray' | 'zinc';
        theme?: 'zinc' | 'slate' | 'stone' | 'gray' | 'neutral' | 'red' | 'rose' | 'orange' | 'green' | 'blue' | 'yellow' | 'violet' | 'amber';
        cssVariables: boolean;
    };
    aliases: {
        components: string;
        utils: string;
        ui: string;
    };
}

export function getDefaultConfig(): Config {
    return {
        style: 'default',
        tailwind: {
            css: 'src/styles.scss',
            baseColor: 'neutral',
            theme: 'zinc',
            cssVariables: true,
        },
        aliases: {
            components: '@/components',
            utils: '@/components/lib',
            ui: '@/components/ui',
        },
    };
}

function validateConfig(data: unknown): data is Config {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;

    if (!obj['tailwind'] || typeof obj['tailwind'] !== 'object') return false;
    const tw = obj['tailwind'] as Record<string, unknown>;
    if (typeof tw['css'] !== 'string' || typeof tw['baseColor'] !== 'string') return false;

    if (!obj['aliases'] || typeof obj['aliases'] !== 'object') return false;
    const aliases = obj['aliases'] as Record<string, unknown>;
    if (typeof aliases['components'] !== 'string' || typeof aliases['utils'] !== 'string' || typeof aliases['ui'] !== 'string') return false;

    return true;
}

export async function getConfig(cwd: string): Promise<Config | null> {
    const configPath = path.join(cwd, 'components.json');

    if (!await fs.pathExists(configPath)) {
        return null;
    }

    try {
        const data: unknown = await fs.readJson(configPath);
        if (!validateConfig(data)) {
            console.error('Error: components.json is missing required fields (tailwind.css, tailwind.baseColor, aliases.components, aliases.utils, aliases.ui).');
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

export async function writeConfig(cwd: string, config: Config): Promise<void> {
    const configPath = path.join(cwd, 'components.json');
    await fs.writeJson(configPath, config, { spaces: 2 });
}
