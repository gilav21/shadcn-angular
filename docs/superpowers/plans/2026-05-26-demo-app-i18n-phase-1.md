# Demo App i18n — Phase 1 (Pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pilot-localize 4 demo components + the shared app chrome (sidebar categories, introduction page) so a global locale switch flips every visible string on those pages — proving the pattern before parallel rollout to the remaining ~76 demos.

**Architecture:** Each demo gets a sibling `<name>-demo.locales.ts` exporting a typed locale dict for all 10 supported locales (`en he ar de fr es ja zh ru pt`). Demo components inject `UI_LOCALE_ID` directly and expose a `t` computed signal that returns the active locale's dict. Sample data (kanban cards/columns, table rows) moves into the locale dict so it flips with language. A shared `app.locales.ts` covers sidebar categories + intro copy. Smoke spec per demo asserts Hebrew renders under `provideUiLocale('he')`.

**Tech Stack:** Angular 21 signals, existing `packages/components/lib/i18n` infrastructure (`UI_LOCALE_ID`, `LocaleMeta`, `provideUiLocale`), Vitest + `@angular/core/testing`.

**Spec:** `specs/demo-app-i18n-spec.md`

---

## File Structure

**New files (locale dictionaries):**
- `demo/src/app/app.locales.ts` — sidebar categories, intro copy, header sr-only labels
- `demo/src/app/demos/introduction.locales.ts` — intro page strings
- `demo/src/app/demos/navigation/pagination-demo.locales.ts` — pagination demo strings
- `demo/src/app/demos/inputs/calendar-demo.locales.ts` — calendar demo strings (section headings)
- `demo/src/app/demos/patterns/kanban-demo.locales.ts` — kanban demo strings + sample columns/cards/assignees

**New files (smoke specs):**
- `demo/src/app/demos/introduction.component.spec.ts`
- `demo/src/app/demos/navigation/pagination-demo.component.spec.ts`
- `demo/src/app/demos/inputs/calendar-demo.component.spec.ts`
- `demo/src/app/demos/patterns/kanban-demo.component.spec.ts`

**Modified:**
- `demo/src/app/app.ts` + `demo/src/app/app.html` — bind sidebar category labels through `t()`; localize header sr-only labels
- `demo/src/app/demos/introduction.component.ts` — replace hardcoded strings with `t()`
- `demo/src/app/demos/navigation/pagination-demo.component.ts` — replace hardcoded h2/p/h3 with `t()`
- `demo/src/app/demos/inputs/calendar-demo.component.ts` — replace heading literals + remove hardcoded `locale="en|he|ja"` overrides on the "language showcase" row (those rows are kept, but their headings localize too)
- `demo/src/app/demos/patterns/kanban-demo.component.ts` + `.html` — consolidate the duplicate English/Hebrew boards into a single locale-driven board; the "Custom Mode" content-projection demo stays English (it shows the projection API)

**No other files touched.**

---

## Conventions Used in Every Task

**Demo component locale binding pattern (used identically in every demo):**

```ts
import { inject, computed } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CALENDAR_DEMO_LOCALES } from './calendar-demo.locales';

// Inside the @Component class:
private readonly localeId = inject(UI_LOCALE_ID);
protected readonly t = computed(
  () => CALENDAR_DEMO_LOCALES[this.localeId()] ?? CALENDAR_DEMO_LOCALES.en,
);
```

This is intentionally NOT `createLocaleBindings`. Demos always follow the
global locale — they don't accept a per-instance override, so the simpler
direct lookup is clearer than the input-driven helper.

**Locale dict shape (used identically in every locale file):**

```ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface <Name>DemoLocale extends LocaleMeta {
  title: string;
  description: string;
  // …field per visible string
}

export const <NAME>_DEMO_LOCALES: Record<string, <Name>DemoLocale> = {
  en: { code: 'en', /* … */ },
  he: { code: 'he', rtl: true, /* … */ },
  ar: { code: 'ar', rtl: true, /* … */ },
  de: { code: 'de', /* … */ },
  fr: { code: 'fr', /* … */ },
  es: { code: 'es', /* … */ },
  ja: { code: 'ja', /* … */ },
  zh: { code: 'zh', /* … */ },
  ru: { code: 'ru', /* … */ },
  pt: { code: 'pt', /* … */ },
};
```

**Smoke-spec pattern (used identically in every demo spec):**

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { <Name>DemoComponent } from './<name>-demo.component';
import { <NAME>_DEMO_LOCALES } from './<name>-demo.locales';

describe('<Name>DemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(<Name>DemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(<NAME>_DEMO_LOCALES.en.title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(<Name>DemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(<NAME>_DEMO_LOCALES.he.title);
    expect(fixture.nativeElement.textContent).not.toContain(<NAME>_DEMO_LOCALES.en.title);
  });
});
```

**Translation reference (used across every locale file in the pilot):**

| Concept | en | he | ar | de | fr | es | ja | zh | ru | pt |
|---|---|---|---|---|---|---|---|---|---|---|
| Generic "Title" | Title | כותרת | عنوان | Titel | Titre | Título | タイトル | 标题 | Заголовок | Título |
| "Description" | Description | תיאור | الوصف | Beschreibung | Description | Descripción | 説明 | 描述 | Описание | Descrição |
| "Backlog" (kanban) | Backlog | צבר | المتراكمة | Backlog | À traiter | Pendiente | バックログ | 待办 | Бэклог | Pendente |
| "To Do" | To Do | לביצוע | للتنفيذ | Zu erledigen | À faire | Por hacer | 未着手 | 待办 | К выполнению | A fazer |
| "In Progress" | In Progress | בתהליך | قيد التنفيذ | In Arbeit | En cours | En progreso | 進行中 | 进行中 | В работе | Em andamento |
| "Review" | Review | בבדיקה | قيد المراجعة | Prüfung | Revue | Revisión | レビュー | 审核中 | На проверке | Em revisão |
| "Done" | Done | הושלם | منجزة | Erledigt | Terminé | Hecho | 完了 | 已完成 | Готово | Concluído |
| Example name 1 | Alice | יעל | فاطمة | Anna | Aurélie | Carmen | 山田 | 王伟 | Анна | Ana |
| Example name 2 | Bob | דוד | محمد | Hans | Hugo | Carlos | 田中 | 李明 | Иван | Bruno |

Use this table for consistency across tasks 2-5.

---

## Task 1: Shared `app.locales.ts` + sidebar/intro wiring

**Files:**
- Create: `demo/src/app/app.locales.ts`
- Create: `demo/src/app/demos/introduction.locales.ts`
- Create: `demo/src/app/demos/introduction.component.spec.ts`
- Modify: `demo/src/app/app.ts` (add inject UI_LOCALE_ID, add `categoryLabel(c)` method, replace `currentLocaleLabel` source if needed)
- Modify: `demo/src/app/app.html:11` (bind sidebar group label through `categoryLabel`)
- Modify: `demo/src/app/demos/introduction.component.ts` (replace hardcoded strings with `t()`)

- [ ] **Step 1.1: Create `app.locales.ts` with sidebar categories + header sr-only labels**

```ts
// demo/src/app/app.locales.ts
import type { LocaleMeta } from '../../../packages/components/lib/i18n';

export interface AppLocale extends LocaleMeta {
  categories: {
    Inputs: string;
    Layout: string;
    Navigation: string;
    Overlay: string;
    'Data Display': string;
    Feedback: string;
    Charts: string;
    Animations: string;
    Patterns: string;
  };
  srOnly: {
    language: string;
    keyboardShortcuts: string;
    search: string;
  };
  modePlaceholder: string;
  languageMenuHeader: string;
}

export const APP_LOCALES: Record<string, AppLocale> = {
  en: {
    code: 'en',
    categories: { Inputs: 'Inputs', Layout: 'Layout', Navigation: 'Navigation', Overlay: 'Overlay', 'Data Display': 'Data Display', Feedback: 'Feedback', Charts: 'Charts', Animations: 'Animations', Patterns: 'Patterns' },
    srOnly: { language: 'Language', keyboardShortcuts: 'Keyboard Shortcuts', search: 'Search' },
    modePlaceholder: 'Mode',
    languageMenuHeader: 'Language',
  },
  he: {
    code: 'he', rtl: true,
    categories: { Inputs: 'קלט', Layout: 'פריסה', Navigation: 'ניווט', Overlay: 'שכבת על', 'Data Display': 'תצוגת נתונים', Feedback: 'משוב', Charts: 'תרשימים', Animations: 'אנימציות', Patterns: 'תבניות' },
    srOnly: { language: 'שפה', keyboardShortcuts: 'קיצורי מקלדת', search: 'חיפוש' },
    modePlaceholder: 'מצב',
    languageMenuHeader: 'שפה',
  },
  ar: {
    code: 'ar', rtl: true,
    categories: { Inputs: 'الإدخال', Layout: 'التخطيط', Navigation: 'التنقل', Overlay: 'طبقة فوقية', 'Data Display': 'عرض البيانات', Feedback: 'الملاحظات', Charts: 'المخططات', Animations: 'الرسوم المتحركة', Patterns: 'الأنماط' },
    srOnly: { language: 'اللغة', keyboardShortcuts: 'اختصارات لوحة المفاتيح', search: 'بحث' },
    modePlaceholder: 'الوضع',
    languageMenuHeader: 'اللغة',
  },
  de: {
    code: 'de',
    categories: { Inputs: 'Eingaben', Layout: 'Layout', Navigation: 'Navigation', Overlay: 'Overlay', 'Data Display': 'Datenanzeige', Feedback: 'Feedback', Charts: 'Diagramme', Animations: 'Animationen', Patterns: 'Muster' },
    srOnly: { language: 'Sprache', keyboardShortcuts: 'Tastenkürzel', search: 'Suche' },
    modePlaceholder: 'Modus',
    languageMenuHeader: 'Sprache',
  },
  fr: {
    code: 'fr',
    categories: { Inputs: 'Saisie', Layout: 'Mise en page', Navigation: 'Navigation', Overlay: 'Superposition', 'Data Display': 'Affichage des données', Feedback: 'Retour', Charts: 'Graphiques', Animations: 'Animations', Patterns: 'Modèles' },
    srOnly: { language: 'Langue', keyboardShortcuts: 'Raccourcis clavier', search: 'Recherche' },
    modePlaceholder: 'Mode',
    languageMenuHeader: 'Langue',
  },
  es: {
    code: 'es',
    categories: { Inputs: 'Entradas', Layout: 'Diseño', Navigation: 'Navegación', Overlay: 'Superposición', 'Data Display': 'Visualización de datos', Feedback: 'Comentarios', Charts: 'Gráficos', Animations: 'Animaciones', Patterns: 'Patrones' },
    srOnly: { language: 'Idioma', keyboardShortcuts: 'Atajos de teclado', search: 'Buscar' },
    modePlaceholder: 'Modo',
    languageMenuHeader: 'Idioma',
  },
  ja: {
    code: 'ja',
    categories: { Inputs: '入力', Layout: 'レイアウト', Navigation: 'ナビゲーション', Overlay: 'オーバーレイ', 'Data Display': 'データ表示', Feedback: 'フィードバック', Charts: 'チャート', Animations: 'アニメーション', Patterns: 'パターン' },
    srOnly: { language: '言語', keyboardShortcuts: 'キーボードショートカット', search: '検索' },
    modePlaceholder: 'モード',
    languageMenuHeader: '言語',
  },
  zh: {
    code: 'zh',
    categories: { Inputs: '输入', Layout: '布局', Navigation: '导航', Overlay: '浮层', 'Data Display': '数据展示', Feedback: '反馈', Charts: '图表', Animations: '动画', Patterns: '模式' },
    srOnly: { language: '语言', keyboardShortcuts: '键盘快捷键', search: '搜索' },
    modePlaceholder: '模式',
    languageMenuHeader: '语言',
  },
  ru: {
    code: 'ru',
    categories: { Inputs: 'Ввод', Layout: 'Макет', Navigation: 'Навигация', Overlay: 'Накладка', 'Data Display': 'Отображение данных', Feedback: 'Обратная связь', Charts: 'Диаграммы', Animations: 'Анимации', Patterns: 'Шаблоны' },
    srOnly: { language: 'Язык', keyboardShortcuts: 'Сочетания клавиш', search: 'Поиск' },
    modePlaceholder: 'Режим',
    languageMenuHeader: 'Язык',
  },
  pt: {
    code: 'pt',
    categories: { Inputs: 'Entradas', Layout: 'Layout', Navigation: 'Navegação', Overlay: 'Sobreposição', 'Data Display': 'Exibição de dados', Feedback: 'Feedback', Charts: 'Gráficos', Animations: 'Animações', Patterns: 'Padrões' },
    srOnly: { language: 'Idioma', keyboardShortcuts: 'Atalhos de teclado', search: 'Pesquisar' },
    modePlaceholder: 'Modo',
    languageMenuHeader: 'Idioma',
  },
};
```

- [ ] **Step 1.2: Create `introduction.locales.ts`**

```ts
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
```

- [ ] **Step 1.3: Rewrite `introduction.component.ts` to bind through `t()`**

```ts
// demo/src/app/demos/introduction.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../packages/components/lib/i18n';
import { INTRODUCTION_LOCALES } from './introduction.locales';

