import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ChatDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  initialMessage: string;
  simulatedResponse: string;
}

export const CHAT_DEMO_LOCALES: Record<string, ChatDemoLocale> = {
  en: {
    code: 'en',
    title: 'Chat',
    description: 'Conversational UI components.',
    initialMessage: 'Hello! How can I help you today?',
    simulatedResponse: 'I am a simulated AI response. I am streaming this text to demonstrate the real-time capabilities.',
  },
  he: {
    code: 'he', rtl: true,
    title: 'צ\'אט',
    description: 'רכיבי ממשק שיחה.',
    initialMessage: 'שלום! כיצד אוכל לעזור לך היום?',
    simulatedResponse: 'אני תגובת AI מדומה. אני משדר טקסט זה כדי להדגים את יכולות זמן האמת.',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'دردشة',
    description: 'مكوّنات واجهة المحادثة.',
    initialMessage: 'مرحباً! كيف يمكنني مساعدتك اليوم؟',
    simulatedResponse: 'أنا استجابة ذكاء اصطناعي محاكاة. أبث هذا النص لإظهار قدرات الوقت الفعلي.',
  },
  de: {
    code: 'de',
    title: 'Chat',
    description: 'Konversations-UI-Komponenten.',
    initialMessage: 'Hallo! Wie kann ich Ihnen heute helfen?',
    simulatedResponse: 'Ich bin eine simulierte KI-Antwort. Ich streame diesen Text, um die Echtzeit-Fähigkeiten zu demonstrieren.',
  },
  fr: {
    code: 'fr',
    title: 'Chat',
    description: 'Composants d\'interface conversationnelle.',
    initialMessage: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?',
    simulatedResponse: 'Je suis une réponse IA simulée. Je diffuse ce texte pour démontrer les capacités en temps réel.',
  },
  es: {
    code: 'es',
    title: 'Chat',
    description: 'Componentes de interfaz conversacional.',
    initialMessage: '¡Hola! ¿En qué puedo ayudarte hoy?',
    simulatedResponse: 'Soy una respuesta de IA simulada. Estoy transmitiendo este texto para demostrar las capacidades en tiempo real.',
  },
  ja: {
    code: 'ja',
    title: 'チャット',
    description: '会話型UIコンポーネント。',
    initialMessage: 'こんにちは！本日はどのようにお手伝いできますか？',
    simulatedResponse: 'これはシミュレートされたAI応答です。リアルタイム機能を実証するためにこのテキストをストリーミングしています。',
  },
  zh: {
    code: 'zh',
    title: '聊天',
    description: '对话式UI组件。',
    initialMessage: '你好！今天我能帮你什么？',
    simulatedResponse: '我是一个模拟的AI响应。我正在流式传输此文本以展示实时功能。',
  },
  ru: {
    code: 'ru',
    title: 'Чат',
    description: 'Компоненты разговорного интерфейса.',
    initialMessage: 'Привет! Как я могу помочь вам сегодня?',
    simulatedResponse: 'Я — симулированный ответ ИИ. Я стримлю этот текст, чтобы продемонстрировать возможности в реальном времени.',
  },
  pt: {
    code: 'pt',
    title: 'Chat',
    description: 'Componentes de interface conversacional.',
    initialMessage: 'Olá! Como posso ajudá-lo hoje?',
    simulatedResponse: 'Sou uma resposta de IA simulada. Estou transmitindo este texto para demonstrar as capacidades em tempo real.',
  },
};
