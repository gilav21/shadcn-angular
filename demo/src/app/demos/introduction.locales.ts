// demo/src/app/demos/introduction.locales.ts
import type { LocaleMeta } from '../../../../packages/components/lib/i18n';

export interface IntroductionLocale extends LocaleMeta {
  heading: string;
  body: string;
}

export const INTRODUCTION_LOCALES: Record<string, IntroductionLocale> = {
  en: { code: 'en', heading: 'shadcn-angular', body: 'Select a component from the sidebar to explore demos and examples.' },
  he: { code: 'he', rtl: true, heading: 'shadcn-angular', body: 'בחרו רכיב מסרגל הצד כדי לצפות בדוגמאות ובדמואים.' },
  ar: { code: 'ar', rtl: true, heading: 'shadcn-angular', body: 'اختر مكونًا من الشريط الجانبي لاستعراض العروض التوضيحية والأمثلة.' },
  de: { code: 'de', heading: 'shadcn-angular', body: 'Wählen Sie eine Komponente aus der Seitenleiste, um Demos und Beispiele zu erkunden.' },
  fr: { code: 'fr', heading: 'shadcn-angular', body: 'Sélectionnez un composant dans la barre latérale pour explorer les démos et les exemples.' },
  es: { code: 'es', heading: 'shadcn-angular', body: 'Selecciona un componente de la barra lateral para explorar demos y ejemplos.' },
  ja: { code: 'ja', heading: 'shadcn-angular', body: 'サイドバーからコンポーネントを選んで、デモと使用例を確認できます。' },
  zh: { code: 'zh', heading: 'shadcn-angular', body: '从侧边栏选择一个组件，浏览演示和示例。' },
  ru: { code: 'ru', heading: 'shadcn-angular', body: 'Выберите компонент в боковой панели, чтобы изучить демонстрации и примеры.' },
  pt: { code: 'pt', heading: 'shadcn-angular', body: 'Selecione um componente na barra lateral para explorar demonstrações e exemplos.' },
};