@Component({
  selector: 'app-introduction',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <h1 class="text-4xl font-bold mb-4">{{ t().heading }}</h1>
      <p class="text-muted-foreground text-lg max-w-md">{{ t().body }}</p>
    </div>
  `,
})
export class IntroductionComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => INTRODUCTION_LOCALES[this.localeId()] ?? INTRODUCTION_LOCALES.en,
  );
}
```

- [ ] **Step 1.4: Write the introduction smoke spec**

```ts
// demo/src/app/demos/introduction.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../packages/components/lib/i18n';
import { IntroductionComponent } from './introduction.component';
import { INTRODUCTION_LOCALES } from './introduction.locales';

describe('IntroductionComponent', () => {
  it('renders English body under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(IntroductionComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(INTRODUCTION_LOCALES.en.body);
  });

  it('renders Hebrew body under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(IntroductionComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(INTRODUCTION_LOCALES.he.body);
    expect(fixture.nativeElement.textContent).not.toContain(INTRODUCTION_LOCALES.en.body);
  });
});
```

- [ ] **Step 1.5: Run the introduction spec — expect PASS**

```bash
npm run test-visual -- --run demo/src/app/demos/introduction.component.spec.ts
```

Expected: 2 passing tests.

- [ ] **Step 1.6: Wire `AppComponent` to expose `t()` and a `categoryLabel(c)` helper**

In `demo/src/app/app.ts`, add these imports and properties on `AppComponent`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
// existing imports …
import { UI_LOCALE_ID } from '../../../packages/components/lib/i18n';
import { APP_LOCALES, type AppLocale } from './app.locales';

// inside AppComponent class, near the top of the class body:
private readonly localeId = inject(UI_LOCALE_ID);
protected readonly t = computed(
  () => APP_LOCALES[this.localeId()] ?? APP_LOCALES.en,
);

categoryLabel(category: string): string {
  const map = this.t().categories as Record<string, string>;
  return map[category] ?? category;
}
```

- [ ] **Step 1.7: Bind the sidebar group label through `categoryLabel()`**

Edit `demo/src/app/app.html` line 11:

```html
<ui-sidebar-group-label>{{ categoryLabel(category) }}</ui-sidebar-group-label>
```

And edit the header sr-only spans + the select placeholder (around lines 41-67):

```html
<ui-button variant="ghost" size="icon" class="hidden sm:inline-flex" (click)="showShortcutBindingsDialog.set(true)" (keydown.enter)="showShortcutBindingsDialog.set(true)">
  <span class="sr-only">{{ t().srOnly.keyboardShortcuts }}</span>
  <ui-icon name="keyboard" size="sm" />
</ui-button>
<ui-button variant="ghost" size="icon" (click)="showCommandDialog.set(true)" (keydown.enter)="showCommandDialog.set(true)">
  <span class="sr-only">{{ t().srOnly.search }}</span>
  <ui-icon name="search" size="sm" />
</ui-button>
```

```html
<ui-select-value [placeholder]="t().modePlaceholder" />
```

```html
<ui-dropdown-menu-trigger>
  <ui-button variant="ghost" size="icon" data-slot="locale-switcher" [attr.aria-label]="'Language: ' + currentLocaleLabel()">
    <span class="sr-only">{{ t().srOnly.language }}</span>
    <ui-icon name="languages" size="sm" />
  </ui-button>
</ui-dropdown-menu-trigger>
<ui-dropdown-menu-content align="end" class="w-44">
  <ui-dropdown-menu-label>{{ t().languageMenuHeader }}</ui-dropdown-menu-label>
```

- [ ] **Step 1.8: Build the demo to confirm zero TS / template errors**

```bash
cd demo && npx ng build
```

Expected: `Application bundle generation complete.` No template errors (the `lmdb` and `bundle initial exceeded` warnings are pre-existing and not introduced by this change).

- [ ] **Step 1.9: Visually verify in the running app**

The dev server is already running on port 4210 from earlier in this conversation. (If it's not, start it with `cd demo && npx ng serve --port 4210`.) Use Chrome MCP `javascript_tool` on `http://localhost:4210/`:

```js
const cmp = ng.getComponent(document.querySelector('app-root'));
cmp.setAppLocale('he');
await new Promise(r => setTimeout(r, 200));
const labels = Array.from(document.querySelectorAll('ui-sidebar-group-label')).map(e => e.textContent.trim());
const intro = document.querySelector('app-introduction p')?.textContent.trim();
JSON.stringify({ labels, intro });
```

Expected `labels` contains Hebrew strings (`קלט`, `פריסה`, …). Expected `intro` is the Hebrew body string. Then reset to English: `cmp.setAppLocale('en')`.

- [ ] **Step 1.10: Commit Task 1**

```bash
git add demo/src/app/app.locales.ts demo/src/app/demos/introduction.locales.ts \
        demo/src/app/demos/introduction.component.ts \
        demo/src/app/demos/introduction.component.spec.ts \
        demo/src/app/app.ts demo/src/app/app.html
git commit -m "$(cat <<'EOF'
demo i18n: Phase 1 Task 1 — sidebar categories + introduction page

Wire AppComponent to APP_LOCALES; sidebar group labels and header
sr-only / mode-placeholder strings now flip with UI_LOCALE_ID.
Introduction page binds heading/body through a co-located locale
file covering all 10 supported locales. Smoke spec asserts Hebrew
renders under provideUiLocale("he").

Refs: specs/demo-app-i18n-spec.md (Phase 1, pilot)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pagination demo

**Files:**
- Create: `demo/src/app/demos/navigation/pagination-demo.locales.ts`
- Create: `demo/src/app/demos/navigation/pagination-demo.component.spec.ts`
- Modify: `demo/src/app/demos/navigation/pagination-demo.component.ts`

- [ ] **Step 2.1: Create `pagination-demo.locales.ts`**

```ts
// demo/src/app/demos/navigation/pagination-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface PaginationDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  secondaryTitle: string;
  secondaryDescription: string;
  simpleHeading: string;
  simpleDescription: string;
}

export const PAGINATION_DEMO_LOCALES: Record<string, PaginationDemoLocale> = {
  en: { code: 'en',
    title: 'Pagination',
    description: 'Navigate through paged content.',
    secondaryTitle: 'Pagination',
    secondaryDescription: 'Pagination with page navigation, next and previous links.',
    simpleHeading: 'Simple Mode (Data-driven)',
    simpleDescription: 'Using totalPages and currentPage inputs.',
  },
  he: { code: 'he', rtl: true,
    title: 'דפדוף',
    description: 'ניווט בין דפים של תוכן.',
    secondaryTitle: 'דפדוף',
    secondaryDescription: 'דפדוף עם ניווט בין דפים, קישורי הבא והקודם.',
    simpleHeading: 'מצב פשוט (מבוסס נתונים)',
    simpleDescription: 'שימוש בקלטי totalPages ו-currentPage.',
  },
  ar: { code: 'ar', rtl: true,
    title: 'الترقيم',
    description: 'التنقل عبر المحتوى المُقسَّم لصفحات.',
    secondaryTitle: 'الترقيم',
    secondaryDescription: 'ترقيم مع التنقل بين الصفحات وروابط التالي والسابق.',
    simpleHeading: 'الوضع البسيط (مدفوع بالبيانات)',
    simpleDescription: 'باستخدام مدخلَي totalPages و currentPage.',
  },
  de: { code: 'de',
    title: 'Paginierung',
    description: 'Durch ausgelagerten Inhalt navigieren.',
    secondaryTitle: 'Paginierung',
    secondaryDescription: 'Paginierung mit Seitennavigation, Weiter- und Zurück-Links.',
    simpleHeading: 'Einfacher Modus (datengesteuert)',
    simpleDescription: 'Nutzt die Inputs totalPages und currentPage.',
  },
  fr: { code: 'fr',
    title: 'Pagination',
    description: 'Naviguez dans le contenu paginé.',
    secondaryTitle: 'Pagination',
    secondaryDescription: 'Pagination avec navigation de pages, liens suivant et précédent.',
    simpleHeading: 'Mode simple (basé sur les données)',
    simpleDescription: 'Utilise les entrées totalPages et currentPage.',
  },
  es: { code: 'es',
    title: 'Paginación',
    description: 'Navega a través del contenido paginado.',
    secondaryTitle: 'Paginación',
    secondaryDescription: 'Paginación con navegación de páginas y enlaces siguiente y anterior.',
    simpleHeading: 'Modo simple (basado en datos)',
    simpleDescription: 'Usa las entradas totalPages y currentPage.',
  },
  ja: { code: 'ja',
    title: 'ページネーション',
    description: 'ページ分割されたコンテンツを移動します。',
    secondaryTitle: 'ページネーション',
    secondaryDescription: 'ページ移動・前後リンク付きのページネーション。',
    simpleHeading: 'シンプルモード（データ駆動）',
    simpleDescription: 'totalPages と currentPage の入力を使用します。',
  },
  zh: { code: 'zh',
    title: '分页',
    description: '在分页内容中浏览。',
    secondaryTitle: '分页',
    secondaryDescription: '带页面导航以及上一页/下一页链接的分页。',
    simpleHeading: '简单模式（数据驱动）',
    simpleDescription: '使用 totalPages 和 currentPage 输入。',
  },
  ru: { code: 'ru',
    title: 'Пагинация',
    description: 'Навигация по постраничному содержимому.',
    secondaryTitle: 'Пагинация',
    secondaryDescription: 'Пагинация с навигацией по страницам и ссылками «следующая»/«предыдущая».',
    simpleHeading: 'Простой режим (управляемый данными)',
    simpleDescription: 'Использует входы totalPages и currentPage.',
  },
  pt: { code: 'pt',
    title: 'Paginação',
    description: 'Navegue por conteúdo paginado.',
    secondaryTitle: 'Paginação',
    secondaryDescription: 'Paginação com navegação de páginas e links anterior/próximo.',
    simpleHeading: 'Modo simples (orientado a dados)',
    simpleDescription: 'Usa as entradas totalPages e currentPage.',
  },
};
```

- [ ] **Step 2.2: Rewrite `pagination-demo.component.ts` to bind through `t()`**

```ts
// demo/src/app/demos/navigation/pagination-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  PaginationComponent,
  PaginationContentComponent,
  PaginationEllipsisComponent,
  PaginationItemComponent,
  PaginationLinkComponent,
  PaginationNextComponent,
  PaginationPreviousComponent,
} from '../../../../../packages/components/ui';
import { PAGINATION_DEMO_LOCALES } from './pagination-demo.locales';

