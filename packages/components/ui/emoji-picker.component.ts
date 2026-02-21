import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    QueryList,
    ViewChildren,
    ViewChild,
    AfterViewInit,
    OnDestroy,
    effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../lib/utils';
import { InputComponent } from './input.component';
import { ScrollAreaComponent } from './scroll-area.component';
import { TooltipDirective } from './tooltip.component';
import { EMOJI_DATA } from './emoji-data';

interface EmojiCategory {
    id: string;
    name: string;
    icon: string;
    emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
    {
        id: 'smileys',
        name: 'Smileys & Emotion',
        icon: '😀',
        emojis: [
            '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
            '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚',
            '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
            '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
            '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
            '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳',
            '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯',
            '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
            '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
            '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺',
            '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽',
            '🙀', '😿', '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝',
            '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡',
            '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💯', '💢', '💥',
            '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤',
        ],
    },
    {
        id: 'people',
        name: 'People & Body',
        icon: '👋',
        emojis: [
            '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
            '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
            '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
            '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
            '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
            '👄', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩',
            '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏',
            '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '🥷', '👷', '🤴', '👸',
            '👳', '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶',
            '🦸', '🦹', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '💆',
            '💇', '🚶', '🧍', '🧎', '🏃', '💃', '🕺', '🕴️', '👯', '🧖',
            '👭', '👫', '👬', '💏', '💑', '👪', '👨‍👩‍👦', '👨‍👩‍👧', '👨‍👩‍👧‍👦', '👨‍👩‍👦‍👦',
        ],
    },
    {
        id: 'animals',
        name: 'Animals & Nature',
        icon: '🐻',
        emojis: [
            '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
            '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊',
            '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉',
            '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌',
            '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂',
            '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀',
            '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆',
            '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒',
            '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙',
            '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓',
            '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨',
            '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🌵', '🎄',
            '🌲', '🌳', '🌴', '🪵', '🌱', '🌿', '☘️', '🍀', '🎍', '🪴',
            '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🪨', '🌾', '💐', '🌷',
            '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜',
            '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙',
            '🌎', '🌍', '🌏', '🪐', '💫', '⭐', '🌟', '✨', '⚡', '☄️',
            '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️',
            '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧',
            '💦', '☔', '☂️', '🌊', '🌫️',
        ],
    },
    {
        id: 'food',
        name: 'Food & Drink',
        icon: '🍔',
        emojis: [
            '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏',
            '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑',
            '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄',
            '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯',
            '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕',
            '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘',
            '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘',
            '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥',
            '🥮', '🍡', '🥟', '🥠', '🥡', '🦀', '🦞', '🦐', '🦑', '🦪',
            '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫',
            '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶',
            '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋',
            '🧃', '🧉', '🧊', '🥢', '🍽️', '🍴', '🥄', '🔪', '🏺',
        ],
    },
    {
        id: 'activities',
        name: 'Activities',
        icon: '⚽',
        emojis: [
            '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
            '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
            '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
            '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️',
            '🤺', '🤾', '🏌️', '🏇', '⛏️', '🧗', '🤽', '🏊', '🚣', '🧘',
            '🏄', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫',
            '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼',
            '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲',
            '♟️', '🎯', '🎳', '🎮', '🎰', '🧩',
        ],
    },
    {
        id: 'travel',
        name: 'Travel & Places',
        icon: '🚗',
        emojis: [
            '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
            '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵',
            '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
            '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇',
            '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸',
            '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🪝',
            '⛽', '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰',
            '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️',
            '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏡', '🏘️',
            '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨',
            '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋',
            '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇',
            '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁',
        ],
    },
    {
        id: 'objects',
        name: 'Objects',
        icon: '💡',
        emojis: [
            '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
            '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
            '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
            '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
            '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴',
            '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛',
            '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱',
            '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️',
            '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️',
            '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠',
            '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿',
            '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑',
            '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞',
            '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊',
            '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌',
            '📥', '📤', '📦', '🏷️', '📪', '📫', '📬', '📭', '📮', '📯',
            '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️',
            '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂',
            '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙',
            '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮',
            '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️',
            '🔍', '🔎', '🔏', '🔐', '🔒', '🔓',
        ],
    },
    {
        id: 'symbols',
        name: 'Symbols',
        icon: '❤️',
        emojis: [
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
            '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
            '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
            '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
            '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
            '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️',
            '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️',
            '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️',
            '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓',
            '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️',
            '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠',
            'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️',
            '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮',
            '🎦', '📶', '🈁', '🔣', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙',
            '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣',
            '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️',
            '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️',
            '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️',
            '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄',
            '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲',
            '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛',
            '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵',
            '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷',
            '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧',
            '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉',
            '🔊', '🔔', '🔕', '📣', '📢', '👁️‍🗨️', '💬', '💭', '🗯️', '♠️',
            '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓',
            '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝',
            '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧',
        ],
    },
    {
        id: 'flags',
        name: 'Flags',
        icon: '🏳️',
        emojis: [
            '🏳️', '🏴', '🏴‍☠️', '🏁', '🚩', '🎌', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇳',
            '🇦🇫', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷',
            '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾',
            '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇻🇬',
            '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶',
            '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬',
            '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰',
            '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇸🇿',
            '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫',
            '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵',
            '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺',
            '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲',
            '🇯🇵', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬',
            '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴',
            '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺',
            '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿',
            '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬',
            '🇳🇺', '🇳🇫', '🇰🇵', '🇲🇰', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸',
            '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦',
            '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇷🇸',
            '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇬🇸', '🇸🇧', '🇸🇴', '🇿🇦',
            '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇵🇲', '🇻🇨',
            '🇸🇩', '🇸🇷', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱',
            '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮',
            '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '🇺🇸', '🇺🇾', '🇺🇿',
            '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼',
        ],
    },
];

