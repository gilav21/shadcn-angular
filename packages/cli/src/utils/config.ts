import fs from 'fs-extra';
import path from 'path';

export interface Config {
    $schema: string;
    style: 'default';
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
    iconLibrary: string;
}

export function getDefaultConfig(): Config {
    return {
        $schema: 'https://shadcn-angular.dev/schema.json',
        style: 'default',
        tailwind: {
            css: 'src/styles.scss',
            baseColor: 'neutral',
            theme: 'zinc',
            cssVariables: true,
        },
        aliases: {
            components: '@/components',
            utils: '@/components/lib/utils',
            ui: '@/components/ui',
        },
        iconLibrary: 'lucide-angular',
    };
}

export async function getConfig(cwd: string): Promise<Config | null> {
    const configPath = path.join(cwd, 'components.json');

    if (!await fs.pathExists(configPath)) {
        return null;
    }

    try {
        return await fs.readJson(configPath);
    } catch {
        return null;
    }
}

export async function writeConfig(cwd: string, config: Config): Promise<void> {
    const configPath = path.join(cwd, 'components.json');
    await fs.writeJson(configPath, config, { spaces: 2 });
}