@Component({
  selector: 'app-pagination-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PaginationComponent,
    PaginationContentComponent,
    PaginationItemComponent,
    PaginationLinkComponent,
    PaginationPreviousComponent,
    PaginationNextComponent,
    PaginationEllipsisComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="pagination" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-pagination>
        <ui-pagination-content>
          <ui-pagination-item><ui-pagination-previous /></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link [isActive]="true">1</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link>2</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link>3</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-ellipsis /></ui-pagination-item>
          <ui-pagination-item><ui-pagination-next /></ui-pagination-item>
        </ui-pagination-content>
      </ui-pagination>

      <h2 id="pagination-secondary" class="text-2xl font-semibold scroll-m-20 mt-12">{{ t().secondaryTitle }}</h2>
      <p class="text-muted-foreground">{{ t().secondaryDescription }}</p>

      <ui-pagination>
        <ui-pagination-content>
          <ui-pagination-item><ui-pagination-previous href="#" /></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link href="#">1</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link href="#" [isActive]="true">2</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-link href="#">3</ui-pagination-link></ui-pagination-item>
          <ui-pagination-item><ui-pagination-ellipsis /></ui-pagination-item>
          <ui-pagination-item><ui-pagination-next href="#" /></ui-pagination-item>
        </ui-pagination-content>
      </ui-pagination>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription }}</p>
      <ui-pagination [totalPages]="10" [currentPage]="1" />
    </section>
  `,
})
export class PaginationDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => PAGINATION_DEMO_LOCALES[this.localeId()] ?? PAGINATION_DEMO_LOCALES.en,
  );
}
```

- [ ] **Step 2.3: Write the pagination smoke spec**

```ts
// demo/src/app/demos/navigation/pagination-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { PaginationDemoComponent } from './pagination-demo.component';
import { PAGINATION_DEMO_LOCALES } from './pagination-demo.locales';

describe('PaginationDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(PaginationDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(PAGINATION_DEMO_LOCALES.en.simpleHeading);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(PaginationDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(PAGINATION_DEMO_LOCALES.he.simpleHeading);
    expect(fixture.nativeElement.textContent).not.toContain(PAGINATION_DEMO_LOCALES.en.simpleHeading);
  });
});
```

- [ ] **Step 2.4: Run the spec — expect PASS**

```bash
npm run test-visual -- --run demo/src/app/demos/navigation/pagination-demo.component.spec.ts
```

Expected: 2 passing tests.

- [ ] **Step 2.5: Verify in browser**

```js
const cmp = ng.getComponent(document.querySelector('app-root'));
cmp.navTo('pagination');
await new Promise(r => setTimeout(r, 400));
cmp.setAppLocale('fr');
await new Promise(r => setTimeout(r, 200));
JSON.stringify({
  h2: document.querySelector('#pagination')?.textContent.trim(),
  prev: document.querySelector('[data-slot="pagination-previous"]')?.textContent.trim(),
});
```

Expected: `h2` is `Pagination` (the French translation also reads "Pagination") and `prev` is `Précédent`. Switch to `he` and confirm `h2` is `דפדוף` and `prev` is `הקודם`. Reset to `en`.

- [ ] **Step 2.6: Commit Task 2**

```bash
git add demo/src/app/demos/navigation/pagination-demo.locales.ts \
        demo/src/app/demos/navigation/pagination-demo.component.ts \
        demo/src/app/demos/navigation/pagination-demo.component.spec.ts
git commit -m "$(cat <<'EOF'
demo i18n: Phase 1 Task 2 — pagination demo

Pagination demo's titles, descriptions, and section headings now
bind through a co-located locale file covering all 10 supported
locales. Library pagination internals (prev/next labels) already
localize via UI_LOCALE_ID — this task localizes the demo wrapper
around them.

Refs: specs/demo-app-i18n-spec.md (Phase 1, pilot)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Calendar demo

**Files:**
- Create: `demo/src/app/demos/inputs/calendar-demo.locales.ts`
- Create: `demo/src/app/demos/inputs/calendar-demo.component.spec.ts`
- Modify: `demo/src/app/demos/inputs/calendar-demo.component.ts`

The calendar demo has two row groups: the first row of calendars uses the global locale (no `locale=` attribute), the second row has hardcoded `locale="en|he|ja"` showcase calendars. **Keep the hardcoded showcase calendars** — they're an explicit demonstration of per-instance overrides and they're the page's value-add for translators. Localize only the surrounding chrome (h2, h3, p, and the `text-sm font-medium` row labels above the showcase calendars). The showcase row labels also localize.

- [ ] **Step 3.1: Create `calendar-demo.locales.ts`**

```ts
// demo/src/app/demos/inputs/calendar-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface CalendarDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  modes: {
    single: string;
    range: string;
    multi: string;
    withSelectors: string;
    dateTime: string;
    dateTimeRange: string;
    rangeWithTimeRange: string;
    startMonString: string;
  };
  showcase: {
    defaultEnglish: string;
    hebrewRtl: string;
    japanese: string;
  };
}

