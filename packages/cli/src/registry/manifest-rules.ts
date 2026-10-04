export interface ManifestViolation {
    readonly entry: string;
    readonly field: string;
    readonly value: string;
    readonly reason: string;
}

export function findManifestViolations(_data: Record<string, unknown>): ManifestViolation[] {
    return [];
}

export function isRegistryPackageSpec(_value: string): boolean {
    return true;
}
