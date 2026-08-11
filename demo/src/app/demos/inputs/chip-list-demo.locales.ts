import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ChipListDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  sections: {
    variants: string;
    withData: string;
    reactiveForm: string;
  };
  labels: {
    defaultOutline: string;
    underline: string;
    ghost: string;
    withBadgeSecondary: string;
    tags: string;
    underlineVariant: string;
    outlineVariant: string;
    maxRows: string;
    disabled: string;
    formControl: string;
  };
  captions: {
    formControl: string;
  };
  actions: {
    disable: string;
    enable: string;
  };
  placeholders: {
    addTag: string;
    addFruit: string;
  };
  current: string;
  tags: string[];
  fruits: string[];
}

export const CHIP_LIST_DEMO_LOCALES: Record<string, ChipListDemoLocale> = {
  en: {
    code: 'en',
    title: 'Chip List',
    description: 'Input that converts text into chips. Type and press Enter to add.',
    sections: { variants: 'Variants', withData: 'With Data', reactiveForm: 'Reactive Form Control' },
    labels: {
      defaultOutline: 'Default (Outline)',
      underline: 'Underline',
      ghost: 'Ghost',
      withBadgeSecondary: 'With Badge Variant (Secondary)',
      tags: 'Tags',
      underlineVariant: 'Underline variant',
      outlineVariant: 'Outline variant',
      maxRows: 'Max 2 rows (scrollable)',
      disabled: 'Disabled',
      formControl: 'Skills (FormControl)',
    },
    captions: { formControl: 'Try it: press Disable — control.disable() dims the chips and blocks typing and removal.' },
    actions: { disable: 'Disable', enable: 'Enable' },
    placeholders: { addTag: 'Add a tag...', addFruit: 'Add fruit...' },
    current: 'Current:',
    tags: ['Angular', 'TypeScript', 'Signals'],
    fruits: ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape'],
  },
  he: {
    code: 'he', rtl: true,
    title: 'רשימת צ\'יפים',
    description: 'שדה קלט שממיר טקסט לצ\'יפים. הקלד ולחץ Enter כדי להוסיף.',
    sections: { variants: 'גרסאות', withData: 'עם נתונים', reactiveForm: 'שדה טופס ריאקטיבי' },
    labels: {
      defaultOutline: 'ברירת מחדל (מסגרת)',
      underline: 'קו תחתון',
      ghost: 'שקוף',
      withBadgeSecondary: 'עם גרסת תג (משני)',
      tags: 'תגיות',
      underlineVariant: 'גרסת קו תחתון',
      outlineVariant: 'גרסת מסגרת',
      maxRows: 'מקסימום 2 שורות (גלילה)',
      disabled: 'מושבת',
      formControl: 'כישורים (FormControl)',
    },
    captions: { formControl: 'נסה: לחץ על "השבת" — control.disable() מעמעם את הצ\'יפים וחוסם הקלדה והסרה.' },
    actions: { disable: 'השבת', enable: 'הפעל' },
    placeholders: { addTag: 'הוסף תגית...', addFruit: 'הוסף פרי...' },
    current: 'נוכחי:',
    tags: ['אנגולר', 'טייפסקריפט', 'סיגנלים'],
    fruits: ['תפוח', 'בננה', 'דובדבן', 'תמר', 'אוכמנית', 'תאנה', 'ענב'],
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'قائمة الشرائح',
    description: 'حقل إدخال يحوّل النص إلى شرائح. اكتب واضغط Enter للإضافة.',
    sections: { variants: 'المتغيرات', withData: 'مع بيانات', reactiveForm: 'حقل نموذج تفاعلي' },
    labels: {
      defaultOutline: 'الافتراضي (محيط)',
      underline: 'تسطير',
      ghost: 'شبح',
      withBadgeSecondary: 'مع نمط الشارة (ثانوي)',
      tags: 'الوسوم',
      underlineVariant: 'نمط التسطير',
      outlineVariant: 'نمط المحيط',
      maxRows: 'حد أقصى صفان (قابل للتمرير)',
      disabled: 'معطّل',
      formControl: 'المهارات (FormControl)',
    },
    captions: { formControl: 'جرّب: اضغط "تعطيل" — تُعتّم control.disable() الشرائح وتمنع الكتابة والحذف.' },
    actions: { disable: 'تعطيل', enable: 'تفعيل' },
    placeholders: { addTag: 'أضف وسمًا...', addFruit: 'أضف فاكهة...' },
    current: 'الحالي:',
    tags: ['أنغولار', 'تايب سكريبت', 'إشارات'],
    fruits: ['تفاح', 'موز', 'كرز', 'تمر', 'توت', 'تين', 'عنب'],
  },
  de: {
    code: 'de',
    title: 'Chip-Liste',
    description: 'Eingabe, die Text in Chips umwandelt. Tippen und Enter drücken zum Hinzufügen.',
    sections: { variants: 'Varianten', withData: 'Mit Daten', reactiveForm: 'Reactive-Form-Steuerelement' },
    labels: {
      defaultOutline: 'Standard (Umriss)',
      underline: 'Unterstrichen',
      ghost: 'Ghost',
      withBadgeSecondary: 'Mit Badge-Variante (Sekundär)',
      tags: 'Tags',
      underlineVariant: 'Unterstrich-Variante',
      outlineVariant: 'Umriss-Variante',
      maxRows: 'Max. 2 Zeilen (scrollbar)',
      disabled: 'Deaktiviert',
      formControl: 'Fähigkeiten (FormControl)',
    },
    captions: { formControl: 'Ausprobieren: „Deaktivieren“ drücken — control.disable() dimmt die Chips und blockiert Eingabe und Entfernen.' },
    actions: { disable: 'Deaktivieren', enable: 'Aktivieren' },
    placeholders: { addTag: 'Tag hinzufügen...', addFruit: 'Frucht hinzufügen...' },
    current: 'Aktuell:',
    tags: ['Angular', 'TypeScript', 'Signals'],
    fruits: ['Apfel', 'Banane', 'Kirsche', 'Dattel', 'Holunderbeere', 'Feige', 'Traube'],
  },
  fr: {
    code: 'fr',
    title: 'Liste de puces',
    description: 'Saisie qui convertit le texte en puces. Tapez et appuyez sur Entrée pour ajouter.',
    sections: { variants: 'Variantes', withData: 'Avec données', reactiveForm: 'Contrôle de formulaire réactif' },
    labels: {
      defaultOutline: 'Par défaut (contour)',
      underline: 'Souligné',
      ghost: 'Fantôme',
      withBadgeSecondary: 'Avec variante badge (secondaire)',
      tags: 'Étiquettes',
      underlineVariant: 'Variante soulignée',
      outlineVariant: 'Variante contour',
      maxRows: 'Max. 2 lignes (défilable)',
      disabled: 'Désactivé',
      formControl: 'Compétences (FormControl)',
    },
    captions: { formControl: 'Essayez : cliquez sur « Désactiver » — control.disable() estompe les puces et bloque la saisie et la suppression.' },
    actions: { disable: 'Désactiver', enable: 'Activer' },
    placeholders: { addTag: 'Ajouter une étiquette...', addFruit: 'Ajouter un fruit...' },
    current: 'Actuel :',
    tags: ['Angular', 'TypeScript', 'Signals'],
    fruits: ['Pomme', 'Banane', 'Cerise', 'Datte', 'Sureau', 'Figue', 'Raisin'],
  },
  es: {
    code: 'es',
    title: 'Lista de chips',
    description: 'Entrada que convierte texto en chips. Escribe y pulsa Enter para añadir.',
    sections: { variants: 'Variantes', withData: 'Con datos', reactiveForm: 'Control de formulario reactivo' },
    labels: {
      defaultOutline: 'Predeterminado (contorno)',
      underline: 'Subrayado',
      ghost: 'Fantasma',
      withBadgeSecondary: 'Con variante de insignia (secundaria)',
      tags: 'Etiquetas',
      underlineVariant: 'Variante subrayada',
      outlineVariant: 'Variante contorno',
      maxRows: 'Máx. 2 filas (desplazable)',
      disabled: 'Desactivado',
      formControl: 'Habilidades (FormControl)',
    },
    captions: { formControl: 'Pruébalo: pulsa «Desactivar» — control.disable() atenúa los chips y bloquea la escritura y la eliminación.' },
    actions: { disable: 'Desactivar', enable: 'Activar' },
    placeholders: { addTag: 'Añadir etiqueta...', addFruit: 'Añadir fruta...' },
    current: 'Actual:',
    tags: ['Angular', 'TypeScript', 'Signals'],
    fruits: ['Manzana', 'Plátano', 'Cereza', 'Dátil', 'Saúco', 'Higo', 'Uva'],
  },
  ja: {
    code: 'ja',
    title: 'チップリスト',
    description: 'テキストをチップに変換する入力フィールドです。入力してEnterキーを押すと追加されます。',
    sections: { variants: 'バリアント', withData: 'データあり', reactiveForm: 'リアクティブフォームコントロール' },
    labels: {
      defaultOutline: 'デフォルト（アウトライン）',
      underline: 'アンダーライン',
      ghost: 'ゴースト',
      withBadgeSecondary: 'バッジバリアント（セカンダリ）付き',
      tags: 'タグ',
      underlineVariant: 'アンダーラインバリアント',
      outlineVariant: 'アウトラインバリアント',
      maxRows: '最大2行（スクロール可）',
      disabled: '無効',
      formControl: 'スキル（FormControl）',
    },
    captions: { formControl: 'お試しください: 「無効にする」を押すと control.disable() がチップを淡色化し、入力と削除を止めます。' },
    actions: { disable: '無効にする', enable: '有効にする' },
    placeholders: { addTag: 'タグを追加...', addFruit: 'フルーツを追加...' },
    current: '現在:',
    tags: ['Angular', 'TypeScript', 'シグナル'],
    fruits: ['りんご', 'バナナ', 'さくらんぼ', 'ナツメヤシ', 'エルダーベリー', 'いちじく', 'ぶどう'],
  },
  zh: {
    code: 'zh',
    title: '标签列表',
    description: '将文本转换为标签的输入框。输入后按 Enter 键添加。',
    sections: { variants: '变体', withData: '带数据', reactiveForm: '响应式表单控件' },
    labels: {
      defaultOutline: '默认（轮廓）',
      underline: '下划线',
      ghost: '幽灵',
      withBadgeSecondary: '带徽章变体（次要）',
      tags: '标签',
      underlineVariant: '下划线变体',
      outlineVariant: '轮廓变体',
      maxRows: '最多2行（可滚动）',
      disabled: '禁用',
      formControl: '技能（FormControl）',
    },
    captions: { formControl: '试一试：点击“禁用”——control.disable() 会让标签变暗并阻止输入和删除。' },
    actions: { disable: '禁用', enable: '启用' },
    placeholders: { addTag: '添加标签...', addFruit: '添加水果...' },
    current: '当前:',
    tags: ['Angular', 'TypeScript', '信号'],
    fruits: ['苹果', '香蕉', '樱桃', '椰枣', '接骨木莓', '无花果', '葡萄'],
  },
  ru: {
    code: 'ru',
    title: 'Список чипов',
    description: 'Ввод, преобразующий текст в чипы. Введите текст и нажмите Enter для добавления.',
    sections: { variants: 'Варианты', withData: 'С данными', reactiveForm: 'Элемент реактивной формы' },
    labels: {
      defaultOutline: 'По умолчанию (контур)',
      underline: 'Подчёркнутый',
      ghost: 'Призрак',
      withBadgeSecondary: 'С вариантом значка (вторичный)',
      tags: 'Теги',
      underlineVariant: 'Вариант с подчёркиванием',
      outlineVariant: 'Вариант с контуром',
      maxRows: 'Макс. 2 строки (прокрутка)',
      disabled: 'Отключено',
      formControl: 'Навыки (FormControl)',
    },
    captions: { formControl: 'Попробуйте: нажмите «Отключить» — control.disable() приглушает чипы и блокирует ввод и удаление.' },
    actions: { disable: 'Отключить', enable: 'Включить' },
    placeholders: { addTag: 'Добавить тег...', addFruit: 'Добавить фрукт...' },
    current: 'Текущее:',
    tags: ['Angular', 'TypeScript', 'Сигналы'],
    fruits: ['Яблоко', 'Банан', 'Вишня', 'Финик', 'Бузина', 'Инжир', 'Виноград'],
  },
  pt: {
    code: 'pt',
    title: 'Lista de chips',
    description: 'Entrada que converte texto em chips. Digite e pressione Enter para adicionar.',
    sections: { variants: 'Variantes', withData: 'Com dados', reactiveForm: 'Controle de formulário reativo' },
    labels: {
      defaultOutline: 'Padrão (contorno)',
      underline: 'Sublinhado',
      ghost: 'Fantasma',
      withBadgeSecondary: 'Com variante de emblema (secundário)',
      tags: 'Tags',
      underlineVariant: 'Variante sublinhada',
      outlineVariant: 'Variante contorno',
      maxRows: 'Máx. 2 linhas (rolável)',
      disabled: 'Desativado',
      formControl: 'Competências (FormControl)',
    },
    captions: { formControl: 'Experimente: clique em «Desativar» — control.disable() esmaece os chips e bloqueia digitação e remoção.' },
    actions: { disable: 'Desativar', enable: 'Ativar' },
    placeholders: { addTag: 'Adicionar tag...', addFruit: 'Adicionar fruta...' },
    current: 'Atual:',
    tags: ['Angular', 'TypeScript', 'Signals'],
    fruits: ['Maçã', 'Banana', 'Cereja', 'Tâmara', 'Sabugueiro', 'Figo', 'Uva'],
  },
};