@Component({
    selector: 'ui-emoji-picker',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="relative inline-block" [attr.data-slot]="'emoji-picker'">
            <ng-content />
        </div>
    `,
    host: {
        class: 'contents',
        '(document:click)': 'onDocumentClick($event)',
    },
})
export class EmojiPickerComponent {
    open = signal(false);
    closeOnSelect = input(true);
    emojiSelect = output<string>();

    toggle() {
        this.open.update(v => !v);
    }

    show() {
        this.open.set(true);
    }

    hide() {
        this.open.set(false);
    }

    selectEmoji(emoji: string) {
        this.emojiSelect.emit(emoji);
        if (this.closeOnSelect()) {
            this.open.set(false);
        }
    }

    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-slot="emoji-picker"]')) {
            this.hide();
        }
    }
}

@Component({
    selector: 'ui-emoji-picker-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span (click)="onClick($event)" [attr.data-slot]="'emoji-picker-trigger'">
            <ng-content />
        </span>
    `,
    host: { class: 'contents' },
})
export class EmojiPickerTriggerComponent {
    private picker = inject(EmojiPickerComponent, { optional: true });

    onClick(event: MouseEvent) {
        event.stopPropagation();
        this.picker?.toggle();
    }
}

@Component({
    selector: 'ui-emoji-picker-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        ScrollAreaComponent,
        TooltipDirective,
        InputComponent,
    ],
    template: `
        @if (picker?.open()) {
            <div
                [class]="contentClasses()"
                [style]="contentStyles()"
                [attr.data-slot]="'emoji-picker-content'"
                [attr.data-state]="picker?.open() ? 'open' : 'closed'"
            >
                <div class="flex flex-col gap-3">
                    <!-- Search Input -->
                    <div class="relative">
                        <svg
                            class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                        <ui-input
                            type="text"
                            placeholder="Search emojis..."
                            class="pl-8 h-8 text-sm"
                            [ngModel]="searchQuery()"
                            (ngModelChange)="searchQuery.set($event)"
                        />
                    </div>

                    <!-- Category Navigation -->
                    <div class="flex gap-1 pb-2 border-b border-border">
                        @for (category of categories; track category.id) {
                            <button
                                type="button"
                                [uiTooltip]="category.name"
                                [class]="categoryButtonClasses(category.id)"
                                (click)="scrollToCategory(category.id)"
                            >
                                {{ category.icon }}
                            </button>
                        }
                    </div>

                    <!-- Emoji Grid -->
                    <ui-scroll-area class="h-64">
                        <div class="pr-3">
                            @for (category of filteredCategories(); track category.id) {
                                <div
                                    class="mb-4"
                                    [attr.data-category]="category.id"
                                    #categorySection
                                >
                                    <div class="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-popover py-1">
                                        {{ category.name }}
                                    </div>
                                    <div class="grid grid-cols-8 gap-0.5">
                                        @for (emoji of category.emojis; track emoji) {
                                            <button
                                                type="button"
                                                class="size-8 flex items-center justify-center text-xl rounded-md hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                                                (click)="selectEmoji(emoji)"
                                            >
                                                {{ emoji }}
                                            </button>
                                        }
                                    </div>
                                </div>
                            }
                            @if (filteredCategories().length === 0) {
                                <div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                    <span class="text-3xl mb-2">🔍</span>
                                    <span class="text-sm">No emojis found</span>
                                </div>
                            }
                        </div>
                    </ui-scroll-area>
                </div>
            </div>
        }
    `,
    host: { class: 'contents' },
})
export class EmojiPickerContentComponent implements AfterViewInit, OnDestroy {
    picker = inject(EmojiPickerComponent, { optional: true });
    private el = inject(ElementRef);

    class = input('');

    categories = EMOJI_CATEGORIES;
    searchQuery = signal('');
    activeCategory = signal('smileys');

    @ViewChildren('categorySection') categorySections!: QueryList<ElementRef<HTMLElement>>;

