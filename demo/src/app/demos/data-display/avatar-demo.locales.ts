import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface AvatarDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  simpleHeading: string;
  simpleDescription: string;
  user1Alt: string;
  user1Fallback: string;
  user2Fallback: string;
  user3Fallback: string;
}

export const AVATAR_DEMO_LOCALES: Record<string, AvatarDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Avatar',
    description: 'User avatar with image or fallback.',
    simpleHeading: 'Simple Mode (Data-driven)',
    simpleDescription: 'Using src, alt, and fallback inputs.',
    user1Alt: 'shadcn',
    user1Fallback: 'CN',
    user2Fallback: 'JD',
    user3Fallback: 'AB',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'אווטאר',
    description: 'אווטאר משתמש עם תמונה או חלופה.',
    simpleHeading: 'מצב פשוט (מונע נתונים)',
    simpleDescription: 'שימוש בקלטי src, alt ו-fallback.',
    user1Alt: 'shadcn',
    user1Fallback: 'שנ',
    user2Fallback: 'יד',
    user3Fallback: 'אב',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'الصورة الرمزية',
    description: 'صورة رمزية للمستخدم مع صورة أو بديل.',
    simpleHeading: 'الوضع البسيط (مدفوع بالبيانات)',
    simpleDescription: 'استخدام مدخلات src وalt وfallback.',
    user1Alt: 'shadcn',
    user1Fallback: 'شد',
    user2Fallback: 'يد',
    user3Fallback: 'أب',
  },
  de: {
    code: 'de',
    heading: 'Avatar',
    description: 'Benutzeravatar mit Bild oder Fallback.',
    simpleHeading: 'Einfacher Modus (Datengetrieben)',
    simpleDescription: 'src-, alt- und Fallback-Eingaben verwenden.',
    user1Alt: 'shadcn',
    user1Fallback: 'CN',
    user2Fallback: 'JD',
    user3Fallback: 'AB',
  },
  fr: {
    code: 'fr',
    heading: 'Avatar',
    description: "Avatar utilisateur avec image ou solution de repli.",
    simpleHeading: 'Mode simple (orienté données)',
    simpleDescription: "Utiliser les entrées src, alt et fallback.",
    user1Alt: 'shadcn',
    user1Fallback: 'CN',
    user2Fallback: 'JD',
    user3Fallback: 'AB',
  },
  es: {
    code: 'es',
    heading: 'Avatar',
    description: 'Avatar de usuario con imagen o alternativa.',
    simpleHeading: 'Modo simple (basado en datos)',
    simpleDescription: 'Usar entradas src, alt y fallback.',
    user1Alt: 'shadcn',
    user1Fallback: 'CN',
    user2Fallback: 'JD',
    user3Fallback: 'AB',
  },
  ja: {
    code: 'ja',
    heading: 'アバター',
    description: '画像またはフォールバック付きのユーザーアバター。',
    simpleHeading: 'シンプルモード（データ駆動型）',
    simpleDescription: 'src、alt、fallback入力を使用。',
    user1Alt: 'shadcn',
    user1Fallback: 'CN',
    user2Fallback: 'JD',
    user3Fallback: 'AB',
  },
  zh: {
    code: 'zh',
    heading: '头像',
    description: '带图片或备用文字的用户头像。',
    simpleHeading: '简单模式（数据驱动）',
    simpleDescription: '使用 src、alt 和 fallback 输入。',
    user1Alt: 'shadcn',
    user1Fallback: 'CN',
    user2Fallback: 'JD',
    user3Fallback: 'AB',
  },
  ru: {
    code: 'ru',
    heading: 'Аватар',
    description: 'Аватар пользователя с изображением или запасным вариантом.',
    simpleHeading: 'Простой режим (на основе данных)',
    simpleDescription: 'Использование входных данных src, alt и fallback.',
    user1Alt: 'shadcn',
    user1Fallback: 'CN',
    user2Fallback: 'ЙД',
    user3Fallback: 'АБ',
  },
  pt: {
    code: 'pt',
    heading: 'Avatar',
    description: 'Avatar de usuário com imagem ou fallback.',
    simpleHeading: 'Modo simples (orientado por dados)',
    simpleDescription: 'Usando entradas src, alt e fallback.',
    user1Alt: 'shadcn',
    user1Fallback: 'CN',
    user2Fallback: 'JD',
    user3Fallback: 'AB',
  },
};
