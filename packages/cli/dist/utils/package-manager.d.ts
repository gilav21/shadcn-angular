export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export declare function getPackageManager(cwd: string): Promise<PackageManager>;
export declare function installPackages(packages: string[], options: {
    cwd: string;
    dev?: boolean;
}): Promise<void>;
