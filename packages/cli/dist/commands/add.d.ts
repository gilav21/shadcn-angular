interface AddOptions {
    yes?: boolean;
    overwrite?: boolean;
    all?: boolean;
    path?: string;
}
export declare function add(components: string[], options: AddOptions): Promise<void>;
export {};
