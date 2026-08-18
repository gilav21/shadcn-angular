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
    programmaticWrite: string;
    programmaticWriteDesc: string;
  };
  actions: {
    setProgrammatically: string;
  };
  selected: string;
  dirtyLabel: string;
  yes: string;
  no: string;
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
      programmaticWrite: 'Programmatic write through a FormControl',
      programmaticWriteDesc: 'Try it: press "Set programmatically" — the swatch updates, no colorChange is emitted, and dirty stays no. Pick a colour by hand and dirty flips to yes.',
    },
    actions: { setProgrammatically: 'Set programmatically' },
    selected: 'Selected:',
    dirtyLabel: 'dirty:',
    yes: 'yes',
    no: 'no',
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
      programmaticWrite: 'כתיבה תכנותית דרך FormControl',
      programmaticWriteDesc: 'נסה: לחץ על "הגדר תכנותית" — הדגימה מתעדכנת, לא נפלט colorChange, ו-dirty נשאר "לא". בחר צבע ידנית ו-dirty יהפוך ל"כן".',
    },
    actions: { setProgrammatically: 'הגדר תכנותית' },
    selected: 'נבחר:',
    dirtyLabel: 'dirty:',
    yes: 'כן',
    no: 'לא',
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
      programmaticWrite: 'كتابة برمجية عبر FormControl',
      programmaticWriteDesc: 'جرّب: اضغط «تعيين برمجيًا» — تتحدّث العيّنة، ولا يُطلق colorChange، ويبقى dirty على «لا». اختر لونًا يدويًا فينقلب dirty إلى «نعم».',
    },
    actions: { setProgrammatically: 'تعيين برمجيًا' },
    selected: 'المحدد:',
    dirtyLabel: 'dirty:',
    yes: 'نعم',
    no: 'لا',
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
      programmaticWrite: 'Programmatisches Schreiben über ein FormControl',
      programmaticWriteDesc: 'Ausprobieren: „Programmatisch setzen“ drücken — das Farbfeld ändert sich, es wird kein colorChange gesendet und dirty bleibt „nein“. Von Hand gewählt, springt dirty auf „ja“.',
    },
    actions: { setProgrammatically: 'Programmatisch setzen' },
    selected: 'Ausgewählt:',
    dirtyLabel: 'dirty:',
    yes: 'ja',
    no: 'nein',
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
      programmaticWrite: 'Écriture programmatique via un FormControl',
      programmaticWriteDesc: 'Essayez : cliquez sur « Définir par le code » — l\'échantillon change, aucun colorChange n\'est émis et dirty reste « non ». Choisissez une couleur à la main et dirty passe à « oui ».',
    },
    actions: { setProgrammatically: 'Définir par le code' },
    selected: 'Sélectionné :',
    dirtyLabel: 'dirty :',
    yes: 'oui',
    no: 'non',
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
      programmaticWrite: 'Escritura programática a través de un FormControl',
      programmaticWriteDesc: 'Pruébalo: pulsa «Establecer por código» — la muestra cambia, no se emite colorChange y dirty sigue en «no». Elige un color a mano y dirty pasa a «sí».',
    },
    actions: { setProgrammatically: 'Establecer por código' },
    selected: 'Seleccionado:',
    dirtyLabel: 'dirty:',
    yes: 'sí',
    no: 'no',
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
      programmaticWrite: 'FormControl 経由のプログラム的な書き込み',
      programmaticWriteDesc: 'お試しください:「プログラムから設定」を押すと、見本は更新されますが colorChange は発火せず、dirty は「いいえ」のままです。手動で色を選ぶと dirty は「はい」に変わります。',
    },
    actions: { setProgrammatically: 'プログラムから設定' },
    selected: '選択中:',
    dirtyLabel: 'dirty:',
    yes: 'はい',
    no: 'いいえ',
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
      programmaticWrite: '通过 FormControl 以代码写入',
      programmaticWriteDesc: '试一试：点击“以代码设置”——色块会更新，但不会触发 colorChange，dirty 仍为“否”。手动选色后 dirty 变为“是”。',
    },
    actions: { setProgrammatically: '以代码设置' },
    selected: '已选择:',
    dirtyLabel: 'dirty:',
    yes: '是',
    no: '否',
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
      programmaticWrite: 'Программная запись через FormControl',
      programmaticWriteDesc: 'Попробуйте: нажмите «Задать программно» — образец обновится, colorChange не сработает, а dirty останется «нет». Выберите цвет вручную — и dirty станет «да».',
    },
    actions: { setProgrammatically: 'Задать программно' },
    selected: 'Выбрано:',
    dirtyLabel: 'dirty:',
    yes: 'да',
    no: 'нет',
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
      programmaticWrite: 'Escrita programática através de um FormControl',
      programmaticWriteDesc: 'Experimente: clique em «Definir por código» — a amostra muda, nenhum colorChange é emitido e dirty continua «não». Escolha uma cor à mão e dirty passa a «sim».',
    },
    actions: { setProgrammatically: 'Definir por código' },
    selected: 'Selecionado:',
    dirtyLabel: 'dirty:',
    yes: 'sim',
    no: 'não',
  },
};