export const CALENDAR_DEMO_LOCALES: Record<string, CalendarDemoLocale> = {
  en: { code: 'en',
    title: 'Calendar',
    description: 'A date picker calendar component supporting single, range, and multi-selection modes.',
    modes: {
      single: 'Single Mode', range: 'Range Mode', multi: 'Multi Mode',
      withSelectors: 'With Selectors', dateTime: 'Date & Time',
      dateTimeRange: 'Date & Time Range', rangeWithTimeRange: 'Range with Time Range',
      startMonString: 'Start Mon (String)',
    },
    showcase: { defaultEnglish: 'Default (English)', hebrewRtl: 'Hebrew (RTL)', japanese: 'Japanese' },
  },
  he: { code: 'he', rtl: true,
    title: 'לוח שנה',
    description: 'רכיב לוח שנה לבחירת תאריך, תומך במצבי בחירה יחידה, טווח ובחירה מרובה.',
    modes: {
      single: 'מצב יחיד', range: 'מצב טווח', multi: 'מצב מרובה',
      withSelectors: 'עם בוררים', dateTime: 'תאריך ושעה',
      dateTimeRange: 'טווח תאריך ושעה', rangeWithTimeRange: 'טווח עם טווח שעות',
      startMonString: 'התחלה ביום שני (מחרוזת)',
    },
    showcase: { defaultEnglish: 'ברירת מחדל (אנגלית)', hebrewRtl: 'עברית (RTL)', japanese: 'יפנית' },
  },
  ar: { code: 'ar', rtl: true,
    title: 'التقويم',
    description: 'مكوّن تقويم لاختيار التاريخ يدعم وضع الاختيار الفردي والنطاق والاختيار المتعدد.',
    modes: {
      single: 'الوضع الفردي', range: 'وضع النطاق', multi: 'الوضع المتعدد',
      withSelectors: 'مع المحدِّدات', dateTime: 'التاريخ والوقت',
      dateTimeRange: 'نطاق التاريخ والوقت', rangeWithTimeRange: 'نطاق مع نطاق وقت',
      startMonString: 'البداية الإثنين (نص)',
    },
    showcase: { defaultEnglish: 'الافتراضي (الإنجليزية)', hebrewRtl: 'العبرية (RTL)', japanese: 'اليابانية' },
  },
  de: { code: 'de',
    title: 'Kalender',
    description: 'Eine Datumsauswahl-Komponente, die Einzel-, Bereichs- und Mehrfachauswahl unterstützt.',
    modes: {
      single: 'Einzelmodus', range: 'Bereichsmodus', multi: 'Mehrfachmodus',
      withSelectors: 'Mit Auswahlfeldern', dateTime: 'Datum & Uhrzeit',
      dateTimeRange: 'Datum & Zeitbereich', rangeWithTimeRange: 'Bereich mit Zeitbereich',
      startMonString: 'Beginn Montag (String)',
    },
    showcase: { defaultEnglish: 'Standard (Englisch)', hebrewRtl: 'Hebräisch (RTL)', japanese: 'Japanisch' },
  },
  fr: { code: 'fr',
    title: 'Calendrier',
    description: 'Un sélecteur de date prenant en charge les modes simple, plage et sélection multiple.',
    modes: {
      single: 'Mode simple', range: 'Mode plage', multi: 'Mode multiple',
      withSelectors: 'Avec sélecteurs', dateTime: 'Date et heure',
      dateTimeRange: 'Plage date et heure', rangeWithTimeRange: 'Plage avec plage horaire',
      startMonString: 'Début lundi (chaîne)',
    },
    showcase: { defaultEnglish: 'Par défaut (anglais)', hebrewRtl: 'Hébreu (RTL)', japanese: 'Japonais' },
  },
  es: { code: 'es',
    title: 'Calendario',
    description: 'Componente de calendario para seleccionar fechas, con modos único, rango y múltiple.',
    modes: {
      single: 'Modo único', range: 'Modo rango', multi: 'Modo múltiple',
      withSelectors: 'Con selectores', dateTime: 'Fecha y hora',
      dateTimeRange: 'Rango de fecha y hora', rangeWithTimeRange: 'Rango con rango de hora',
      startMonString: 'Inicio lunes (cadena)',
    },
    showcase: { defaultEnglish: 'Predeterminado (inglés)', hebrewRtl: 'Hebreo (RTL)', japanese: 'Japonés' },
  },
  ja: { code: 'ja',
    title: 'カレンダー',
    description: '単一・範囲・複数選択をサポートする日付選択コンポーネントです。',
    modes: {
      single: '単一モード', range: '範囲モード', multi: '複数モード',
      withSelectors: 'セレクター付き', dateTime: '日付と時刻',
      dateTimeRange: '日付と時刻の範囲', rangeWithTimeRange: '範囲＋時刻範囲',
      startMonString: '月曜開始（文字列）',
    },
    showcase: { defaultEnglish: 'デフォルト (英語)', hebrewRtl: 'ヘブライ語 (RTL)', japanese: '日本語' },
  },
  zh: { code: 'zh',
    title: '日历',
    description: '日期选择器组件，支持单选、区间和多选模式。',
    modes: {
      single: '单选模式', range: '区间模式', multi: '多选模式',
      withSelectors: '带选择器', dateTime: '日期和时间',
      dateTimeRange: '日期与时间区间', rangeWithTimeRange: '区间与时间区间',
      startMonString: '周一开始（字符串）',
    },
    showcase: { defaultEnglish: '默认（英语）', hebrewRtl: '希伯来语（RTL）', japanese: '日语' },
  },
  ru: { code: 'ru',
    title: 'Календарь',
    description: 'Компонент выбора даты с режимами одиночного, диапазонного и множественного выбора.',
    modes: {
      single: 'Одиночный режим', range: 'Диапазон', multi: 'Множественный режим',
      withSelectors: 'С селекторами', dateTime: 'Дата и время',
      dateTimeRange: 'Диапазон даты и времени', rangeWithTimeRange: 'Диапазон с диапазоном времени',
      startMonString: 'Начало с понедельника (строка)',
    },
    showcase: { defaultEnglish: 'По умолчанию (английский)', hebrewRtl: 'Иврит (RTL)', japanese: 'Японский' },
  },
  pt: { code: 'pt',
    title: 'Calendário',
    description: 'Componente de seleção de datas com modos único, intervalo e múltipla seleção.',
    modes: {
      single: 'Modo único', range: 'Modo intervalo', multi: 'Modo múltiplo',
      withSelectors: 'Com seletores', dateTime: 'Data e hora',
      dateTimeRange: 'Intervalo de data e hora', rangeWithTimeRange: 'Intervalo com intervalo de hora',
      startMonString: 'Início segunda (string)',
    },
    showcase: { defaultEnglish: 'Padrão (inglês)', hebrewRtl: 'Hebraico (RTL)', japanese: 'Japonês' },
  },
};
```

- [ ] **Step 3.2: Rewrite `calendar-demo.component.ts` to bind through `t()`**

```ts
// demo/src/app/demos/inputs/calendar-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CalendarComponent } from '../../../../../packages/components/ui';
import { CALENDAR_DEMO_LOCALES } from './calendar-demo.locales';

@Component({
  selector: 'app-calendar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent],
  template: `
    <section class="space-y-4">
      <h2 id="calendar" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-8">
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.single }}</h3>
          <ui-calendar mode="single" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.range }}</h3>
          <ui-calendar mode="range" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.multi }}</h3>
          <ui-calendar mode="multi" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.withSelectors }}</h3>
          <ui-calendar mode="single" [showMonthSelect]="true" [showYearSelect]="true" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.dateTime }}</h3>
          <ui-calendar mode="single" [showTimeSelect]="true" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.dateTimeRange }}</h3>
          <ui-calendar mode="single" [showTimeSelect]="true" timeMode="range" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.rangeWithTimeRange }}</h3>
          <ui-calendar mode="range" [showTimeSelect]="true" timeMode="range" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.startMonString }}</h3>
          <ui-calendar mode="single" [weekStartsOn]="1" selected="2024-01-01" class="rounded-md border shadow" />
        </div>
      </div>
      <div class="flex flex-wrap gap-6">
        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t().showcase.defaultEnglish }}</p>
          <ui-calendar locale="en" [showMonthSelect]="true" [showYearSelect]="true" class="rounded-md border shadow"></ui-calendar>
        </div>
        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t().showcase.hebrewRtl }}</p>
          <ui-calendar locale="he" [showMonthSelect]="true" [showYearSelect]="true" [showTimeSelect]="true" timeMode="range" class="rounded-md border shadow"></ui-calendar>
        </div>
        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t().showcase.japanese }}</p>
          <ui-calendar locale="ja" [showMonthSelect]="true" [showYearSelect]="true" class="rounded-md border shadow"></ui-calendar>
        </div>
      </div>
    </section>
  `,
})
export class CalendarDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => CALENDAR_DEMO_LOCALES[this.localeId()] ?? CALENDAR_DEMO_LOCALES.en,
  );
}
```

- [ ] **Step 3.3: Write the calendar smoke spec**

```ts
// demo/src/app/demos/inputs/calendar-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { CalendarDemoComponent } from './calendar-demo.component';
import { CALENDAR_DEMO_LOCALES } from './calendar-demo.locales';

describe('CalendarDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(CalendarDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CALENDAR_DEMO_LOCALES.en.title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(CalendarDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CALENDAR_DEMO_LOCALES.he.title);
  });
});
```

- [ ] **Step 3.4: Run the spec — expect PASS**

```bash
npm run test-visual -- --run demo/src/app/demos/inputs/calendar-demo.component.spec.ts
```

Expected: 2 passing tests.

- [ ] **Step 3.5: Verify in browser**

```js
const cmp = ng.getComponent(document.querySelector('app-root'));
cmp.navTo('calendar');
await new Promise(r => setTimeout(r, 400));
cmp.setAppLocale('de');
await new Promise(r => setTimeout(r, 200));
JSON.stringify({
  h2: document.querySelector('#calendar')?.textContent.trim(),
  modeHeadings: Array.from(document.querySelectorAll('h3.font-medium')).map(e=>e.textContent.trim()),
});
```

Expected: `h2` is `Kalender`, `modeHeadings` are German (`Einzelmodus`, `Bereichsmodus`, …). Reset to `en`.

- [ ] **Step 3.6: Commit Task 3**

```bash
git add demo/src/app/demos/inputs/calendar-demo.locales.ts \
        demo/src/app/demos/inputs/calendar-demo.component.ts \
        demo/src/app/demos/inputs/calendar-demo.component.spec.ts
git commit -m "$(cat <<'EOF'
demo i18n: Phase 1 Task 3 — calendar demo

Calendar demo's titles and section headings now bind through a
co-located locale file covering all 10 supported locales. The
showcase row's hardcoded per-instance locale overrides (en/he/ja
calendars) stay intentionally hardcoded — they demonstrate the
per-instance API.

Refs: specs/demo-app-i18n-spec.md (Phase 1, pilot)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Kanban demo (consolidate dual boards + localize sample data)

The current kanban demo ships two boards side-by-side: an English board and a hand-translated Hebrew board. After this task the page has **one** board whose columns, cards, and assignee names flip with the global locale. The "Custom Mode" content-projection section (`Design Tasks` / `Dev Tasks` with `Redesign homepage` etc.) stays English — it's a showcase of the projection API, not data, and rebuilding it under `t()` would obscure the projection pattern. (Follow-up note: revisit in Phase 2 if reviewer disagrees.)

**Files:**
- Create: `demo/src/app/demos/patterns/kanban-demo.locales.ts`
- Create: `demo/src/app/demos/patterns/kanban-demo.component.spec.ts`
- Modify: `demo/src/app/demos/patterns/kanban-demo.component.ts`
- Modify: `demo/src/app/demos/patterns/kanban-demo.component.html`

- [ ] **Step 4.1: Create `kanban-demo.locales.ts`**

The locale dict carries:
- Page chrome strings (title, description, section headings, the history-indicator labels)
- An array of columns: `{ id, title, wipLimit? }` — `id` stable across locales
- An array of cards: `{ id, columnId, title, description?, priority, order, labels?, assignees? }` — `id` and `columnId` stable across locales; titles/descriptions/labels translated; assignee names culturally localized
- An optional locale code to pass into `<ui-kanban [locale]="...">` so the **library** kanban's own UI (column-add button, card-edit dialog, etc.) localizes alongside

