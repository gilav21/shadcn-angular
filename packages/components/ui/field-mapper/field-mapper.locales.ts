import type { LocaleMeta } from '../../lib/i18n';

/**
 * Every built-in string `<ui-field-mapper>` shows or announces.
 *
 * Functions where the message interpolates an item's label; labels are user
 * data in any script, so a translation should not assume their direction.
 */
export interface FieldMapperLocale extends LocaleMeta {
    /** Heading over the start list when `startHeading` is not set. */
    startHeading: string;
    /** Heading over the end list when `endHeading` is not set. */
    endHeading: string;
    /** Accessible name of a list's filter box. */
    filterLabel: (heading: string) => string;
    /** Placeholder of a list's filter box. */
    filterPlaceholder: string;
    /** Part of an item's accessible name: what it is linked to. */
    linkedTo: (names: string) => string;
    /** Part of an item's accessible name, and the empty choice of the narrow-layout picker. */
    notLinked: string;
    /** Name of the button that removes the selected line. */
    removeLink: string;
    /** Name of the button that removes one link in the narrow layout. */
    removeLinkTo: (name: string) => string;
    /** Name of the narrow-layout picker that links a start item. */
    pickerLabel: (name: string) => string;
    /** Empty choice of the picker when a start item may hold several links. */
    addLink: string;
    /** Under a list when the filter hides items that are linked to visible ones. */
    hiddenLinked: (count: number) => string;
    /** How to use the lists without a mouse; read as each list's description. */
    instructions: string;
    /** Announced when a link is made. */
    linked: (start: string, end: string) => string;
    /** Announced when a link is removed, including one moved out by `maxLinks`. */
    unlinked: (start: string, end: string) => string;
    /** Announced when an item is picked and waits for a partner. */
    choosing: (name: string, otherList: string) => string;
    /** Announced when a pick or a line selection is dropped. */
    cancelled: string;
    /** Announced when a line is selected. */
    linkSelected: (start: string, end: string) => string;
}

