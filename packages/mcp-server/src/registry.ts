export interface ComponentDefinition {
  name: string;
  files: string[];
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

function classifyCategory(name: string, files: string[]): string {
  if (files.some(f => f.startsWith('charts/'))) return 'charts';
  if (files.some(f => f.startsWith('data-table/'))) return 'data-table';
  if (files.some(f => f.startsWith('page-builder/'))) return 'page-builder';

  const directives = ['confetti', 'component-outlet', 'input-mask'];
  if (directives.includes(name)) return 'directives';

  const formComponents = [
    'input', 'input-group', 'input-otp', 'textarea', 'checkbox', 'radio-group',
    'select', 'native-select', 'switch', 'slider', 'date-picker', 'calendar',
    'color-picker', 'file-upload', 'autocomplete', 'chip-list', 'rating',
    'tree-select', 'field', 'label',
  ];
  if (formComponents.includes(name)) return 'forms';

  const layoutComponents = [
    'card', 'separator', 'aspect-ratio', 'resizable', 'scroll-area',
    'sidebar', 'navigation-menu', 'breadcrumb', 'tabs', 'collapsible',
    'accordion', 'bento-grid', 'virtual-scroll',
  ];
  if (layoutComponents.includes(name)) return 'layout';

  const overlayComponents = [
    'dialog', 'alert-dialog', 'sheet', 'drawer', 'popover', 'tooltip',
    'hover-card', 'dropdown-menu', 'context-menu', 'menubar', 'command',
    'toast',
  ];
  if (overlayComponents.includes(name)) return 'overlay';

  const feedbackComponents = [
    'alert', 'progress', 'skeleton', 'spinner', 'empty',
  ];
  if (feedbackComponents.includes(name)) return 'feedback';

  const dataDisplayComponents = [
    'table', 'avatar', 'badge', 'icon', 'kbd', 'timeline',
    'stepper', 'tree', 'carousel', 'number-ticker', 'pagination',
  ];
  if (dataDisplayComponents.includes(name)) return 'data-display';

  const actionComponents = [
    'button', 'button-group', 'split-button', 'toggle', 'toggle-group',
    'speed-dial', 'dock',
  ];
  if (actionComponents.includes(name)) return 'actions';

  const aiComponents = ['chat', 'streaming-text', 'sparkles'];
  if (aiComponents.includes(name)) return 'ai';

  const editorComponents = ['rich-text-editor', 'code-block', 'text-reveal'];
  if (editorComponents.includes(name)) return 'editors';

  return 'general';
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
      category: classifyCategory(key, def.files),
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
