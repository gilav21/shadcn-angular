import fs from 'fs-extra';
import path from 'path';
export function getDefaultConfig() {
    return {
        $schema: 'https://shadcn-angular.dev/schema.json',
        style: 'default',
        tailwind: {
            css: 'src/styles.scss',
            baseColor: 'neutral',
            cssVariables: true,
        },
        aliases: {
            components: '@/components',
            utils: '@/lib/utils',
            ui: '@/components/ui',
        },
        iconLibrary: 'lucide-angular',
    };
}
export async function getConfig(cwd) {
    const configPath = path.join(cwd, 'components.json');
    if (!await fs.pathExists(configPath)) {
        return null;
    }
    try {
        return await fs.readJson(configPath);
    }
    catch {
        return null;
    }
}
export async function writeConfig(cwd, config) {
    const configPath = path.join(cwd, 'components.json');
    await fs.writeJson(configPath, config, { spaces: 2 });
}
