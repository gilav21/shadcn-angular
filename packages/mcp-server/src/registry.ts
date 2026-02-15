export interface ComponentDefinition {
  name: string;
  files: string[];
  category?: string;
  dependencies?: string[];
  npmDependencies?: string[];
  shortcutDefinitions?: {
    exportName: string;
    componentName: string;
    sourceFile: string;
  }[];
}

export type ItemType = 'component' | 'directive' | 'service' | 'pipe' | 'types' | 'utility';

export interface RegistryItem extends ComponentDefinition {
  type: ItemType;
  category: string;
}

function classifyFile(file: string): ItemType {
  if (file.endsWith('.directive.ts')) return 'directive';
  if (file.endsWith('.service.ts')) return 'service';
  if (file.endsWith('.pipe.ts')) return 'pipe';
  if (file.endsWith('.types.ts')) return 'types';
  if (file.endsWith('.component.ts')) return 'component';
  return 'utility';
}

function detectPrimaryType(files: string[]): ItemType {
  const types = files.map(classifyFile);
  if (types.includes('component')) return 'component';
  if (types.includes('directive')) return 'directive';
  if (types.includes('service')) return 'service';
  if (types.includes('pipe')) return 'pipe';
  return 'utility';
}

export function buildRegistry(rawRegistry: Record<string, ComponentDefinition>): Map<string, RegistryItem> {
  const items = new Map<string, RegistryItem>();
  for (const [key, def] of Object.entries(rawRegistry)) {
    items.set(key, {
      ...def,
      type: detectPrimaryType(def.files),
      category: def.category ?? 'general',
    });
  }
  return items;
}

export function resolveTransitiveDependencies(
  name: string,
  registryMap: Map<string, RegistryItem>,
): string[] {
  const visited = new Set<string>();
  const queue = [name];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const item = registryMap.get(current);
    if (item?.dependencies) {
      for (const dep of item.dependencies) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  visited.delete(name);
  return Array.from(visited);
}
