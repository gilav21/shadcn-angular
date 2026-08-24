import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface SignaturePadDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  basicHeading: string;
  basicDescription: string;
  penHeading: string;
  penDescription: string;
  a11yHeading: string;
  a11yDescription: string;
  a11yWarning: string;
  drawOption: string;
  typeOption: string;
  nameLabel: string;
  namePlaceholder: string;
  formatsHeading: string;
  formatsDescription: string;
  signedLabel: string;
  notSignedLabel: string;
  clearLabel: string;
  undoLabel: string;
  signatureLabel: string;
}

export const SIGNATURE_PAD_DEMO_LOCALES: Record<string, SignaturePadDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Signature Pad',
    description: 'A hand-drawn mark, submitted as a PNG data URL.',
    basicHeading: 'Basic',
    basicDescription:
      'Draw with a mouse, a pen or a finger. Undo removes the last stroke; Clear starts again.',
    penHeading: 'Ink',
    penDescription: 'Colour and width are inputs; the strokes are stored, so nothing blurs.',
    a11yHeading: 'The alternative is not optional',
    a11yDescription:
      'A drawn mark cannot be produced with a keyboard, a switch or a screen reader, and no ARIA attribute changes that. Offer a typed name that carries the same weight.',
    a11yWarning: 'Ship a signature pad without this choice and some people simply cannot sign.',
    drawOption: 'Draw it',
    typeOption: 'Type my name',
    nameLabel: 'Full name',
    namePlaceholder: 'Your full name',
    formatsHeading: 'Other formats',
    formatsDescription:
      'The value stays a PNG, but the strokes can also be read as SVG — line art, a tenth the size, and what a PDF wants.',
    signedLabel: 'Signed',
    notSignedLabel: 'Not signed yet',
    clearLabel: 'Clear',
    undoLabel: 'Undo',
    signatureLabel: 'Signature',
  },
  he: {
    code: 'he',
    heading: 'לוח חתימה',
    description: 'סימן מצויר ביד, נשלח כ־PNG בכתובת data.',
    basicHeading: 'בסיסי',
    basicDescription: 'ציירו בעכבר, בעט או באצבע. „בטל” מסיר את המשיכה האחרונה, „נקה” מתחיל מחדש.',
    penHeading: 'דיו',
    penDescription: 'הצבע והעובי הם קלטים; המשיכות נשמרות, ולכן שום דבר לא מטשטש.',
    a11yHeading: 'החלופה אינה רשות',
    a11yDescription:
      'אי אפשר ליצור סימן מצויר במקלדת, במתג או בקורא מסך, ואף מאפיין ARIA לא משנה זאת. הציעו הקלדת שם בעלת אותו תוקף.',
    a11yWarning: 'בלי הבחירה הזאת פשוט יש אנשים שלא יוכלו לחתום.',
    drawOption: 'לצייר',
    typeOption: 'להקליד את שמי',
    nameLabel: 'שם מלא',
    namePlaceholder: 'השם המלא שלך',
    formatsHeading: 'פורמטים נוספים',
    formatsDescription:
      'הערך נשאר PNG, אך אפשר לקרוא את המשיכות גם כ־SVG — ציור קווי, עשירית מהגודל, וזה מה ש־PDF רוצה.',
    signedLabel: 'נחתם',
    notSignedLabel: 'טרם נחתם',
    clearLabel: 'נקה',
    undoLabel: 'בטל',
    signatureLabel: 'חתימה',
  },
  ar: {
    code: 'ar',
    heading: 'لوح التوقيع',
    description: 'علامة مرسومة باليد، تُرسَل كعنوان بيانات PNG.',
    basicHeading: 'أساسي',
    basicDescription: 'ارسم بالفأرة أو القلم أو الإصبع. «تراجع» يزيل آخر خط، و«مسح» يبدأ من جديد.',
    penHeading: 'الحبر',
    penDescription: 'اللون والعرض مدخلان؛ الخطوط محفوظة، فلا شيء يتشوّش.',
    a11yHeading: 'البديل ليس اختياريًا',
    a11yDescription:
      'لا يمكن رسم علامة بلوحة مفاتيح أو مفتاح أو قارئ شاشة، ولا تغيّر سمات ARIA ذلك. قدّم اسمًا مكتوبًا له الوزن نفسه.',
    a11yWarning: 'بدون هذا الخيار هناك ببساطة من لا يستطيع التوقيع.',
    drawOption: 'أرسمه',
    typeOption: 'أكتب اسمي',
    nameLabel: 'الاسم الكامل',
    namePlaceholder: 'اسمك الكامل',
    formatsHeading: 'صيغ أخرى',
    formatsDescription:
      'تبقى القيمة PNG، لكن يمكن قراءة الخطوط أيضًا بصيغة SVG — رسم خطي بعُشر الحجم، وهو ما يريده PDF.',
    signedLabel: 'موقَّع',
    notSignedLabel: 'لم يُوقَّع بعد',
    clearLabel: 'مسح',
    undoLabel: 'تراجع',
    signatureLabel: 'التوقيع',
  },
  de: {
    code: 'de',
    heading: 'Unterschriftenfeld',
    description: 'Ein handgezeichnetes Zeichen, übermittelt als PNG-Daten-URL.',
    basicHeading: 'Grundlagen',
    basicDescription:
      'Mit Maus, Stift oder Finger zeichnen. „Rückgängig“ entfernt den letzten Strich, „Löschen“ fängt neu an.',
    penHeading: 'Tinte',
    penDescription: 'Farbe und Breite sind Eingaben; die Striche werden gespeichert, nichts verschwimmt.',
    a11yHeading: 'Die Alternative ist keine Kür',
    a11yDescription:
      'Ein gezeichnetes Zeichen lässt sich weder mit Tastatur noch mit Schalter oder Screenreader erzeugen, und kein ARIA-Attribut ändert das. Bieten Sie einen getippten Namen mit gleichem Gewicht an.',
    a11yWarning: 'Ohne diese Wahl können manche Menschen schlicht nicht unterschreiben.',
    drawOption: 'Zeichnen',
    typeOption: 'Namen tippen',
    nameLabel: 'Vollständiger Name',
    namePlaceholder: 'Ihr vollständiger Name',
    formatsHeading: 'Weitere Formate',
    formatsDescription:
      'Der Wert bleibt ein PNG, aber die Striche gibt es auch als SVG — Strichzeichnung, ein Zehntel der Größe, und genau das, was ein PDF will.',
    signedLabel: 'Unterschrieben',
    notSignedLabel: 'Noch nicht unterschrieben',
    clearLabel: 'Löschen',
    undoLabel: 'Rückgängig',
    signatureLabel: 'Unterschrift',
  },
  fr: {
    code: 'fr',
    heading: 'Bloc de signature',
    description: 'Une marque tracée à la main, envoyée comme URL de données PNG.',
    basicHeading: 'Basique',
    basicDescription:
      'Tracez à la souris, au stylet ou au doigt. « Annuler » retire le dernier trait, « Effacer » recommence.',
    penHeading: 'Encre',
    penDescription: 'La couleur et l’épaisseur sont des entrées ; les traits sont conservés, rien ne devient flou.',
    a11yHeading: 'L’alternative n’est pas facultative',
    a11yDescription:
      'Une marque tracée ne peut être produite ni au clavier, ni au contacteur, ni au lecteur d’écran, et aucun attribut ARIA n’y change rien. Proposez un nom saisi ayant la même valeur.',
    a11yWarning: 'Sans ce choix, certaines personnes ne peuvent tout simplement pas signer.',
    drawOption: 'La tracer',
    typeOption: 'Saisir mon nom',
    nameLabel: 'Nom complet',
    namePlaceholder: 'Votre nom complet',
    formatsHeading: 'Autres formats',
    formatsDescription:
      'La valeur reste un PNG, mais les traits se lisent aussi en SVG — du dessin au trait, dix fois plus léger, et ce que veut un PDF.',
    signedLabel: 'Signé',
    notSignedLabel: 'Pas encore signé',
    clearLabel: 'Effacer',
    undoLabel: 'Annuler',
    signatureLabel: 'Signature',
  },
  es: {
    code: 'es',
    heading: 'Panel de firma',
    description: 'Una marca dibujada a mano, enviada como URL de datos PNG.',
    basicHeading: 'Básico',
    basicDescription:
      'Dibuja con ratón, lápiz o dedo. «Deshacer» quita el último trazo, «Borrar» empieza de nuevo.',
    penHeading: 'Tinta',
    penDescription: 'El color y el grosor son entradas; los trazos se guardan, así que nada se difumina.',
    a11yHeading: 'La alternativa no es opcional',
    a11yDescription:
      'Una marca dibujada no puede producirse con teclado, conmutador ni lector de pantalla, y ningún atributo ARIA lo cambia. Ofrece un nombre escrito con el mismo valor.',
    a11yWarning: 'Sin esta opción, hay personas que sencillamente no pueden firmar.',
    drawOption: 'Dibujarla',
    typeOption: 'Escribir mi nombre',
    nameLabel: 'Nombre completo',
    namePlaceholder: 'Tu nombre completo',
    formatsHeading: 'Otros formatos',
    formatsDescription:
      'El valor sigue siendo un PNG, pero los trazos también se leen como SVG: dibujo lineal, una décima parte del tamaño, y lo que quiere un PDF.',
    signedLabel: 'Firmado',
    notSignedLabel: 'Sin firmar todavía',
    clearLabel: 'Borrar',
    undoLabel: 'Deshacer',
    signatureLabel: 'Firma',
  },
  ja: {
    code: 'ja',
    heading: '署名パッド',
    description: '手描きの印を、PNG のデータ URL として送信します。',
    basicHeading: '基本',
    basicDescription:
      'マウス・ペン・指で描けます。「取り消す」は最後の一画を消し、「消去」は最初からやり直します。',
    penHeading: 'インク',
    penDescription: '色と太さは入力です。線そのものを保持するので、ぼやけることはありません。',
    a11yHeading: '代替手段は任意ではありません',
    a11yDescription:
      '手描きの印はキーボードでもスイッチでもスクリーンリーダーでも作れず、ARIA 属性では解決しません。同じ効力を持つ氏名入力を用意してください。',
    a11yWarning: 'この選択肢がなければ、そもそも署名できない人がいます。',
    drawOption: '描く',
    typeOption: '氏名を入力する',
    nameLabel: '氏名',
    namePlaceholder: 'あなたの氏名',
    formatsHeading: 'ほかの形式',
    formatsDescription:
      '値は PNG のままですが、線は SVG としても読み出せます。線画で容量は 10 分の 1、PDF が求める形式です。',
    signedLabel: '署名済み',
    notSignedLabel: '未署名',
    clearLabel: '消去',
    undoLabel: '取り消す',
    signatureLabel: '署名',
  },
  zh: {
    code: 'zh',
    heading: '签名板',
    description: '手绘的签名，以 PNG 数据 URL 提交。',
    basicHeading: '基础',
    basicDescription: '可用鼠标、触控笔或手指书写。“撤销”移除最后一笔，“清除”重新开始。',
    penHeading: '墨迹',
    penDescription: '颜色和粗细都是输入；保存的是笔画本身，因此不会模糊。',
    a11yHeading: '替代方式并非可选',
    a11yDescription:
      '手绘签名无法用键盘、开关或读屏软件完成，任何 ARIA 属性都改变不了。请提供具有同等效力的姓名输入。',
    a11yWarning: '没有这个选项，有些人根本无法签名。',
    drawOption: '手写',
    typeOption: '输入姓名',
    nameLabel: '姓名',
    namePlaceholder: '您的姓名',
    formatsHeading: '其他格式',
    formatsDescription:
      '值仍是 PNG，但笔画也能读作 SVG——线稿，体积只有十分之一，也正是 PDF 想要的。',
    signedLabel: '已签名',
    notSignedLabel: '尚未签名',
    clearLabel: '清除',
    undoLabel: '撤销',
    signatureLabel: '签名',
  },
  ru: {
    code: 'ru',
    heading: 'Поле подписи',
    description: 'Нарисованная от руки подпись, отправляемая как PNG data URL.',
    basicHeading: 'Основное',
    basicDescription:
      'Рисуйте мышью, пером или пальцем. «Отменить» убирает последний штрих, «Очистить» начинает заново.',
    penHeading: 'Чернила',
    penDescription: 'Цвет и толщина — это входы; хранятся сами штрихи, поэтому ничего не размывается.',
    a11yHeading: 'Альтернатива не факультативна',
    a11yDescription:
      'Нарисованную подпись нельзя создать ни клавиатурой, ни переключателем, ни скринридером, и никакой атрибут ARIA этого не меняет. Предложите ввод имени с той же силой.',
    a11yWarning: 'Без этого выбора часть людей просто не сможет подписать.',
    drawOption: 'Нарисовать',
    typeOption: 'Ввести имя',
    nameLabel: 'Полное имя',
    namePlaceholder: 'Ваше полное имя',
    formatsHeading: 'Другие форматы',
    formatsDescription:
      'Значение остаётся PNG, но штрихи читаются и как SVG — векторный рисунок, в десять раз меньше, и именно то, что нужно PDF.',
    signedLabel: 'Подписано',
    notSignedLabel: 'Ещё не подписано',
    clearLabel: 'Очистить',
    undoLabel: 'Отменить',
    signatureLabel: 'Подпись',
  },
  pt: {
    code: 'pt',
    heading: 'Bloco de assinatura',
    description: 'Uma marca desenhada à mão, enviada como URL de dados PNG.',
    basicHeading: 'Básico',
    basicDescription:
      'Desenhe com rato, caneta ou dedo. «Desfazer» remove o último traço, «Limpar» recomeça.',
    penHeading: 'Tinta',
    penDescription: 'A cor e a espessura são entradas; os traços ficam guardados, por isso nada desfoca.',
    a11yHeading: 'A alternativa não é opcional',
    a11yDescription:
      'Uma marca desenhada não se produz com teclado, manípulo ou leitor de ecrã, e nenhum atributo ARIA muda isso. Ofereça um nome escrito com o mesmo peso.',
    a11yWarning: 'Sem esta escolha há pessoas que simplesmente não conseguem assinar.',
    drawOption: 'Desenhar',
    typeOption: 'Escrever o meu nome',
    nameLabel: 'Nome completo',
    namePlaceholder: 'O seu nome completo',
    formatsHeading: 'Outros formatos',
    formatsDescription:
      'O valor continua a ser um PNG, mas os traços também se leem em SVG — desenho de linha, um décimo do tamanho, e o que um PDF quer.',
    signedLabel: 'Assinado',
    notSignedLabel: 'Ainda não assinado',
    clearLabel: 'Limpar',
    undoLabel: 'Desfazer',
    signatureLabel: 'Assinatura',
  },
};
