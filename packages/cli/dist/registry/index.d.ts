export interface ComponentDefinition {
    name: string;
    files: string[];
    dependencies?: string[];
}
export type ComponentName = keyof typeof registry;
export declare const registry: Record<string, ComponentDefinition>;