    private _scrollArea?: ScrollAreaComponent;
    @ViewChild(ScrollAreaComponent)
    set scrollArea(value: ScrollAreaComponent | undefined) {
        this._scrollArea = value;
        if (value?.viewportRef?.nativeElement) {
            this.setupScrollListener(value.viewportRef.nativeElement);
        } else {
            this.scrollRemoveListener?.();
            this.scrollRemoveListener = null;
        }
    }

    private scrollRemoveListener: (() => void) | null = null;
    private isScrollingProgrammatically = false;

    strategy = input<'absolute' | 'fixed'>('absolute');
    private fixedPosition = signal({ top: 0, left: 0 });

    constructor() {
        effect(() => {
            if (this.picker?.open() && this.strategy() === 'fixed') {
                requestAnimationFrame(() => this.updateFixedPosition());
            }
        });
    }

    ngAfterViewInit() {
        this.categorySections.changes.subscribe(() => {
            this.onScroll();
        });
    }

    ngOnDestroy() {
        this.scrollRemoveListener?.();
    }

    private updateFixedPosition(): void {
        const trigger = this.el.nativeElement.closest('[data-slot="emoji-picker"]')?.querySelector('[data-slot="emoji-picker-trigger"]');
        if (!trigger) return;
        const rect = (trigger as HTMLElement).getBoundingClientRect();
        const pickerWidth = Math.min(320, window.innerWidth - 16);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - pickerWidth - 8));
        const top = Math.min(rect.bottom + 4, window.innerHeight - 380);
        this.fixedPosition.set({ top, left });
    }

    contentClasses = computed(() =>
        cn(
            this.strategy() === 'fixed'
                ? 'fixed z-50 w-80 max-w-[calc(100vw-1rem)] p-3 rounded-md border bg-popover text-popover-foreground shadow-md outline-none overflow-hidden'
                : 'absolute left-0 top-full z-50 mt-1 w-80 p-3 rounded-md border bg-popover text-popover-foreground shadow-md outline-none overflow-hidden',
            'animate-in fade-in-0 zoom-in-95',
            this.class()
        )
    );

    contentStyles = computed(() => {
        if (this.strategy() !== 'fixed') return '';
        const pos = this.fixedPosition();
        return `top:${pos.top}px;left:${pos.left}px;`;
    });

    filteredCategories = computed(() => {
        const query = this.searchQuery().toLowerCase().trim();
        if (!query) {
            return this.categories;
        }

        return this.categories
            .map(category => ({
                ...category,
                emojis: category.emojis.filter(emoji => {
                    if (category.name.toLowerCase().includes(query)) return true;
                    if (emoji.includes(query)) return true;
                    const keywords = EMOJI_DATA[emoji];
                    return keywords?.some(keyword => keyword.toLowerCase().includes(query));
                }),
            }))
            .filter(category => category.emojis.length > 0);
    });

    categoryButtonClasses(categoryId: string) {
        const isActive = this.activeCategory() === categoryId;
        return cn(
            'size-8 flex items-center justify-center text-lg rounded-md transition-colors',
            'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
            isActive && 'bg-accent'
        );
    }

    scrollToCategory(categoryId: string) {
        this.searchQuery.set('');
        this.activeCategory.set(categoryId);
        this.isScrollingProgrammatically = true;

        setTimeout(() => {
            const viewport = this._scrollArea?.viewportRef?.nativeElement;
            const section = this.el.nativeElement.querySelector(
                `[data-category="${categoryId}"]`
            ) as HTMLElement;

            if (section && viewport) {
                const relativeTop = section.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
                const scrollTop = viewport.scrollTop + relativeTop;

                viewport.scrollTo({ top: scrollTop, behavior: 'smooth' });

                setTimeout(() => {
                    this.isScrollingProgrammatically = false;
                }, 800);
            } else {
                this.isScrollingProgrammatically = false;
            }
        });
    }

    private setupScrollListener(viewport: HTMLElement) {
        this.scrollRemoveListener?.();

        const listener = () => this.onScroll();
        viewport.addEventListener('scroll', listener, { passive: true });
        this.scrollRemoveListener = () => viewport.removeEventListener('scroll', listener);

        setTimeout(() => this.onScroll(), 0);
    }

    private onScroll() {
        if (this.isScrollingProgrammatically || !this._scrollArea?.viewportRef?.nativeElement) return;

        const viewport = this._scrollArea.viewportRef.nativeElement;
        const scrollTop = viewport.scrollTop;

        const buffer = 50;

        const sections = this.categorySections.toArray();
        let activeId: string | null = null;

        for (const section of sections) {
            const element = section.nativeElement;
            if (element.offsetTop <= scrollTop + buffer) {
                activeId = element.getAttribute('data-category');
            } else {
                break;
            }
        }

        if (activeId && activeId !== this.activeCategory()) {
            this.activeCategory.set(activeId);
        }
    }

    selectEmoji(emoji: string) {
        this.picker?.selectEmoji(emoji);
    }
}

