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
export declare function getDefaultConfig(): Config;
export declare function getConfig(cwd: string): Promise<Config | null>;
export declare function writeConfig(cwd: string, config: Config): Promise<void>;