```ts
// demo/src/app/demos/patterns/kanban-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';
import type { KanbanColumn, KanbanCard } from '../../../../../packages/components/ui';

export interface KanbanDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  interactiveHeading: string;
  interactiveDescription: string;
  history: {
    label: string;
    undo: string;
    redo: string;
    available: string;
    empty: string;
  };
  customHeading: string;
  customDescription: string;
  columns: ReadonlyArray<KanbanColumn>;
  cards: ReadonlyArray<KanbanCard>;
}

const baseColumnTemplate: ReadonlyArray<Pick<KanbanColumn, 'id' | 'order' | 'wipLimit'>> = [
  { id: 'backlog', order: 0 },
  { id: 'todo', order: 1, wipLimit: 4 },
  { id: 'in-progress', order: 2, wipLimit: 3 },
  { id: 'review', order: 3, wipLimit: 2 },
  { id: 'done', order: 4 },
];

// columnTitles arrays line up index-for-index with baseColumnTemplate.
// Function helper keeps the per-locale dict compact.
function cols(titles: readonly [string, string, string, string, string]): ReadonlyArray<KanbanColumn> {
  return baseColumnTemplate.map((c, i) => ({ ...c, title: titles[i] }));
}

export const KANBAN_DEMO_LOCALES: Record<string, KanbanDemoLocale> = {
  en: { code: 'en',
    title: 'Kanban Board',
    description: 'A fully interactive Kanban board with drag-and-drop, context menus, card CRUD, column management, undo/redo, and toast notifications.',
    interactiveHeading: 'Interactive Board',
    interactiveDescription: 'Right-click cards, column headers, or the board background for context menus. Use Ctrl+Z / Ctrl+Shift+Z for undo/redo.',
    history: { label: 'History:', undo: 'Undo', redo: 'Redo', available: 'available', empty: 'empty' },
    customHeading: 'Custom Mode',
    customDescription: 'Use content projection for full control over column headers and card content.',
    columns: cols(['Backlog', 'To Do', 'In Progress', 'Review', 'Done']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: 'Research competitors', description: 'Analyze top 5 competitor products', priority: 'low', order: 0, labels: [{ text: 'Research', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: 'Design system audit', priority: 'medium', order: 1, labels: [{ text: 'Design', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: 'Implement auth flow', description: 'OAuth2 + JWT token refresh', priority: 'high', order: 0, labels: [{ text: 'Backend', color: '#f59e0b' }], assignees: [{ name: 'Alice' }, { name: 'Bob' }] },
      { id: 'k4', columnId: 'todo', title: 'Setup CI/CD pipeline', priority: 'medium', order: 1, labels: [{ text: 'DevOps', color: '#10b981' }], assignees: [{ name: 'Charlie' }] },
      { id: 'k5', columnId: 'in-progress', title: 'Build dashboard UI', description: 'Charts, tables, and KPI cards', priority: 'high', order: 0, labels: [{ text: 'Frontend', color: '#3b82f6' }], assignees: [{ name: 'Diana' }] },
      { id: 'k6', columnId: 'in-progress', title: 'API rate limiting', priority: 'urgent', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }, { text: 'Security', color: '#ef4444' }], assignees: [{ name: 'Eve' }] },
      { id: 'k7', columnId: 'review', title: 'User profile page', description: 'Avatar upload, settings, preferences', priority: 'medium', order: 0, assignees: [{ name: 'Frank' }, { name: 'Grace' }] },
      { id: 'k8', columnId: 'done', title: 'Project setup', priority: 'low', order: 0, labels: [{ text: 'DevOps', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: 'Database schema', priority: 'high', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }] },
    ],
  },
  he: { code: 'he', rtl: true,
    title: 'לוח קנבן',
    description: 'לוח קנבן אינטראקטיבי לחלוטין עם גרירה ושחרור, תפריטי הקשר, ניהול כרטיסים, ניהול עמודות, ביטול/שחזור והודעות.',
    interactiveHeading: 'לוח אינטראקטיבי',
    interactiveDescription: 'לחיצה ימנית על כרטיסים, כותרות עמודות או רקע הלוח פותחת תפריט הקשר. השתמשו ב-Ctrl+Z / Ctrl+Shift+Z לביטול/שחזור.',
    history: { label: 'היסטוריה:', undo: 'ביטול', redo: 'שחזור', available: 'זמין', empty: 'ריק' },
    customHeading: 'מצב מותאם',
    customDescription: 'שימוש בהקרנת תוכן לשליטה מלאה על כותרות עמודות ותוכן הכרטיסים.',
    columns: cols(['צבר משימות', 'לביצוע', 'בתהליך', 'בבדיקה', 'הושלם']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: 'מחקר מתחרים', description: 'ניתוח 5 מוצרי מתחרים מובילים', priority: 'low', order: 0, labels: [{ text: 'מחקר', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: 'בדיקת מערכת עיצוב', priority: 'medium', order: 1, labels: [{ text: 'עיצוב', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: 'מימוש זרימת אימות', description: 'OAuth2 + רענון טוקן JWT', priority: 'high', order: 0, labels: [{ text: 'צד שרת', color: '#f59e0b' }], assignees: [{ name: 'יעל' }, { name: 'דוד' }] },
      { id: 'k4', columnId: 'todo', title: 'הקמת צינור CI/CD', priority: 'medium', order: 1, labels: [{ text: 'תשתיות', color: '#10b981' }], assignees: [{ name: 'משה' }] },
      { id: 'k5', columnId: 'in-progress', title: 'בניית ממשק לוח בקרה', description: 'גרפים, טבלאות וכרטיסי KPI', priority: 'high', order: 0, labels: [{ text: 'צד לקוח', color: '#3b82f6' }], assignees: [{ name: 'שרה' }] },
      { id: 'k6', columnId: 'in-progress', title: 'הגבלת קצב API', priority: 'urgent', order: 1, labels: [{ text: 'צד שרת', color: '#f59e0b' }, { text: 'אבטחה', color: '#ef4444' }], assignees: [{ name: 'רחל' }] },
      { id: 'k7', columnId: 'review', title: 'דף פרופיל משתמש', description: 'העלאת תמונה, הגדרות, העדפות', priority: 'medium', order: 0, assignees: [{ name: 'אבי' }, { name: 'נועה' }] },
      { id: 'k8', columnId: 'done', title: 'הקמת פרויקט', priority: 'low', order: 0, labels: [{ text: 'תשתיות', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: 'סכמת בסיס נתונים', priority: 'high', order: 1, labels: [{ text: 'צד שרת', color: '#f59e0b' }] },
    ],
  },
  ar: { code: 'ar', rtl: true,
    title: 'لوحة كانبان',
    description: 'لوحة كانبان تفاعلية بالكامل مع السحب والإفلات، وقوائم السياق، وإدارة البطاقات، وإدارة الأعمدة، والتراجع/الإعادة، وإشعارات التوست.',
    interactiveHeading: 'لوحة تفاعلية',
    interactiveDescription: 'انقر بزر الفأرة الأيمن على البطاقات أو رؤوس الأعمدة أو خلفية اللوحة لفتح قوائم السياق. استخدم Ctrl+Z / Ctrl+Shift+Z للتراجع/الإعادة.',
    history: { label: 'السجل:', undo: 'تراجع', redo: 'إعادة', available: 'متاح', empty: 'فارغ' },
    customHeading: 'وضع مخصص',
    customDescription: 'استخدم إسقاط المحتوى للتحكم الكامل في رؤوس الأعمدة ومحتوى البطاقات.',
    columns: cols(['المتراكمة', 'للتنفيذ', 'قيد التنفيذ', 'قيد المراجعة', 'منجزة']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: 'بحث المنافسين', description: 'تحليل أفضل 5 منتجات منافسة', priority: 'low', order: 0, labels: [{ text: 'بحث', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: 'مراجعة نظام التصميم', priority: 'medium', order: 1, labels: [{ text: 'تصميم', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: 'تنفيذ تدفق المصادقة', description: 'OAuth2 + تجديد رمز JWT', priority: 'high', order: 0, labels: [{ text: 'الخادم', color: '#f59e0b' }], assignees: [{ name: 'فاطمة' }, { name: 'محمد' }] },
      { id: 'k4', columnId: 'todo', title: 'إعداد خط CI/CD', priority: 'medium', order: 1, labels: [{ text: 'العمليات', color: '#10b981' }], assignees: [{ name: 'علي' }] },
      { id: 'k5', columnId: 'in-progress', title: 'بناء واجهة لوحة التحكم', description: 'مخططات وجداول وبطاقات KPI', priority: 'high', order: 0, labels: [{ text: 'الواجهة', color: '#3b82f6' }], assignees: [{ name: 'سارة' }] },
      { id: 'k6', columnId: 'in-progress', title: 'تحديد معدل API', priority: 'urgent', order: 1, labels: [{ text: 'الخادم', color: '#f59e0b' }, { text: 'أمن', color: '#ef4444' }], assignees: [{ name: 'هدى' }] },
      { id: 'k7', columnId: 'review', title: 'صفحة الملف الشخصي', description: 'تحميل الصورة، الإعدادات، التفضيلات', priority: 'medium', order: 0, assignees: [{ name: 'كريم' }, { name: 'ليلى' }] },
      { id: 'k8', columnId: 'done', title: 'إعداد المشروع', priority: 'low', order: 0, labels: [{ text: 'العمليات', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: 'مخطط قاعدة البيانات', priority: 'high', order: 1, labels: [{ text: 'الخادم', color: '#f59e0b' }] },
    ],
  },
  de: { code: 'de',
    title: 'Kanban-Board',
    description: 'Ein vollständig interaktives Kanban-Board mit Drag-and-Drop, Kontextmenüs, Karten-CRUD, Spaltenverwaltung, Undo/Redo und Toast-Benachrichtigungen.',
    interactiveHeading: 'Interaktives Board',
    interactiveDescription: 'Rechtsklick auf Karten, Spaltenköpfe oder den Hintergrund öffnet das Kontextmenü. Strg+Z / Strg+Umschalt+Z für Undo/Redo.',
    history: { label: 'Verlauf:', undo: 'Rückgängig', redo: 'Wiederholen', available: 'verfügbar', empty: 'leer' },
    customHeading: 'Eigener Modus',
    customDescription: 'Inhaltsprojektion für volle Kontrolle über Spaltenköpfe und Karteninhalt.',
    columns: cols(['Backlog', 'Zu erledigen', 'In Arbeit', 'Prüfung', 'Erledigt']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: 'Wettbewerber recherchieren', description: 'Top-5-Konkurrenzprodukte analysieren', priority: 'low', order: 0, labels: [{ text: 'Recherche', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: 'Design-System-Audit', priority: 'medium', order: 1, labels: [{ text: 'Design', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: 'Auth-Flow implementieren', description: 'OAuth2 + JWT-Token-Refresh', priority: 'high', order: 0, labels: [{ text: 'Backend', color: '#f59e0b' }], assignees: [{ name: 'Anna' }, { name: 'Hans' }] },
      { id: 'k4', columnId: 'todo', title: 'CI/CD-Pipeline einrichten', priority: 'medium', order: 1, labels: [{ text: 'DevOps', color: '#10b981' }], assignees: [{ name: 'Lukas' }] },
      { id: 'k5', columnId: 'in-progress', title: 'Dashboard-UI bauen', description: 'Diagramme, Tabellen und KPI-Karten', priority: 'high', order: 0, labels: [{ text: 'Frontend', color: '#3b82f6' }], assignees: [{ name: 'Sophie' }] },
      { id: 'k6', columnId: 'in-progress', title: 'API-Ratenbegrenzung', priority: 'urgent', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }, { text: 'Sicherheit', color: '#ef4444' }], assignees: [{ name: 'Felix' }] },
      { id: 'k7', columnId: 'review', title: 'Benutzerprofil-Seite', description: 'Avatar-Upload, Einstellungen, Präferenzen', priority: 'medium', order: 0, assignees: [{ name: 'Jonas' }, { name: 'Mia' }] },
      { id: 'k8', columnId: 'done', title: 'Projekt-Setup', priority: 'low', order: 0, labels: [{ text: 'DevOps', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: 'Datenbank-Schema', priority: 'high', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }] },
    ],
  },
  fr: { code: 'fr',
    title: 'Tableau Kanban',
    description: 'Tableau Kanban entièrement interactif avec glisser-déposer, menus contextuels, CRUD de cartes, gestion de colonnes, annuler/rétablir et notifications toast.',
    interactiveHeading: 'Tableau interactif',
    interactiveDescription: 'Clic droit sur les cartes, en-têtes de colonnes ou l’arrière-plan pour les menus contextuels. Ctrl+Z / Ctrl+Maj+Z pour annuler/rétablir.',
    history: { label: 'Historique :', undo: 'Annuler', redo: 'Rétablir', available: 'disponible', empty: 'vide' },
    customHeading: 'Mode personnalisé',
    customDescription: 'Utilisez la projection de contenu pour contrôler entièrement les en-têtes de colonnes et le contenu des cartes.',
    columns: cols(['À traiter', 'À faire', 'En cours', 'Revue', 'Terminé']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: 'Rechercher les concurrents', description: 'Analyser les 5 principaux produits concurrents', priority: 'low', order: 0, labels: [{ text: 'Recherche', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: 'Audit du design system', priority: 'medium', order: 1, labels: [{ text: 'Design', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: 'Implémenter le flux d’authentification', description: 'OAuth2 + rafraîchissement du jeton JWT', priority: 'high', order: 0, labels: [{ text: 'Backend', color: '#f59e0b' }], assignees: [{ name: 'Aurélie' }, { name: 'Hugo' }] },
      { id: 'k4', columnId: 'todo', title: 'Mettre en place le pipeline CI/CD', priority: 'medium', order: 1, labels: [{ text: 'DevOps', color: '#10b981' }], assignees: [{ name: 'Mathis' }] },
      { id: 'k5', columnId: 'in-progress', title: 'Construire l’UI du tableau de bord', description: 'Graphiques, tableaux et cartes KPI', priority: 'high', order: 0, labels: [{ text: 'Frontend', color: '#3b82f6' }], assignees: [{ name: 'Camille' }] },
      { id: 'k6', columnId: 'in-progress', title: 'Limitation de débit de l’API', priority: 'urgent', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }, { text: 'Sécurité', color: '#ef4444' }], assignees: [{ name: 'Léa' }] },
      { id: 'k7', columnId: 'review', title: 'Page de profil utilisateur', description: 'Avatar, paramètres, préférences', priority: 'medium', order: 0, assignees: [{ name: 'Lucas' }, { name: 'Manon' }] },
      { id: 'k8', columnId: 'done', title: 'Configuration du projet', priority: 'low', order: 0, labels: [{ text: 'DevOps', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: 'Schéma de base de données', priority: 'high', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }] },
    ],
  },
  es: { code: 'es',
    title: 'Tablero Kanban',
    description: 'Tablero Kanban totalmente interactivo con arrastrar y soltar, menús contextuales, CRUD de tarjetas, gestión de columnas, deshacer/rehacer y notificaciones toast.',
    interactiveHeading: 'Tablero interactivo',
    interactiveDescription: 'Clic derecho en tarjetas, encabezados de columnas o el fondo para abrir los menús contextuales. Ctrl+Z / Ctrl+Mayús+Z para deshacer/rehacer.',
    history: { label: 'Historial:', undo: 'Deshacer', redo: 'Rehacer', available: 'disponible', empty: 'vacío' },
    customHeading: 'Modo personalizado',
    customDescription: 'Usa la proyección de contenido para tener control total sobre los encabezados de columna y el contenido de las tarjetas.',
    columns: cols(['Pendiente', 'Por hacer', 'En progreso', 'Revisión', 'Hecho']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: 'Investigar competidores', description: 'Analizar los 5 productos competidores principales', priority: 'low', order: 0, labels: [{ text: 'Investigación', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: 'Auditoría del sistema de diseño', priority: 'medium', order: 1, labels: [{ text: 'Diseño', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: 'Implementar flujo de autenticación', description: 'OAuth2 + refresco de token JWT', priority: 'high', order: 0, labels: [{ text: 'Backend', color: '#f59e0b' }], assignees: [{ name: 'Carmen' }, { name: 'Carlos' }] },
      { id: 'k4', columnId: 'todo', title: 'Configurar pipeline CI/CD', priority: 'medium', order: 1, labels: [{ text: 'DevOps', color: '#10b981' }], assignees: [{ name: 'Diego' }] },
      { id: 'k5', columnId: 'in-progress', title: 'Construir UI del panel', description: 'Gráficos, tablas y tarjetas KPI', priority: 'high', order: 0, labels: [{ text: 'Frontend', color: '#3b82f6' }], assignees: [{ name: 'Lucía' }] },
      { id: 'k6', columnId: 'in-progress', title: 'Limitación de tasa de la API', priority: 'urgent', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }, { text: 'Seguridad', color: '#ef4444' }], assignees: [{ name: 'Sofía' }] },
      { id: 'k7', columnId: 'review', title: 'Página de perfil de usuario', description: 'Subida de avatar, ajustes, preferencias', priority: 'medium', order: 0, assignees: [{ name: 'Javier' }, { name: 'Elena' }] },
      { id: 'k8', columnId: 'done', title: 'Configuración del proyecto', priority: 'low', order: 0, labels: [{ text: 'DevOps', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: 'Esquema de base de datos', priority: 'high', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }] },
    ],
  },
  ja: { code: 'ja',
    title: 'カンバンボード',
    description: 'ドラッグ＆ドロップ、コンテキストメニュー、カードCRUD、列管理、元に戻す/やり直し、トースト通知に対応した完全インタラクティブなカンバンボード。',
    interactiveHeading: 'インタラクティブボード',
    interactiveDescription: 'カード・列ヘッダー・ボード背景を右クリックでコンテキストメニュー。Ctrl+Z / Ctrl+Shift+Z で元に戻す／やり直し。',
    history: { label: '履歴：', undo: '元に戻す', redo: 'やり直し', available: '利用可能', empty: '空' },
    customHeading: 'カスタムモード',
    customDescription: 'コンテンツプロジェクションで列ヘッダーとカード内容を完全に制御できます。',
    columns: cols(['バックログ', '未着手', '進行中', 'レビュー', '完了']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: '競合調査', description: '主要競合プロダクト5社を分析', priority: 'low', order: 0, labels: [{ text: '調査', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: 'デザインシステム監査', priority: 'medium', order: 1, labels: [{ text: 'デザイン', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: '認証フロー実装', description: 'OAuth2 + JWT トークン更新', priority: 'high', order: 0, labels: [{ text: 'バックエンド', color: '#f59e0b' }], assignees: [{ name: '山田' }, { name: '田中' }] },
      { id: 'k4', columnId: 'todo', title: 'CI/CD パイプライン構築', priority: 'medium', order: 1, labels: [{ text: 'DevOps', color: '#10b981' }], assignees: [{ name: '佐藤' }] },
      { id: 'k5', columnId: 'in-progress', title: 'ダッシュボードUI構築', description: 'チャート・テーブル・KPI カード', priority: 'high', order: 0, labels: [{ text: 'フロントエンド', color: '#3b82f6' }], assignees: [{ name: '鈴木' }] },
      { id: 'k6', columnId: 'in-progress', title: 'API レート制限', priority: 'urgent', order: 1, labels: [{ text: 'バックエンド', color: '#f59e0b' }, { text: 'セキュリティ', color: '#ef4444' }], assignees: [{ name: '高橋' }] },
      { id: 'k7', columnId: 'review', title: 'ユーザープロファイル画面', description: 'アバターアップロード・設定・環境設定', priority: 'medium', order: 0, assignees: [{ name: '伊藤' }, { name: '渡辺' }] },
      { id: 'k8', columnId: 'done', title: 'プロジェクト初期設定', priority: 'low', order: 0, labels: [{ text: 'DevOps', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: 'DBスキーマ', priority: 'high', order: 1, labels: [{ text: 'バックエンド', color: '#f59e0b' }] },
    ],
  },
  zh: { code: 'zh',
    title: '看板',
    description: '功能完整的交互式看板，支持拖放、上下文菜单、卡片增删改查、列管理、撤销/重做和提示通知。',
    interactiveHeading: '交互看板',
    interactiveDescription: '在卡片、列头或看板背景上右键打开上下文菜单。使用 Ctrl+Z / Ctrl+Shift+Z 进行撤销/重做。',
    history: { label: '历史：', undo: '撤销', redo: '重做', available: '可用', empty: '空' },
    customHeading: '自定义模式',
    customDescription: '使用内容投影完全控制列头与卡片内容。',
    columns: cols(['待办', '待开始', '进行中', '审核中', '已完成']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: '竞品研究', description: '分析前 5 名竞品', priority: 'low', order: 0, labels: [{ text: '研究', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: '设计系统审计', priority: 'medium', order: 1, labels: [{ text: '设计', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: '实现认证流程', description: 'OAuth2 + JWT 令牌刷新', priority: 'high', order: 0, labels: [{ text: '后端', color: '#f59e0b' }], assignees: [{ name: '王伟' }, { name: '李明' }] },
      { id: 'k4', columnId: 'todo', title: '搭建 CI/CD 流水线', priority: 'medium', order: 1, labels: [{ text: '运维', color: '#10b981' }], assignees: [{ name: '张磊' }] },
      { id: 'k5', columnId: 'in-progress', title: '搭建仪表盘 UI', description: '图表、表格与 KPI 卡片', priority: 'high', order: 0, labels: [{ text: '前端', color: '#3b82f6' }], assignees: [{ name: '刘洋' }] },
      { id: 'k6', columnId: 'in-progress', title: 'API 限流', priority: 'urgent', order: 1, labels: [{ text: '后端', color: '#f59e0b' }, { text: '安全', color: '#ef4444' }], assignees: [{ name: '陈静' }] },
      { id: 'k7', columnId: 'review', title: '用户资料页', description: '头像上传、设置、偏好', priority: 'medium', order: 0, assignees: [{ name: '杨帆' }, { name: '吴敏' }] },
      { id: 'k8', columnId: 'done', title: '项目初始化', priority: 'low', order: 0, labels: [{ text: '运维', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: '数据库模型', priority: 'high', order: 1, labels: [{ text: '后端', color: '#f59e0b' }] },
    ],
  },
  ru: { code: 'ru',
    title: 'Канбан-доска',
    description: 'Полностью интерактивная Канбан-доска с перетаскиванием, контекстными меню, CRUD карточек, управлением колонками, отменой/повтором и тост-уведомлениями.',
    interactiveHeading: 'Интерактивная доска',
    interactiveDescription: 'Правый клик по карточкам, заголовкам колонок или фону доски открывает контекстное меню. Ctrl+Z / Ctrl+Shift+Z для отмены/повтора.',
    history: { label: 'История:', undo: 'Отмена', redo: 'Повтор', available: 'доступно', empty: 'пусто' },
    customHeading: 'Пользовательский режим',
    customDescription: 'Проекция содержимого даёт полный контроль над заголовками колонок и содержимым карточек.',
    columns: cols(['Бэклог', 'К выполнению', 'В работе', 'На проверке', 'Готово']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: 'Исследование конкурентов', description: 'Анализ 5 ведущих продуктов конкурентов', priority: 'low', order: 0, labels: [{ text: 'Исследование', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: 'Аудит дизайн-системы', priority: 'medium', order: 1, labels: [{ text: 'Дизайн', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: 'Реализация авторизации', description: 'OAuth2 + обновление JWT-токена', priority: 'high', order: 0, labels: [{ text: 'Бэкенд', color: '#f59e0b' }], assignees: [{ name: 'Анна' }, { name: 'Иван' }] },
      { id: 'k4', columnId: 'todo', title: 'Настройка CI/CD', priority: 'medium', order: 1, labels: [{ text: 'DevOps', color: '#10b981' }], assignees: [{ name: 'Дмитрий' }] },
      { id: 'k5', columnId: 'in-progress', title: 'UI дашборда', description: 'Графики, таблицы и KPI-карточки', priority: 'high', order: 0, labels: [{ text: 'Фронтенд', color: '#3b82f6' }], assignees: [{ name: 'Мария' }] },
      { id: 'k6', columnId: 'in-progress', title: 'Ограничение частоты API', priority: 'urgent', order: 1, labels: [{ text: 'Бэкенд', color: '#f59e0b' }, { text: 'Безопасность', color: '#ef4444' }], assignees: [{ name: 'Ольга' }] },
      { id: 'k7', columnId: 'review', title: 'Страница профиля', description: 'Загрузка аватара, настройки, предпочтения', priority: 'medium', order: 0, assignees: [{ name: 'Сергей' }, { name: 'Елена' }] },
      { id: 'k8', columnId: 'done', title: 'Инициализация проекта', priority: 'low', order: 0, labels: [{ text: 'DevOps', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: 'Схема БД', priority: 'high', order: 1, labels: [{ text: 'Бэкенд', color: '#f59e0b' }] },
    ],
  },
  pt: { code: 'pt',
    title: 'Quadro Kanban',
    description: 'Quadro Kanban totalmente interativo com arrastar-e-soltar, menus de contexto, CRUD de cartões, gestão de colunas, desfazer/refazer e notificações toast.',
    interactiveHeading: 'Quadro interativo',
    interactiveDescription: 'Clique com o botão direito em cartões, cabeçalhos de coluna ou no fundo do quadro para abrir os menus de contexto. Use Ctrl+Z / Ctrl+Shift+Z para desfazer/refazer.',
    history: { label: 'Histórico:', undo: 'Desfazer', redo: 'Refazer', available: 'disponível', empty: 'vazio' },
    customHeading: 'Modo personalizado',
    customDescription: 'Use projeção de conteúdo para controle total sobre cabeçalhos de coluna e conteúdo dos cartões.',
    columns: cols(['Pendente', 'A fazer', 'Em andamento', 'Em revisão', 'Concluído']),
    cards: [
      { id: 'k1', columnId: 'backlog', title: 'Pesquisar concorrentes', description: 'Analisar os 5 principais produtos concorrentes', priority: 'low', order: 0, labels: [{ text: 'Pesquisa', color: '#6366f1' }] },
      { id: 'k2', columnId: 'backlog', title: 'Auditoria do design system', priority: 'medium', order: 1, labels: [{ text: 'Design', color: '#ec4899' }] },
      { id: 'k3', columnId: 'todo', title: 'Implementar fluxo de autenticação', description: 'OAuth2 + atualização de token JWT', priority: 'high', order: 0, labels: [{ text: 'Backend', color: '#f59e0b' }], assignees: [{ name: 'Ana' }, { name: 'Bruno' }] },
      { id: 'k4', columnId: 'todo', title: 'Configurar pipeline CI/CD', priority: 'medium', order: 1, labels: [{ text: 'DevOps', color: '#10b981' }], assignees: [{ name: 'Carlos' }] },
      { id: 'k5', columnId: 'in-progress', title: 'Construir UI do painel', description: 'Gráficos, tabelas e cartões KPI', priority: 'high', order: 0, labels: [{ text: 'Frontend', color: '#3b82f6' }], assignees: [{ name: 'Beatriz' }] },
      { id: 'k6', columnId: 'in-progress', title: 'Limitação de taxa da API', priority: 'urgent', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }, { text: 'Segurança', color: '#ef4444' }], assignees: [{ name: 'Sofia' }] },
      { id: 'k7', columnId: 'review', title: 'Página de perfil', description: 'Envio de avatar, ajustes, preferências', priority: 'medium', order: 0, assignees: [{ name: 'Pedro' }, { name: 'Mariana' }] },
      { id: 'k8', columnId: 'done', title: 'Configuração do projeto', priority: 'low', order: 0, labels: [{ text: 'DevOps', color: '#10b981' }] },
      { id: 'k9', columnId: 'done', title: 'Esquema do banco', priority: 'high', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }] },
    ],
  },
};
```