export const FIELD_MAPPER_LOCALES: Record<string, FieldMapperLocale> = {
    en: {
        code: 'en',
        startHeading: 'From',
        endHeading: 'To',
        filterLabel: heading => `Filter ${heading}`,
        filterPlaceholder: 'Filter…',
        linkedTo: names => `linked to ${names}`,
        notLinked: 'Not linked',
        removeLink: 'Remove the link',
        removeLinkTo: name => `Remove the link to ${name}`,
        pickerLabel: name => `Link ${name} to`,
        addLink: 'Add a link…',
        hiddenLinked: count => (count === 1 ? '1 more linked, hidden by the filter' : `${count} more linked, hidden by the filter`),
        instructions: 'Arrow keys move. Enter picks an item; pick one in the other list to link them. Delete removes links. Or drag from the dot.',
        linked: (start, end) => `${start} linked to ${end}`,
        unlinked: (start, end) => `${start} no longer linked to ${end}`,
        choosing: (name, otherList) => `${name} picked. Choose an item in ${otherList} to link it.`,
        cancelled: 'Linking cancelled',
        linkSelected: (start, end) => `Link from ${start} to ${end} selected. Press Delete to remove it.`,
    },
    he: {
        code: 'he',
        rtl: true,
        startHeading: 'מ־',
        endHeading: 'אל',
        filterLabel: heading => `סינון ${heading}`,
        filterPlaceholder: 'סינון…',
        linkedTo: names => `מקושר אל ${names}`,
        notLinked: 'לא מקושר',
        removeLink: 'הסרת הקישור',
        removeLinkTo: name => `הסרת הקישור אל ${name}`,
        pickerLabel: name => `קישור ${name} אל`,
        addLink: 'הוספת קישור…',
        hiddenLinked: count => (count === 1 ? 'עוד פריט מקושר אחד מוסתר בסינון' : `עוד ${count} פריטים מקושרים מוסתרים בסינון`),
        instructions: 'החצים מזיזים. Enter בוחר פריט; בחרו פריט ברשימה השנייה כדי לקשר ביניהם. Delete מסיר קישורים. אפשר גם לגרור מהנקודה.',
        linked: (start, end) => `${start} קושר אל ${end}`,
        unlinked: (start, end) => `${start} כבר לא מקושר אל ${end}`,
        choosing: (name, otherList) => `${name} נבחר. בחרו פריט ב${otherList} כדי לקשר אותו.`,
        cancelled: 'הקישור בוטל',
        linkSelected: (start, end) => `הקישור מ${start} אל ${end} נבחר. הקישו Delete כדי להסיר אותו.`,
    },
    ar: {
        code: 'ar',
        rtl: true,
        startHeading: 'من',
        endHeading: 'إلى',
        filterLabel: heading => `تصفية ${heading}`,
        filterPlaceholder: 'تصفية…',
        linkedTo: names => `مرتبط بـ ${names}`,
        notLinked: 'غير مرتبط',
        removeLink: 'إزالة الربط',
        removeLinkTo: name => `إزالة الربط بـ ${name}`,
        pickerLabel: name => `ربط ${name} بـ`,
        addLink: 'إضافة ربط…',
        hiddenLinked: count => `${count} عناصر مرتبطة أخرى مخفية بالتصفية`,
        instructions: 'تتنقل مفاتيح الأسهم. يختار Enter عنصرًا؛ اختر عنصرًا في القائمة الأخرى لربطهما. يزيل Delete الروابط. أو اسحب من النقطة.',
        linked: (start, end) => `تم ربط ${start} بـ ${end}`,
        unlinked: (start, end) => `${start} لم يعد مرتبطًا بـ ${end}`,
        choosing: (name, otherList) => `تم اختيار ${name}. اختر عنصرًا في ${otherList} لربطه.`,
        cancelled: 'تم إلغاء الربط',
        linkSelected: (start, end) => `تم تحديد الربط من ${start} إلى ${end}. اضغط Delete لإزالته.`,
    },
    de: {
        code: 'de',
        startHeading: 'Von',
        endHeading: 'Nach',
        filterLabel: heading => `${heading} filtern`,
        filterPlaceholder: 'Filtern…',
        linkedTo: names => `verknüpft mit ${names}`,
        notLinked: 'Nicht verknüpft',
        removeLink: 'Verknüpfung entfernen',
        removeLinkTo: name => `Verknüpfung mit ${name} entfernen`,
        pickerLabel: name => `${name} verknüpfen mit`,
        addLink: 'Verknüpfung hinzufügen…',
        hiddenLinked: count => `${count} weitere verknüpft, vom Filter ausgeblendet`,
        instructions: 'Pfeiltasten bewegen. Enter wählt ein Element; wählen Sie eines in der anderen Liste, um sie zu verknüpfen. Entf entfernt Verknüpfungen. Oder vom Punkt aus ziehen.',
        linked: (start, end) => `${start} mit ${end} verknüpft`,
        unlinked: (start, end) => `${start} nicht mehr mit ${end} verknüpft`,
        choosing: (name, otherList) => `${name} gewählt. Wählen Sie ein Element in ${otherList}, um es zu verknüpfen.`,
        cancelled: 'Verknüpfen abgebrochen',
        linkSelected: (start, end) => `Verknüpfung von ${start} nach ${end} ausgewählt. Entf entfernt sie.`,
    },
    fr: {
        code: 'fr',
        startHeading: 'De',
        endHeading: 'Vers',
        filterLabel: heading => `Filtrer ${heading}`,
        filterPlaceholder: 'Filtrer…',
        linkedTo: names => `lié à ${names}`,
        notLinked: 'Non lié',
        removeLink: 'Supprimer le lien',
        removeLinkTo: name => `Supprimer le lien vers ${name}`,
        pickerLabel: name => `Lier ${name} à`,
        addLink: 'Ajouter un lien…',
        hiddenLinked: count => `${count} autre(s) lié(s), masqué(s) par le filtre`,
        instructions: 'Les flèches déplacent. Entrée choisit un élément ; choisissez-en un dans l’autre liste pour les lier. Suppr supprime les liens. Ou faites glisser depuis le point.',
        linked: (start, end) => `${start} lié à ${end}`,
        unlinked: (start, end) => `${start} n’est plus lié à ${end}`,
        choosing: (name, otherList) => `${name} choisi. Choisissez un élément dans ${otherList} pour le lier.`,
        cancelled: 'Liaison annulée',
        linkSelected: (start, end) => `Lien de ${start} vers ${end} sélectionné. Appuyez sur Suppr pour le supprimer.`,
    },
    es: {
        code: 'es',
        startHeading: 'De',
        endHeading: 'A',
        filterLabel: heading => `Filtrar ${heading}`,
        filterPlaceholder: 'Filtrar…',
        linkedTo: names => `vinculado a ${names}`,
        notLinked: 'Sin vincular',
        removeLink: 'Quitar el vínculo',
        removeLinkTo: name => `Quitar el vínculo con ${name}`,
        pickerLabel: name => `Vincular ${name} con`,
        addLink: 'Añadir un vínculo…',
        hiddenLinked: count => `${count} vinculado(s) más, ocultos por el filtro`,
        instructions: 'Las flechas mueven. Intro elige un elemento; elige uno en la otra lista para vincularlos. Supr quita vínculos. O arrastra desde el punto.',
        linked: (start, end) => `${start} vinculado a ${end}`,
        unlinked: (start, end) => `${start} ya no está vinculado a ${end}`,
        choosing: (name, otherList) => `${name} elegido. Elige un elemento en ${otherList} para vincularlo.`,
        cancelled: 'Vinculación cancelada',
        linkSelected: (start, end) => `Vínculo de ${start} a ${end} seleccionado. Pulsa Supr para quitarlo.`,
    },
    ja: {
        code: 'ja',
        startHeading: '元',
        endHeading: '先',
        filterLabel: heading => `${heading} を絞り込む`,
        filterPlaceholder: '絞り込み…',
        linkedTo: names => `${names} にリンク済み`,
        notLinked: 'リンクなし',
        removeLink: 'リンクを削除',
        removeLinkTo: name => `${name} へのリンクを削除`,
        pickerLabel: name => `${name} のリンク先`,
        addLink: 'リンクを追加…',
        hiddenLinked: count => `ほかに ${count} 件のリンク先が絞り込みで非表示`,
        instructions: '矢印キーで移動します。Enter で項目を選び、もう一方のリストで項目を選ぶとリンクします。Delete でリンクを削除します。点からドラッグすることもできます。',
        linked: (start, end) => `${start} を ${end} にリンクしました`,
        unlinked: (start, end) => `${start} と ${end} のリンクを解除しました`,
        choosing: (name, otherList) => `${name} を選びました。${otherList} の項目を選ぶとリンクします。`,
        cancelled: 'リンクを取り消しました',
        linkSelected: (start, end) => `${start} から ${end} へのリンクを選択しました。Delete で削除します。`,
    },
    zh: {
        code: 'zh',
        startHeading: '来源',
        endHeading: '目标',
        filterLabel: heading => `筛选${heading}`,
        filterPlaceholder: '筛选…',
        linkedTo: names => `已关联到 ${names}`,
        notLinked: '未关联',
        removeLink: '移除关联',
        removeLinkTo: name => `移除与 ${name} 的关联`,
        pickerLabel: name => `将 ${name} 关联到`,
        addLink: '添加关联…',
        hiddenLinked: count => `另有 ${count} 个关联项被筛选隐藏`,
        instructions: '方向键移动。Enter 选择一项；在另一个列表中再选一项即可关联。Delete 移除关联。也可以从圆点拖动。',
        linked: (start, end) => `已将 ${start} 关联到 ${end}`,
        unlinked: (start, end) => `${start} 不再关联到 ${end}`,
        choosing: (name, otherList) => `已选择 ${name}。在${otherList}中选择一项以关联。`,
        cancelled: '已取消关联',
        linkSelected: (start, end) => `已选中从 ${start} 到 ${end} 的关联。按 Delete 移除。`,
    },
    ru: {
        code: 'ru',
        startHeading: 'Откуда',
        endHeading: 'Куда',
        filterLabel: heading => `Фильтр: ${heading}`,
        filterPlaceholder: 'Фильтр…',
        linkedTo: names => `связано с ${names}`,
        notLinked: 'Не связано',
        removeLink: 'Удалить связь',
        removeLinkTo: name => `Удалить связь с ${name}`,
        pickerLabel: name => `Связать ${name} с`,
        addLink: 'Добавить связь…',
        hiddenLinked: count => `Ещё связанных, скрытых фильтром: ${count}`,
        instructions: 'Стрелки перемещают. Enter выбирает элемент; выберите элемент в другом списке, чтобы связать их. Delete удаляет связи. Или перетащите от точки.',
        linked: (start, end) => `${start} связано с ${end}`,
        unlinked: (start, end) => `${start} больше не связано с ${end}`,
        choosing: (name, otherList) => `Выбрано: ${name}. Выберите элемент в списке «${otherList}», чтобы связать.`,
        cancelled: 'Связывание отменено',
        linkSelected: (start, end) => `Выбрана связь ${start} — ${end}. Нажмите Delete, чтобы удалить её.`,
    },
    pt: {
        code: 'pt',
        startHeading: 'De',
        endHeading: 'Para',
        filterLabel: heading => `Filtrar ${heading}`,
        filterPlaceholder: 'Filtrar…',
        linkedTo: names => `ligado a ${names}`,
        notLinked: 'Sem ligação',
        removeLink: 'Remover a ligação',
        removeLinkTo: name => `Remover a ligação com ${name}`,
        pickerLabel: name => `Ligar ${name} a`,
        addLink: 'Adicionar ligação…',
        hiddenLinked: count => `Mais ${count} ligado(s), ocultos pelo filtro`,
        instructions: 'As setas movem. Enter escolhe um item; escolha um na outra lista para ligá-los. Delete remove ligações. Ou arraste a partir do ponto.',
        linked: (start, end) => `${start} ligado a ${end}`,
        unlinked: (start, end) => `${start} já não está ligado a ${end}`,
        choosing: (name, otherList) => `${name} escolhido. Escolha um item em ${otherList} para ligá-lo.`,
        cancelled: 'Ligação cancelada',
        linkSelected: (start, end) => `Ligação de ${start} para ${end} selecionada. Prima Delete para removê-la.`,
    },
};
