import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface CollapsibleDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  starredLabel: string;
  toggleSrText: string;
}

export const COLLAPSIBLE_DEMO_LOCALES: Record<string, CollapsibleDemoLocale> = {
  en: { code: 'en', heading: 'Collapsible', description: 'An expandable/collapsible component.', starredLabel: '@peduarte starred 3 repositories', toggleSrText: 'Toggle' },
  he: { code: 'he', rtl: true, heading: 'מתקפל', description: 'רכיב שניתן להרחבה/כיווץ.', starredLabel: '@peduarte הוסיף כוכב ל-3 מאגרים', toggleSrText: 'החלף' },
  ar: { code: 'ar', rtl: true, heading: 'قابل للطي', description: 'مكوّن قابل للتوسيع والطي.', starredLabel: 'وضع @peduarte نجمة على 3 مستودعات', toggleSrText: 'تبديل' },
  de: { code: 'de', heading: 'Ausklappbar', description: 'Ein aus-/einklappbares Element.', starredLabel: '@peduarte hat 3 Repositories mit Stern markiert', toggleSrText: 'Umschalten' },
  fr: { code: 'fr', heading: 'Réductible', description: 'Un composant extensible/réductible.', starredLabel: '@peduarte a mis une étoile à 3 dépôts', toggleSrText: 'Basculer' },
  es: { code: 'es', heading: 'Colapsable', description: 'Un componente expandible/colapsable.', starredLabel: '@peduarte destacó 3 repositorios', toggleSrText: 'Alternar' },
  ja: { code: 'ja', heading: '折りたたみ', description: '展開/折りたたみ可能なコンポーネント。', starredLabel: '@peduarte が 3 つのリポジトリにスターを付けました', toggleSrText: '切り替え' },
  zh: { code: 'zh', heading: '可折叠', description: '可展开/折叠的组件。', starredLabel: '@peduarte 为 3 个仓库加了星标', toggleSrText: '切换' },
  ru: { code: 'ru', heading: 'Сворачиваемый', description: 'Разворачиваемый/сворачиваемый компонент.', starredLabel: '@peduarte отметил 3 репозитория звёздочкой', toggleSrText: 'Переключить' },
  pt: { code: 'pt', heading: 'Recolhível', description: 'Um componente expansível/recolhível.', starredLabel: '@peduarte favoritou 3 repositórios', toggleSrText: 'Alternar' },
};