- [ ] **Step 4.2: Rewrite the kanban demo component to use `t()` and drop the hardcoded Hebrew board**

Replace `demo/src/app/demos/patterns/kanban-demo.component.ts` entirely:

```ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  BadgeComponent,
  SeparatorComponent,
  KanbanComponent,
  KanbanColumnComponent,
  KanbanCardComponent,
  KanbanColumnHeaderComponent,
  KanbanCardContentComponent,
  KanbanColumn,
  KanbanCard,
  KanbanCardAddEvent,
  KanbanColumnDeleteEvent,
  KanbanHistoryState,
} from '../../../../../packages/components/ui';
import { KANBAN_DEMO_LOCALES } from './kanban-demo.locales';

@Component({
  selector: 'app-kanban-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    SeparatorComponent,
    KanbanComponent,
    KanbanColumnComponent,
    KanbanCardComponent,
    KanbanColumnHeaderComponent,
    KanbanCardContentComponent,
  ],
  templateUrl: './kanban-demo.component.html',
})
export class KanbanDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => KANBAN_DEMO_LOCALES[this.localeId()] ?? KANBAN_DEMO_LOCALES.en,
  );

  // Local mutable state seeded from the active locale. A locale change reseeds
  // it via an effect so user reordering survives in-language and is replaced
  // when the language flips (which also localizes the sample data).
  readonly kanbanColumns = signal<KanbanColumn[]>([...this.t().columns]);
  readonly kanbanCards = signal<KanbanCard[]>([...this.t().cards]);
  readonly kanbanHistory = signal<KanbanHistoryState>({ canUndo: false, canRedo: false });
  private kanbanCardIdCounter = 100;

  constructor() {
    // Reseed state whenever the locale's sample data flips.
    let prev = this.t();
    effect(() => {
      const next = this.t();
      if (next !== prev) {
        this.kanbanColumns.set([...next.columns]);
        this.kanbanCards.set([...next.cards]);
        prev = next;
      }
    });
  }

  onKanbanCardsChange(cards: KanbanCard[]) { this.kanbanCards.set(cards); }
  onKanbanColumnsChange(columns: KanbanColumn[]) { this.kanbanColumns.set(columns); }

  onKanbanCardAdded(event: KanbanCardAddEvent) {
    const newCard: KanbanCard = {
      id: `k-${++this.kanbanCardIdCounter}`,
      columnId: event.columnId,
      title: event.title,
      description: event.description,
      priority: event.priority,
      labels: event.labels,
      assignees: event.assignees,
      order: this.kanbanCards().filter(c => c.columnId === event.columnId).length,
    };
    this.kanbanCards.set([...this.kanbanCards(), newCard]);
  }

  onKanbanCardUpdated(card: KanbanCard) {
    this.kanbanCards.set(this.kanbanCards().map(c => c.id === card.id ? card : c));
  }

  onKanbanCardDeleted(cardId: string) {
    this.kanbanCards.set(this.kanbanCards().filter(c => c.id !== cardId));
  }

  onKanbanColumnAdded(col: Omit<KanbanColumn, 'id'>) {
    const newCol: KanbanColumn = { ...col, id: `col-${Date.now()}` };
    this.kanbanColumns.set([...this.kanbanColumns(), newCol]);
  }

  onKanbanColumnUpdated(col: KanbanColumn) {
    this.kanbanColumns.set(this.kanbanColumns().map(c => c.id === col.id ? col : c));
  }

  onKanbanColumnDeleted(event: KanbanColumnDeleteEvent) {
    if (event.moveCardsTo) {
      this.kanbanCards.set(
        this.kanbanCards().map(c =>
          c.columnId === event.columnId ? { ...c, columnId: event.moveCardsTo! } : c
        )
      );
    } else {
      this.kanbanCards.set(this.kanbanCards().filter(c => c.columnId !== event.columnId));
    }
    this.kanbanColumns.set(this.kanbanColumns().filter(c => c.id !== event.columnId));
  }

  onKanbanHistoryChange(state: KanbanHistoryState) { this.kanbanHistory.set(state); }
}
```

