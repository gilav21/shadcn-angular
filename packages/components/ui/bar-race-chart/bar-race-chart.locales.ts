import type { LocaleMeta } from '../../lib/i18n';

/** Locale dictionary for `<ui-bar-race-chart>`'s playback controls. */
export interface BarRaceChartLocale extends LocaleMeta {
    play: string;
    pause: string;
    reset: string;
}

export const BAR_RACE_CHART_LOCALES: Record<string, BarRaceChartLocale> = {
    en: { code: 'en', play: 'Play', pause: 'Pause', reset: 'Reset' },
    he: { code: 'he', rtl: true, play: 'הפעל', pause: 'השהה', reset: 'איפוס' },
    ar: { code: 'ar', rtl: true, play: 'تشغيل', pause: 'إيقاف مؤقت', reset: 'إعادة تعيين' },
    de: { code: 'de', play: 'Abspielen', pause: 'Pause', reset: 'Zurücksetzen' },
    fr: { code: 'fr', play: 'Lecture', pause: 'Pause', reset: 'Réinitialiser' },
    es: { code: 'es', play: 'Reproducir', pause: 'Pausar', reset: 'Restablecer' },
    ja: { code: 'ja', play: '再生', pause: '一時停止', reset: 'リセット' },
    zh: { code: 'zh', play: '播放', pause: '暂停', reset: '重置' },
    ru: { code: 'ru', play: 'Воспроизвести', pause: 'Пауза', reset: 'Сбросить' },
    pt: { code: 'pt', play: 'Reproduzir', pause: 'Pausar', reset: 'Redefinir' },
};
