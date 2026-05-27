import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ColorPickerDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  sections: {
    default: string;
    withAlpha: string;
    eyedropperImage: string;
    eyedropperImageDesc: string;
    harmoniesContrast: string;
    oklchRecents: string;
    oklchRecentsDesc: string;
  };
  selected: string;
}

export const COLOR_PICKER_DEMO_LOCALES: Record<string, ColorPickerDemoLocale> = {
  en: {
    code: 'en',
    title: 'Color Picker',
    description: 'A popover with an HSV spectrum, hex/rgb/hsl/oklch inputs, presets, recents, eyedropper, image-pick, harmonies, contrast checking, and full keyboard control of the saturation/value area.',
    sections: {
      default: 'Default',
      withAlpha: 'With alpha',
      eyedropperImage: 'Eyedropper + image pick',
      eyedropperImageDesc: 'The pipette samples any pixel on screen (Chromium-based browsers). The framed-pipette opens a file picker and extracts a dominant palette via median-cut.',
      harmoniesContrast: 'Harmonies + contrast checker',
      oklchRecents: 'OKLCH tab + persisted recents',
      oklchRecentsDesc: 'Recents persist across reloads via localStorage. The OKLCH tab exposes the perceptually-uniform color space (CSS Color 4).',
    },
    selected: 'Selected:',
  },
  he: {
    code: 'he', rtl: true,
    title: 'בורר צבעים',
    description: 'חלון קופץ עם ספקטרום HSV, שדות קלט hex/rgb/hsl/oklch, פלטות מוגדרות מראש, אחרונים, טפטפת עין, בחירת תמונה, הרמוניות, בדיקת ניגודיות ושליטה מלאה במקלדת.',
    sections: {
      default: 'ברירת מחדל',
      withAlpha: 'עם שקיפות',
      eyedropperImage: 'טפטפת עין + בחירת תמונה',
      eyedropperImageDesc: 'הטפטפת דוגמת כל פיקסל על המסך (דפדפנים מבוססי Chromium). הטפטפת הממוסגרת פותחת בוחר קבצים ומחלץ פלטה דומיננטית.',
      harmoniesContrast: 'הרמוניות + בדיקת ניגודיות',
      oklchRecents: 'כרטיסיית OKLCH + אחרונים שמורים',
      oklchRecentsDesc: 'הצבעים האחרונים נשמרים דרך localStorage. כרטיסיית OKLCH חושפת את מרחב הצבע האחיד תפיסתית (CSS Color 4).',
    },
    selected: 'נבחר:',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'منتقي الألوان',
    description: 'نافذة منبثقة مع طيف HSV، وحقول إدخال hex/rgb/hsl/oklch، وأنظمة ألوان مُعدَّة مسبقًا، وألوان حديثة، وقطّارة عين، واختيار صورة، وتناسق الألوان، والتحقق من التباين.',
    sections: {
      default: 'الافتراضي',
      withAlpha: 'مع الشفافية',
      eyedropperImage: 'قطّارة العين + اختيار صورة',
      eyedropperImageDesc: 'تأخذ القطّارة عيّنة من أي بكسل على الشاشة (متصفحات Chromium). تفتح القطّارة الإطارية منتقي ملفات وتستخرج لوحة ألوان مهيمنة.',
      harmoniesContrast: 'تناسق الألوان + مدقق التباين',
      oklchRecents: 'علامة تبويب OKLCH + الألوان الحديثة المحفوظة',
      oklchRecentsDesc: 'تُحفظ الألوان الحديثة عبر localStorage. تعرض علامة OKLCH فضاء الألوان المنتظم إدراكيًا (CSS Color 4).',
    },
    selected: 'المحدد:',
  },
  de: {
    code: 'de',
    title: 'Farbwähler',
    description: 'Ein Popover mit HSV-Spektrum, Hex/RGB/HSL/OKLCH-Eingaben, Voreinstellungen, letzten Farben, Eyedropper, Bildauswahl, Harmonien, Kontrastprüfung und vollständiger Tastatursteuerung.',
    sections: {
      default: 'Standard',
      withAlpha: 'Mit Alpha',
      eyedropperImage: 'Eyedropper + Bildauswahl',
      eyedropperImageDesc: 'Die Pipette nimmt beliebige Pixel auf dem Bildschirm auf (Chromium-Browser). Die gerahmte Pipette öffnet einen Dateiauswähler und extrahiert eine dominante Palette.',
      harmoniesContrast: 'Harmonien + Kontrastprüfer',
      oklchRecents: 'OKLCH-Tab + gespeicherte Letzte',
      oklchRecentsDesc: 'Die letzten Farben werden per localStorage gespeichert. Der OKLCH-Tab zeigt den wahrnehmungsgleichmäßigen Farbraum (CSS Color 4).',
    },
    selected: 'Ausgewählt:',
  },
  fr: {
    code: 'fr',
    title: 'Sélecteur de couleurs',
    description: 'Un popover avec spectre HSV, champs hex/rgb/hsl/oklch, préréglages, récents, pipette, sélection d\'image, harmonies, vérification de contraste et contrôle clavier complet.',
    sections: {
      default: 'Par défaut',
      withAlpha: 'Avec alpha',
      eyedropperImage: 'Pipette + sélection d\'image',
      eyedropperImageDesc: 'La pipette échantillonne n\'importe quel pixel à l\'écran (navigateurs Chromium). La pipette encadrée ouvre un sélecteur de fichiers et extrait une palette dominante.',
      harmoniesContrast: 'Harmonies + vérificateur de contraste',
      oklchRecents: 'Onglet OKLCH + récents persistants',
      oklchRecentsDesc: 'Les récents persistent entre les rechargements via localStorage. L\'onglet OKLCH expose l\'espace colorimétrique perceptuellement uniforme (CSS Color 4).',
    },
    selected: 'Sélectionné :',
  },
  es: {
    code: 'es',
    title: 'Selector de color',
    description: 'Un popover con espectro HSV, entradas hex/rgb/hsl/oklch, ajustes preestablecidos, recientes, cuentagotas, selección de imagen, armonías, comprobación de contraste y control de teclado completo.',
    sections: {
      default: 'Predeterminado',
      withAlpha: 'Con alfa',
      eyedropperImage: 'Cuentagotas + selección de imagen',
      eyedropperImageDesc: 'El cuentagotas toma muestras de cualquier píxel en la pantalla (navegadores Chromium). El cuentagotas enmarcado abre un selector de archivos y extrae una paleta dominante.',
      harmoniesContrast: 'Armonías + verificador de contraste',
      oklchRecents: 'Pestaña OKLCH + recientes persistentes',
      oklchRecentsDesc: 'Los recientes persisten entre recargas mediante localStorage. La pestaña OKLCH expone el espacio de color perceptualmente uniforme (CSS Color 4).',
    },
    selected: 'Seleccionado:',
  },
  ja: {
    code: 'ja',
    title: 'カラーピッカー',
    description: 'HSVスペクトラム、hex/rgb/hsl/oklch入力、プリセット、最近使用した色、スポイト、画像選択、ハーモニー、コントラスト確認、フルキーボード操作を備えたポップオーバーです。',
    sections: {
      default: 'デフォルト',
      withAlpha: 'アルファ付き',
      eyedropperImage: 'スポイト + 画像選択',
      eyedropperImageDesc: 'スポイトは画面上の任意のピクセルをサンプリングします（Chromiumベースのブラウザ）。枠付きスポイトはファイル選択を開き、メディアンカットで主要パレットを抽出します。',
      harmoniesContrast: 'ハーモニー + コントラストチェッカー',
      oklchRecents: 'OKLCHタブ + 永続的な最近使用した色',
      oklchRecentsDesc: '最近使用した色はlocalStorageを通じて維持されます。OKLCHタブは知覚的に均一なカラースペース（CSS Color 4）を公開します。',
    },
    selected: '選択中:',
  },
  zh: {
    code: 'zh',
    title: '颜色选择器',
    description: '一个带有HSV光谱、hex/rgb/hsl/oklch输入、预设、最近颜色、取色器、图像选取、色彩和谐、对比度检查和完整键盘控制的弹出框。',
    sections: {
      default: '默认',
      withAlpha: '带透明度',
      eyedropperImage: '取色器 + 图像选取',
      eyedropperImageDesc: '吸管可对屏幕上任意像素取样（基于Chromium的浏览器）。带框吸管打开文件选择器并通过中值切割提取主色板。',
      harmoniesContrast: '色彩和谐 + 对比度检查器',
      oklchRecents: 'OKLCH选项卡 + 持久化最近颜色',
      oklchRecentsDesc: '最近颜色通过localStorage持久化。OKLCH选项卡提供感知均匀的颜色空间（CSS Color 4）。',
    },
    selected: '已选择:',
  },
  ru: {
    code: 'ru',
    title: 'Выбор цвета',
    description: 'Всплывающий элемент с HSV-спектром, полями hex/rgb/hsl/oklch, предустановками, недавними цветами, пипеткой, выбором изображения, гармониями, проверкой контраста и полным управлением с клавиатуры.',
    sections: {
      default: 'По умолчанию',
      withAlpha: 'С прозрачностью',
      eyedropperImage: 'Пипетка + выбор изображения',
      eyedropperImageDesc: 'Пипетка берёт образец любого пикселя на экране (браузеры на Chromium). Пипетка в рамке открывает выбор файла и извлекает доминирующую палитру.',
      harmoniesContrast: 'Гармонии + проверка контраста',
      oklchRecents: 'Вкладка OKLCH + сохранённые недавние',
      oklchRecentsDesc: 'Недавние цвета сохраняются через localStorage. Вкладка OKLCH предоставляет перцептивно равномерное цветовое пространство (CSS Color 4).',
    },
    selected: 'Выбрано:',
  },
  pt: {
    code: 'pt',
    title: 'Seletor de cores',
    description: 'Um popover com espectro HSV, entradas hex/rgb/hsl/oklch, predefinições, recentes, conta-gotas, seleção de imagem, harmonias, verificação de contraste e controle completo de teclado.',
    sections: {
      default: 'Padrão',
      withAlpha: 'Com alfa',
      eyedropperImage: 'Conta-gotas + seleção de imagem',
      eyedropperImageDesc: 'O conta-gotas amostra qualquer pixel na tela (navegadores Chromium). O conta-gotas enquadrado abre um seletor de arquivos e extrai uma paleta dominante.',
      harmoniesContrast: 'Harmonias + verificador de contraste',
      oklchRecents: 'Aba OKLCH + recentes persistidos',
      oklchRecentsDesc: 'Os recentes persistem entre recarregamentos via localStorage. A aba OKLCH expõe o espaço de cor perceptualmente uniforme (CSS Color 4).',
    },
    selected: 'Selecionado:',
  },
};