Note: `effect({ allowSignalWrites: true })` is required because the locale-change handler writes signals (`kanbanColumns.set` / `kanbanCards.set`) from inside the effect. Angular 21 supports this flag explicitly for this kind of reseed.

- [ ] **Step 4.3: Replace `kanban-demo.component.html` with a localized single-board template**

```html
<section class="space-y-8">
  <div>
    <h2 id="kanban" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
    <p class="text-muted-foreground mt-1">{{ t().description }}</p>
  </div>

  <div class="space-y-4">
    <h3 class="text-lg font-medium">{{ t().interactiveHeading }}</h3>
    <p class="text-muted-foreground text-sm">{{ t().interactiveDescription }}</p>
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{{ t().history.label }}</span>
      <span [class]="kanbanHistory().canUndo ? 'text-foreground font-medium' : ''">
        {{ t().history.undo }} {{ kanbanHistory().canUndo ? t().history.available : t().history.empty }}
      </span>
      <span>|</span>
      <span [class]="kanbanHistory().canRedo ? 'text-foreground font-medium' : ''">
        {{ t().history.redo }} {{ kanbanHistory().canRedo ? t().history.available : t().history.empty }}
      </span>
    </div>
    <ui-kanban
      [locale]="t().code"
      [columns]="kanbanColumns()"
      [cards]="kanbanCards()"
      (cardsChange)="onKanbanCardsChange($event)"
      (columnsChange)="onKanbanColumnsChange($event)"
      (cardAdded)="onKanbanCardAdded($event)"
      (cardUpdated)="onKanbanCardUpdated($event)"
      (cardDeleted)="onKanbanCardDeleted($event)"
      (columnAdded)="onKanbanColumnAdded($event)"
      (columnUpdated)="onKanbanColumnUpdated($event)"
      (columnDeleted)="onKanbanColumnDeleted($event)"
      (historyChange)="onKanbanHistoryChange($event)" />
  </div>

  <ui-separator />

  <div class="space-y-4">
    <h3 class="text-lg font-medium">{{ t().customHeading }}</h3>
    <p class="text-muted-foreground text-sm">{{ t().customDescription }}</p>
    <ui-kanban>
      <ui-kanban-column columnId="design" title="Design">
        <ui-kanban-column-header>
          <div class="flex items-center gap-2 p-3">
            <span class="text-lg">🎨</span>
            <h3 class="text-sm font-semibold">Design Tasks</h3>
            <ui-badge label="2" variant="secondary" class="text-xs" />
          </div>
        </ui-kanban-column-header>
        <ui-kanban-card cardId="c1">
          <ui-kanban-card-content>
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded bg-pink-100 flex items-center justify-center text-pink-600">🖌️</div>
              <div>
                <p class="text-sm font-medium">Redesign homepage</p>
                <p class="text-xs text-muted-foreground">Due in 3 days</p>
              </div>
            </div>
          </ui-kanban-card-content>
        </ui-kanban-card>
        <ui-kanban-card cardId="c2">
          <ui-kanban-card-content>
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded bg-purple-100 flex items-center justify-center text-purple-600">📐</div>
              <div>
                <p class="text-sm font-medium">Icon set update</p>
                <p class="text-xs text-muted-foreground">Low priority</p>
              </div>
            </div>
          </ui-kanban-card-content>
        </ui-kanban-card>
      </ui-kanban-column>
      <ui-kanban-column columnId="dev" title="Development">
        <ui-kanban-column-header>
          <div class="flex items-center gap-2 p-3">
            <span class="text-lg">💻</span>
            <h3 class="text-sm font-semibold">Dev Tasks</h3>
            <ui-badge label="1" variant="secondary" class="text-xs" />
          </div>
        </ui-kanban-column-header>
        <ui-kanban-card cardId="c3">
          <ui-kanban-card-content>
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded bg-blue-100 flex items-center justify-center text-blue-600">⚙️</div>
              <div>
                <p class="text-sm font-medium">API integration</p>
                <p class="text-xs text-muted-foreground">In progress</p>
              </div>
            </div>
          </ui-kanban-card-content>
        </ui-kanban-card>
      </ui-kanban-column>
    </ui-kanban>
  </div>
</section>
```

