import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface BentoGridDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  editLayout: string;
  done: string;
  componentsLabel: string;
  dragHint: string;
  widgetMetricTitle: string;
  widgetCalendarTitle: string;
  widgetTeamTitle: string;
  widgetActivityTitle: string;
  metricRevenue: string;
  metricSubscriptions: string;
  metricSales: string;
  metricNewLabel: string;
}

export const BENTO_GRID_DEMO_LOCALES: Record<string, BentoGridDemoLocale> = {
  en: { code: 'en', heading: 'Bento Grid (Dashboard)', description: 'A dashboard builder with drag-and-drop, resizable, and mergeable cells.', editLayout: 'Edit Layout', done: 'Done', componentsLabel: 'Components', dragHint: 'Drag components onto the grid to add them.', widgetMetricTitle: 'Metric Card', widgetCalendarTitle: 'Calendar', widgetTeamTitle: 'Team Members', widgetActivityTitle: 'Activity Feed', metricRevenue: 'Total Revenue', metricSubscriptions: 'Subscriptions', metricSales: 'Sales', metricNewLabel: 'New Metric' },
  he: { code: 'he', rtl: true, heading: 'רשת בנטו (לוח בקרה)', description: 'בונה לוח בקרה עם גרירה-ושחרור, שינוי גודל ומיזוג תאים.', editLayout: 'ערוך פריסה', done: 'סיום', componentsLabel: 'רכיבים', dragHint: 'גרור רכיבים אל הרשת כדי להוסיפם.', widgetMetricTitle: 'כרטיס מדד', widgetCalendarTitle: 'לוח שנה', widgetTeamTitle: 'חברי צוות', widgetActivityTitle: 'פעילות אחרונה', metricRevenue: 'הכנסה כוללת', metricSubscriptions: 'מנויים', metricSales: 'מכירות', metricNewLabel: 'מדד חדש' },
  ar: { code: 'ar', rtl: true, heading: 'شبكة بنتو (لوحة التحكم)', description: 'أداة بناء لوحة تحكم مع خاصية السحب والإفلات وتغيير الحجم ودمج الخلايا.', editLayout: 'تعديل التخطيط', done: 'تم', componentsLabel: 'المكونات', dragHint: 'اسحب المكونات إلى الشبكة لإضافتها.', widgetMetricTitle: 'بطاقة مقياس', widgetCalendarTitle: 'التقويم', widgetTeamTitle: 'أعضاء الفريق', widgetActivityTitle: 'موجز النشاط', metricRevenue: 'إجمالي الإيرادات', metricSubscriptions: 'الاشتراكات', metricSales: 'المبيعات', metricNewLabel: 'مقياس جديد' },
  de: { code: 'de', heading: 'Bento-Raster (Dashboard)', description: 'Ein Dashboard-Builder mit Drag-and-Drop, veränderbarer Größe und zusammenführbaren Zellen.', editLayout: 'Layout bearbeiten', done: 'Fertig', componentsLabel: 'Komponenten', dragHint: 'Komponenten auf das Raster ziehen, um sie hinzuzufügen.', widgetMetricTitle: 'Metrikkarte', widgetCalendarTitle: 'Kalender', widgetTeamTitle: 'Teammitglieder', widgetActivityTitle: 'Aktivitäts-Feed', metricRevenue: 'Gesamtumsatz', metricSubscriptions: 'Abonnements', metricSales: 'Verkäufe', metricNewLabel: 'Neue Metrik' },
  fr: { code: 'fr', heading: 'Grille Bento (Tableau de bord)', description: 'Un créateur de tableau de bord avec glisser-déposer, redimensionnable et cellules fusionnables.', editLayout: 'Modifier la mise en page', done: 'Terminé', componentsLabel: 'Composants', dragHint: 'Faites glisser les composants sur la grille pour les ajouter.', widgetMetricTitle: 'Carte de métrique', widgetCalendarTitle: 'Calendrier', widgetTeamTitle: 'Membres de l\'équipe', widgetActivityTitle: 'Flux d\'activité', metricRevenue: 'Chiffre d\'affaires total', metricSubscriptions: 'Abonnements', metricSales: 'Ventes', metricNewLabel: 'Nouvelle métrique' },
  es: { code: 'es', heading: 'Cuadrícula Bento (Panel)', description: 'Un constructor de paneles con arrastrar y soltar, redimensionable y celdas fusionables.', editLayout: 'Editar diseño', done: 'Listo', componentsLabel: 'Componentes', dragHint: 'Arrastra componentes a la cuadrícula para añadirlos.', widgetMetricTitle: 'Tarjeta de métrica', widgetCalendarTitle: 'Calendario', widgetTeamTitle: 'Miembros del equipo', widgetActivityTitle: 'Feed de actividad', metricRevenue: 'Ingresos totales', metricSubscriptions: 'Suscripciones', metricSales: 'Ventas', metricNewLabel: 'Nueva métrica' },
  ja: { code: 'ja', heading: 'ベントグリッド（ダッシュボード）', description: 'ドラッグ＆ドロップ、サイズ変更、セル結合対応のダッシュボードビルダー。', editLayout: 'レイアウトを編集', done: '完了', componentsLabel: 'コンポーネント', dragHint: 'グリッドにコンポーネントをドラッグして追加します。', widgetMetricTitle: 'メトリックカード', widgetCalendarTitle: 'カレンダー', widgetTeamTitle: 'チームメンバー', widgetActivityTitle: 'アクティビティフィード', metricRevenue: '総収益', metricSubscriptions: 'サブスクリプション', metricSales: '売上', metricNewLabel: '新しいメトリック' },
  zh: { code: 'zh', heading: 'Bento 网格（仪表板）', description: '支持拖放、调整大小和合并单元格的仪表板构建器。', editLayout: '编辑布局', done: '完成', componentsLabel: '组件', dragHint: '将组件拖到网格上以添加它们。', widgetMetricTitle: '指标卡', widgetCalendarTitle: '日历', widgetTeamTitle: '团队成员', widgetActivityTitle: '活动动态', metricRevenue: '总收入', metricSubscriptions: '订阅数', metricSales: '销售额', metricNewLabel: '新指标' },
  ru: { code: 'ru', heading: 'Bento-сетка (Дашборд)', description: 'Конструктор дашбордов с перетаскиванием, изменением размера и слиянием ячеек.', editLayout: 'Редактировать макет', done: 'Готово', componentsLabel: 'Компоненты', dragHint: 'Перетащите компоненты на сетку для добавления.', widgetMetricTitle: 'Карточка метрики', widgetCalendarTitle: 'Календарь', widgetTeamTitle: 'Члены команды', widgetActivityTitle: 'Лента активности', metricRevenue: 'Общий доход', metricSubscriptions: 'Подписки', metricSales: 'Продажи', metricNewLabel: 'Новая метрика' },
  pt: { code: 'pt', heading: 'Grade Bento (Painel)', description: 'Um construtor de painéis com arrastar e soltar, redimensionável e células mescladas.', editLayout: 'Editar layout', done: 'Concluído', componentsLabel: 'Componentes', dragHint: 'Arraste componentes para a grade para adicioná-los.', widgetMetricTitle: 'Cartão de métrica', widgetCalendarTitle: 'Calendário', widgetTeamTitle: 'Membros da equipe', widgetActivityTitle: 'Feed de atividades', metricRevenue: 'Receita total', metricSubscriptions: 'Assinaturas', metricSales: 'Vendas', metricNewLabel: 'Nova métrica' },
};
