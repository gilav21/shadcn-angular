interface AddOptions {
    yes?: boolean;
    overwrite?: boolean;
    all?: boolean;
    path?: string;
    remote?: boolean;
}
export declare function add(components: string[], options: AddOptions): Promise<void>;
export {};
