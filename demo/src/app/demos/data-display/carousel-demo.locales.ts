import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface CarouselDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  verticalHeading: string;
  slideLabel: string;
}

export const CAROUSEL_DEMO_LOCALES: Record<string, CarouselDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Carousel',
    description: 'A carousel with motion and swipe controls.',
    verticalHeading: 'Vertical Carousel',
    slideLabel: 'Slide',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'קרוסלה',
    description: 'קרוסלה עם תנועה ושליטה בהחלקה.',
    verticalHeading: 'קרוסלה אנכית',
    slideLabel: 'שקופית',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'دوّار',
    description: 'دوّار مع تحكم في الحركة والتمرير.',
    verticalHeading: 'دوّار عمودي',
    slideLabel: 'شريحة',
  },
  de: {
    code: 'de',
    heading: 'Karussell',
    description: 'Ein Karussell mit Bewegungs- und Wischsteuerung.',
    verticalHeading: 'Vertikales Karussell',
    slideLabel: 'Folie',
  },
  fr: {
    code: 'fr',
    heading: 'Carrousel',
    description: 'Un carrousel avec mouvement et contrôles de balayage.',
    verticalHeading: 'Carrousel vertical',
    slideLabel: 'Diapositive',
  },
  es: {
    code: 'es',
    heading: 'Carrusel',
    description: 'Un carrusel con controles de movimiento y deslizamiento.',
    verticalHeading: 'Carrusel vertical',
    slideLabel: 'Diapositiva',
  },
  ja: {
    code: 'ja',
    heading: 'カルーセル',
    description: 'モーションとスワイプコントロール付きのカルーセル。',
    verticalHeading: '縦型カルーセル',
    slideLabel: 'スライド',
  },
  zh: {
    code: 'zh',
    heading: '轮播',
    description: '带有动画和滑动控制的轮播组件。',
    verticalHeading: '垂直轮播',
    slideLabel: '幻灯片',
  },
  ru: {
    code: 'ru',
    heading: 'Карусель',
    description: 'Карусель с анимацией и управлением свайпом.',
    verticalHeading: 'Вертикальная карусель',
    slideLabel: 'Слайд',
  },
  pt: {
    code: 'pt',
    heading: 'Carrossel',
    description: 'Um carrossel com controles de movimento e deslizamento.',
    verticalHeading: 'Carrossel vertical',
    slideLabel: 'Slide',
  },
};