- [ ] **Step 4.4: Write the kanban smoke spec**

```ts
// demo/src/app/demos/patterns/kanban-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { KanbanDemoComponent } from './kanban-demo.component';
import { KANBAN_DEMO_LOCALES } from './kanban-demo.locales';

describe('KanbanDemoComponent', () => {
  it('renders English title and a sample card under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(KanbanDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(KANBAN_DEMO_LOCALES.en.title);
    expect(fixture.nativeElement.textContent).toContain('Research competitors');
  });

  it('renders Hebrew title and a Hebrew sample card under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(KanbanDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(KANBAN_DEMO_LOCALES.he.title);
    expect(fixture.nativeElement.textContent).toContain('מחקר מתחרים');
  });
});
```

- [ ] **Step 4.5: Run the spec — expect PASS**

```bash
npm run test-visual -- --run demo/src/app/demos/patterns/kanban-demo.component.spec.ts
```

Expected: 2 passing tests. If the constructor reseed pattern misfires under TestBed change-detection, swap to the `effect({ allowSignalWrites: true })` variant noted in Step 4.2 and rerun.

- [ ] **Step 4.6: Verify in browser**

```js
const cmp = ng.getComponent(document.querySelector('app-root'));
cmp.navTo('kanban');
await new Promise(r => setTimeout(r, 400));
cmp.setAppLocale('ja');
await new Promise(r => setTimeout(r, 300));
JSON.stringify({
  h2: document.querySelector('#kanban')?.textContent.trim(),
  columnHeaders: Array.from(document.querySelectorAll('ui-kanban-column [data-slot="kanban-column-title"], ui-kanban-column h3, ui-kanban-column .kanban-column-title')).map(e => e.textContent.trim()).slice(0,5),
  firstCard: document.querySelector('ui-kanban-card')?.textContent.trim().slice(0,40),
});
```

Expected: `h2` is `カンバンボード`, column headers in Japanese (`バックログ`, `未着手`, …), first card text in Japanese (`競合調査`). Reset to `en`.

- [ ] **Step 4.7: Commit Task 4**

```bash
git add demo/src/app/demos/patterns/kanban-demo.locales.ts \
        demo/src/app/demos/patterns/kanban-demo.component.ts \
        demo/src/app/demos/patterns/kanban-demo.component.html \
        demo/src/app/demos/patterns/kanban-demo.component.spec.ts
git commit -m "$(cat <<'EOF'
demo i18n: Phase 1 Task 4 — kanban demo (consolidate dual boards)

Kanban demo's titles, descriptions, history indicators, and sample
data (columns, cards, assignee names, label text) now bind through
a co-located locale file covering all 10 supported locales. The
duplicate hand-translated Hebrew board is removed — the single
board flips with the global locale instead. The "Custom Mode"
content-projection section stays English because it's an API
showcase, not data.

Sample-data ids stay stable across locales so reordering survives
a same-language remount; a locale change reseeds the board with
the new locale's data.

Refs: specs/demo-app-i18n-spec.md (Phase 1, pilot)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Full-suite test gate

- [ ] **Step 5.1: Run the full pilot spec set**

```bash
npm run test-visual -- --run \
  demo/src/app/demos/introduction.component.spec.ts \
  demo/src/app/demos/navigation/pagination-demo.component.spec.ts \
  demo/src/app/demos/inputs/calendar-demo.component.spec.ts \
  demo/src/app/demos/patterns/kanban-demo.component.spec.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5.2: Run the full library + demo test suite (catch regressions)**

```bash
npm run test-visual
```

Expected: zero failures. Per project memory ("zero test failures tolerated"), any pre-existing red tests must be investigated and fixed before declaring the task done.

- [ ] **Step 5.3: Confirm demo build is clean**

```bash
cd demo && npx ng build 2>&1 | grep -E "WARNING|ERROR|complete" | grep -v "lmdb\|bundle initial"
```

Expected: only `Application bundle generation complete.` Bundle-budget and lmdb warnings are pre-existing environmental noise.

---

## Task 6: Review gate (≥95) on Phase 1 pilot

- [ ] **Step 6.1: Run the review-gate skill**

```text
/use review-gate
```

Provide the reviewer:
- The spec path: `specs/demo-app-i18n-spec.md`
- The plan path: `docs/superpowers/plans/2026-05-26-demo-app-i18n-phase-1.md`
- The commit range for this phase: `git log --oneline master..HEAD` for the 4 commits above
- Acceptance criteria from the spec's "Acceptance criteria" section, applied to the pilot subset (4 demos + chrome)

- [ ] **Step 6.2: Iterate on reviewer feedback**

Address any reviewer items in order; redispatch the reviewer; repeat until score ≥95. Record the final score and rationale at the bottom of `specs/demo-app-i18n-spec.md` in a new "Phase 1 review log" section (the spec is a living document per project memory — add, don't overwrite).

- [ ] **Step 6.3: Commit the review-log entry**

```bash
git add specs/demo-app-i18n-spec.md
git commit -m "$(cat <<'EOF'
demo i18n: Phase 1 review-gate score recorded

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6.4: Hand off to user for Phase 2 approval**

Post a one-paragraph summary in the conversation:
- 4 demos + shared chrome localized to 10 locales
- Smoke specs passing
- Reviewer score
- Branch is ready; Phase 2 (parallel rollout to the remaining ~76 demos) waits for user go-ahead

---

## Spec coverage self-check

The spec's "Acceptance criteria" applied to Phase 1:

| Criterion (scoped to pilot) | Covered by |
|---|---|
| Switching locale changes every visible string on the pilot pages, including sample data | Tasks 1.7, 2.2, 3.2, 4.2/4.3; verified in browser steps 1.9, 2.5, 3.5, 4.6 |
| Sidebar category labels localize | Task 1.6 + 1.7 |
| Introduction page localizes | Tasks 1.2–1.4 |
| Every pilot demo has a smoke spec asserting Hebrew renders under `provideUiLocale('he')` | Tasks 1.4, 2.3, 3.3, 4.4 |
| `npm run build:demo` succeeds with no new warnings | Step 1.8 + 5.3 |
| `npm run test-visual` passes | Step 5.2 |
| Lint script for unlocalized strings (Phase 3) | **Deferred** — explicitly out of Phase 1 scope per the spec's phasing |
| Full rollout to the remaining ~76 demos (Phase 2) | **Deferred** — explicitly out of Phase 1 scope |
