import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface EyedropperDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  sections: {
    nativeApi: string;
    nativeApiDesc: string;
    inPageFallback: string;
    inPageFallbackDesc: string;
    disabled: string;
  };
  buttons: {
    pickPixel: string;
    sampleFromImage: string;
  };
}

export const EYEDROPPER_DEMO_LOCALES: Record<string, EyedropperDemoLocale> = {
  en: {
    code: 'en',
    title: 'Eyedropper',
    description: 'Standalone picker that prefers the native window.EyeDropper API and falls back to canvas-based sampling on any <img>, <canvas>, or <video> element you pass via fallbackTarget.',
    sections: {
      nativeApi: 'Native API',
      nativeApiDesc: 'Works on Chromium-based browsers. Click the pipette, then click any pixel anywhere on screen.',
      inPageFallback: 'In-page fallback',
      inPageFallbackDesc: 'Pass a target element via [fallbackTarget]. Works in Firefox / Safari where the native API isn\'t available.',
      disabled: 'Disabled',
    },
    buttons: {
      pickPixel: 'Pick a pixel',
      sampleFromImage: 'Sample from image',
    },
  },
  he: {
    code: 'he', rtl: true,
    title: 'טפטפת עין',
    description: 'בורר עצמאי המעדיף את ה-API הנייטיבי window.EyeDropper ונסוג לדגימה מבוססת קנבס על כל אלמנט <img>, <canvas> או <video> שתעביר דרך fallbackTarget.',
    sections: {
      nativeApi: 'API נייטיבי',
      nativeApiDesc: 'פועל בדפדפנים מבוססי Chromium. לחץ על הטפטפת, ואז לחץ על כל פיקסל בכל מקום על המסך.',
      inPageFallback: 'חלופה בדף',
      inPageFallbackDesc: 'העבר אלמנט מטרה דרך [fallbackTarget]. פועל ב-Firefox / Safari שבהם ה-API הנייטיבי אינו זמין.',
      disabled: 'מושבת',
    },
    buttons: {
      pickPixel: 'בחר פיקסל',
      sampleFromImage: 'דגום מתמונה',
    },
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'قطّارة العين',
    description: 'منتقٍ مستقل يُفضِّل واجهة window.EyeDropper الأصلية ويتراجع إلى الأخذ من الكانفاس على عناصر <img> أو <canvas> أو <video> التي تمررها عبر fallbackTarget.',
    sections: {
      nativeApi: 'الواجهة الأصلية',
      nativeApiDesc: 'يعمل على متصفحات Chromium. انقر على القطّارة، ثم انقر على أي بكسل في أي مكان على الشاشة.',
      inPageFallback: 'البديل داخل الصفحة',
      inPageFallbackDesc: 'مرِّر عنصر هدف عبر [fallbackTarget]. يعمل في Firefox / Safari حيث لا تتوفر الواجهة الأصلية.',
      disabled: 'معطّل',
    },
    buttons: {
      pickPixel: 'اختر بكسلًا',
      sampleFromImage: 'أخذ عيّنة من الصورة',
    },
  },
  de: {
    code: 'de',
    title: 'Pipette',
    description: 'Eigenständige Pipette, die die native window.EyeDropper API bevorzugt und auf canvas-basiertes Sampling für <img>-, <canvas>- oder <video>-Elemente zurückgreift.',
    sections: {
      nativeApi: 'Native API',
      nativeApiDesc: 'Funktioniert in Chromium-basierten Browsern. Klicken Sie auf die Pipette und dann auf einen beliebigen Pixel auf dem Bildschirm.',
      inPageFallback: 'In-Page-Fallback',
      inPageFallbackDesc: 'Übergeben Sie ein Zielelement über [fallbackTarget]. Funktioniert in Firefox / Safari, wo die native API nicht verfügbar ist.',
      disabled: 'Deaktiviert',
    },
    buttons: {
      pickPixel: 'Pixel aufnehmen',
      sampleFromImage: 'Aus Bild aufnehmen',
    },
  },
  fr: {
    code: 'fr',
    title: 'Pipette',
    description: 'Pipette autonome qui préfère l\'API native window.EyeDropper et revient à l\'échantillonnage canvas pour les éléments <img>, <canvas> ou <video> passés via fallbackTarget.',
    sections: {
      nativeApi: 'API native',
      nativeApiDesc: 'Fonctionne sur les navigateurs Chromium. Cliquez sur la pipette, puis sur n\'importe quel pixel de l\'écran.',
      inPageFallback: 'Fallback dans la page',
      inPageFallbackDesc: 'Passez un élément cible via [fallbackTarget]. Fonctionne dans Firefox / Safari où l\'API native n\'est pas disponible.',
      disabled: 'Désactivé',
    },
    buttons: {
      pickPixel: 'Choisir un pixel',
      sampleFromImage: 'Échantillonner depuis l\'image',
    },
  },
  es: {
    code: 'es',
    title: 'Cuentagotas',
    description: 'Selector independiente que prefiere la API nativa window.EyeDropper y recurre al muestreo de canvas en elementos <img>, <canvas> o <video> pasados mediante fallbackTarget.',
    sections: {
      nativeApi: 'API nativa',
      nativeApiDesc: 'Funciona en navegadores Chromium. Haga clic en el cuentagotas y luego en cualquier píxel de la pantalla.',
      inPageFallback: 'Alternativa en la página',
      inPageFallbackDesc: 'Pase un elemento destino mediante [fallbackTarget]. Funciona en Firefox / Safari donde la API nativa no está disponible.',
      disabled: 'Desactivado',
    },
    buttons: {
      pickPixel: 'Elegir un píxel',
      sampleFromImage: 'Muestra de imagen',
    },
  },
  ja: {
    code: 'ja',
    title: 'スポイト',
    description: 'ネイティブ window.EyeDropper API を優先し、fallbackTarget で渡した <img>、<canvas>、<video> 要素に対してキャンバスベースのサンプリングにフォールバックするスタンドアロンピッカーです。',
    sections: {
      nativeApi: 'ネイティブ API',
      nativeApiDesc: 'Chromiumベースのブラウザで動作します。スポイトをクリックして、画面上の任意のピクセルをクリックしてください。',
      inPageFallback: 'ページ内フォールバック',
      inPageFallbackDesc: '[fallbackTarget] でターゲット要素を渡します。ネイティブ API が使用できない Firefox / Safari で動作します。',
      disabled: '無効',
    },
    buttons: {
      pickPixel: 'ピクセルを選択',
      sampleFromImage: '画像からサンプリング',
    },
  },
  zh: {
    code: 'zh',
    title: '取色器',
    description: '独立取色器，优先使用原生 window.EyeDropper API，并对通过 fallbackTarget 传递的 <img>、<canvas> 或 <video> 元素回退到基于 canvas 的采样。',
    sections: {
      nativeApi: '原生 API',
      nativeApiDesc: '适用于基于 Chromium 的浏览器。单击吸管，然后单击屏幕上的任意像素。',
      inPageFallback: '页内回退',
      inPageFallbackDesc: '通过 [fallbackTarget] 传递目标元素。在原生 API 不可用的 Firefox / Safari 中有效。',
      disabled: '禁用',
    },
    buttons: {
      pickPixel: '选取像素',
      sampleFromImage: '从图像采样',
    },
  },
  ru: {
    code: 'ru',
    title: 'Пипетка',
    description: 'Автономная пипетка, которая предпочитает нативный API window.EyeDropper и откатывается к canvas-семплированию для элементов <img>, <canvas> или <video>, переданных через fallbackTarget.',
    sections: {
      nativeApi: 'Нативный API',
      nativeApiDesc: 'Работает в браузерах на базе Chromium. Нажмите на пипетку, затем на любой пиксель на экране.',
      inPageFallback: 'Резервный вариант на странице',
      inPageFallbackDesc: 'Передайте целевой элемент через [fallbackTarget]. Работает в Firefox / Safari, где нативный API недоступен.',
      disabled: 'Отключено',
    },
    buttons: {
      pickPixel: 'Выбрать пиксель',
      sampleFromImage: 'Образец из изображения',
    },
  },
  pt: {
    code: 'pt',
    title: 'Conta-gotas',
    description: 'Seletor independente que prefere a API nativa window.EyeDropper e recorre à amostragem de canvas em elementos <img>, <canvas> ou <video> passados via fallbackTarget.',
    sections: {
      nativeApi: 'API nativa',
      nativeApiDesc: 'Funciona em navegadores Chromium. Clique no conta-gotas e depois em qualquer pixel da tela.',
      inPageFallback: 'Fallback na página',
      inPageFallbackDesc: 'Passe um elemento alvo via [fallbackTarget]. Funciona no Firefox / Safari onde a API nativa não está disponível.',
      disabled: 'Desativado',
    },
    buttons: {
      pickPixel: 'Escolher um pixel',
      sampleFromImage: 'Amostra da imagem',
    },
  },
};
