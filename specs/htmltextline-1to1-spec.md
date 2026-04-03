# HTMLTextLine 1:1 C++ → TypeScript Translation Spec

> **Goal**: Replace our patched TextLine model with exact translations of each C++ function.
> **Source**: `pdf2htmlEX/pdf2htmlEX/src/HTMLTextLine.cc` + `.h` + `HTMLState.h`
> **Target**: `packages/components/lib/pdf-pixel-perfect.ts`

---

## Step 0: Revert to working state

The file currently has broken CID-to-offset + single_space_offset changes. Revert:
- `drawString` → back to literal-space (single-byte only, no CID-to-offset)
- `emitLineContent` → back to map-based offset lookup (no dx accumulation)
- Remove `installedWordSpace` / `installedLetterSpace` from `LineStyleState`
- Remove `spaceAdvance` from `TextState`

**Verify**: 71 tests pass, screenshot shows readable Hebrew text.

---

## Data Structures

### C++ `HTMLTextState` (HTMLState.h:38-61) → TS `TextState`

| C++ field | C++ type | TS field | TS type | Notes |
|-----------|----------|----------|---------|-------|
| `font_info` | `const FontInfo*` | `fontName`, `fontFamily` | string | We store names instead of pointer |
| `font_size` | double | `fontSize` | number | |
| `fill_color` | Color | `fillColor` | string | Hex string |
| `stroke_color` | Color | `strokeColor` | string | Hex string |
| `letter_space` | double | `letterSpace` | number | |
| `word_space` | double | `wordSpace` | number | |
| `vertical_align` | double | `verticalAlign` | number | |

**C++ methods on HTMLTextState:**

#### `single_space_offset()` (HTMLState.h:51-56)
```cpp
double single_space_offset(void) const {
    double offset = word_space + letter_space;
    if(font_info->em_size != 0)
        offset += font_info->space_width * font_size;
    return offset;
}
```
**TS**: Add `spaceWidth` field to TextState (the font's space character width in 1000ths). Compute `single_space_offset` inline during rendering: `wordSpace + letterSpace + (spaceWidth / 1000) * fontSize`.

#### `em_size()` (HTMLState.h:58-60)
```cpp
double em_size(void) const {
    return font_size * (font_info->ascent - font_info->descent);
}
```
**TS**: Already computed as `ts.fontSize * z` in optimization. Add ascent/descent to TextState for accuracy.

---

### C++ `HTMLTextLine::State` (HTMLTextLine.h:38-66) → TS `LineStyleState`

| C++ field | C++ type | TS field | Notes |
|-----------|----------|----------|-------|
| `ids[ID_COUNT]` | long long[8] | Individual `fontId`, `fontSizeId`, etc. | We use named fields |
| `start_idx` | size_t | `startIdx` | |
| `hash_value` | long long | — | Not implemented (greedy uses score instead) |
| `hash_umask` | long long | — | Need to add for word-space optimization |
| `need_close` | bool | — | Handled differently in our span logic |

**C++ methods on State:**

#### `begin()` (HTMLTextLine.cc:564-682)
Our `lineStyleDiffClasses` + span opening. Already close to C++.

#### `end()` (HTMLTextLine.cc:684-688)
Our `</span>` closing. Already matches.

#### `hash()` (HTMLTextLine.cc:690-697)
Not implemented. The C++ uses this for fast state comparison. Our `stateMatchScore` serves the same purpose but differently.

#### `diff()` (HTMLTextLine.cc:699-718)
Our `stateMatchScore` is the inverse (counts matches vs C++ counts differences). Need to align.

#### `umask_by_id()` (HTMLTextLine.cc:720-723)
```cpp
static long long umask_by_id(int id) { return 0xff << (8*id); }
```
**TS**: Add `hashUmask` to LineStyleState. Set `wordSpaceFree` flag (replaces `hash_umask & word_space_umask` check).

---

### C++ `HTMLTextLine::Offset` (HTMLTextLine.h:68-74) → TS `TextLineOffset`

Already matches. One difference:

#### C++ `append_offset` merges at same position (HTMLTextLine.cc:50-69):
```cpp
void HTMLTextLine::append_offset(double width) {
    // find last non-padding position
    size_t text_idx = text.size();
    if(text_idx > 0 && text.back() == 0)
        --text_idx;  // skip padding char

    if(offsets.size() > 0 && offsets.back().start_idx == text_idx)
        offsets.back().width += width;
    else
        offsets.emplace_back(text_idx, width);

    this->width += width;
}
```
**TS**: Our `appendOffset` doesn't merge. Fix to match.

---

## Functions to Translate

### F1: `append_unicodes` (HTMLTextLine.cc:37-48)

```cpp
void HTMLTextLine::append_unicodes(const Unicode * u, int l, double width) {
    if(l == 1) {
        text.push_back(u[0]);
    } else {
        text.push_back(-(long long)decomposed_text.size() - 1);
        decomposed_text.emplace_back(u, u+l);
    }
    this->width += width;
}
```

**Current TS** (`appendUnicodes`): Stores per-char width in `charWidths[]`. C++ does NOT have `charWidths` — it only tracks total `width`.

**Change**: Remove `charWidths` array. Just push code points and accumulate total width. The per-character width is NOT used by C++ at all — it's a deviation we introduced.

---

### F2: `append_offset` (HTMLTextLine.cc:50-69)

See above. Add merge logic for same-position offsets.

---

### F3: `append_state` (HTMLTextLine.cc:71-84)

```cpp
void HTMLTextLine::append_state(const HTMLTextState & text_state) {
    if(states.empty() || states.back().start_idx != text.size()) {
        states.emplace_back();
        states.back().start_idx = text.size();
    }
    (HTMLTextState&)(states.back()) = text_state;
    // Apply font_size_scale for Type3 fonts
    states.back().font_size *= states.back().font_info->font_size_scale;
}
```

**Current TS**: Our `appendState` always creates a new entry. C++ reuses the last entry if at the same position. Fix to match.

---

### F4: `prepare` (HTMLTextLine.cc:319-345)

```cpp
void HTMLTextLine::prepare(void) {
    if(states.empty()) return;
    states.front().ids[State::FONT_ID] = all_manager.font_name.install(states.front().font_info->id);

    double max_ascent = 0;
    double accum_vertical_align = 0;

    for(auto & s : states) {
        s.ids[State::FONT_SIZE_ID] = all_manager.font_size.install(s.font_size);
        s.ids[State::FILL_COLOR_ID] = all_manager.fill_color.install(s.fill_color);
        s.ids[State::STROKE_COLOR_ID] = all_manager.stroke_color.install(s.stroke_color);
        s.ids[State::LETTER_SPACE_ID] = all_manager.letter_space.install(s.letter_space, &s.letter_space);
        s.ids[State::WORD_SPACE_ID] = all_manager.word_space.install(s.word_space, &s.word_space);
        s.ids[State::VERTICAL_ALIGN_ID] = all_manager.vertical_align.install(s.vertical_align);
        s.hash();
        s.hash_umask = 0;

        accum_vertical_align += s.vertical_align;
        double cur_ascent = accum_vertical_align + s.font_info->ascent * s.font_size;
        if(cur_ascent > max_ascent)
            max_ascent = cur_ascent;
    }
    ascent = max_ascent;
    descent = states.front().font_info->descent * states.front().font_size;
}
```

**Key difference**: C++ `install()` has a two-arg form `install(value, &actual_value)` that snaps the value to an existing bucket and writes back the INSTALLED value. Our `NumericStateManager.install()` only returns the ID, doesn't write back.

**Change needed**: Add `installAndGet(value): { id: number; installedValue: number }` to `NumericStateManager` that returns both the ID and the snapped value. Use this for letter_space and word_space so the INSTALLED values are available for `single_space_offset` computation.

---

### F5: `optimize_normal` (HTMLTextLine.cc:363-540) — FULL REWRITE

This is the most critical function. Line-by-line translation:

```
363: void HTMLTextLine::optimize_normal(vector<HTMLTextLine*> & lines)
364: {
365:     // remove useless states at end
366-367: while(states.back().start_idx >= text.size()) states.pop_back();
369:     assert(!states.empty());
371:     const word_space_umask = State::umask_by_id(State::WORD_SPACE_ID);
373-375: auto & ls_manager, ws_manager (references to letter_space and word_space managers)
378:     map<double, size_t> width_map;
380:     vector<Offset> new_offsets;  // <-- KEY: builds NEW offset list
383:     auto offset_iter1 = offsets.begin();
384:     for each state segment:
386-388:     text_idx1, text_idx2, text_count
392-396:     copy any offsets BEFORE this state to new_offsets
398-403:     find offset_iter2 (end of offsets for this state), count offset_count
406-484:     LETTER SPACE OPTIMIZATION:
              - Build width histogram (width_map)
              - Find most_used_width with max count
              - If max_count > text_count/2 AND positive:
                - Install new letter_space = old + most_used_width
                - letter_space_diff = old - new (installed)
                - Rebuild ALL offsets for this segment:
                  For each char position text_idx1..text_idx2:
                    cur_width = existing_offset + letter_space_diff (or just letter_space_diff if no offset)
                    If cur_width != 0: add to new_offsets
              - Else: copy existing offsets unchanged
487-532:     WORD SPACE OPTIMIZATION:
              - Only if NO literal space chars in segment
              - Find most frequent offset >= threshold (with letter_space_diff applied)
              - Set word_space = most_used_width - single_space_offset()
              - Set hash_umask to mark word_space as not free
              - Do NOT modify offset widths
536-537:     swap(offsets, new_offsets)
539:     lines.push_back(this)
```

**TS translation**: Single method `optimizeNormal()` replacing the current 5 helper methods. Must use new_offsets pattern.

---

### F6: `dump_text` inner loop (HTMLTextLine.cc:226-293) — FULL REWRITE of `emitLineContent`

The C++ processes text and offsets in interleaved order:

```
172: double dx = 0;  // accumulated residual
177: size_t cur_text_idx = 0;
179: auto cur_offset_iter = offsets.begin();
180: for each state:
224:     text_idx2 = next state start (or text.size())
227:     while(true):
229:         if offset comes first (cur_offset_iter->start_idx <= cur_text_idx):
235:             target = offset.width + dx
239:             if |target| <= h_eps: skip (actual_offset = 0)
247:             else if word_space is set AND |target - single_space_offset()| <= h_eps:
252:                 emit <span class="_"> </span>  (visible space, CSS word-spacing handles width)
253:                 actual_offset = single_space_offset()
265:             else:
266:                 install target in whitespace manager
272:                 emit <span class="_ _N">[" " if target > threshold]</span>
279:             dx = target - actual_offset
282:         else: (text comes next)
287:             next_text_idx = min(text_idx2, next_offset_start)
290:             dump_chars(cur_text_idx, next_text_idx - cur_text_idx)
291:             cur_text_idx = next_text_idx
```

**Key features to translate**:
1. Interleaved offset/text processing (NOT map lookup)
2. Accumulated `dx` residual
3. `single_space_offset()` matching for visible space recovery
4. `dump_chars` for text output (handles padding chars)

---

### F7: `dump_char` / `dump_chars` (HTMLTextLine.cc:86-138)

```cpp
void HTMLTextLine::dump_char(ostream & out, int pos) {
    int t = text[pos];
    if(t > 0)      // single unicode
        writeUnicodes(out, (Unicode*)&t, 1);
    else if(t < 0) // decomposed (ligature)
        writeUnicodes(out, decomposed_text[-(t+1)]);
    // t == 0: padding, skip
}

void HTMLTextLine::dump_chars(ostream & out, int begin, int len) {
    // If no coverage tracking: dump all
    if(line_state.first_char_index < 0) {
        for(int i = 0; i < len; i++) dump_char(out, begin + i);
        return;
    }
    // With coverage: wrap invisible chars in transparent span
    // ... (covered text detection logic)
}
```

**TS**: Our code does `if (cp > 0) parts.push(escapeHtml(...))`. Close to C++ but missing:
- Decomposed text (ligatures) — not critical for now
- Covered text detection — we skip this (intentionally, it's overly aggressive in C++)

---

### F8: `State::begin` (HTMLTextLine.cc:564-682)

Large function that outputs opening span/div classes. Our `lineStyleDiffClasses` + `buildDivClasses` + `applyGreedyStateChange` cover this. Already close to C++. No rewrite needed unless issues found.

---

### F9: `State::diff` (HTMLTextLine.cc:699-718)

```cpp
int State::diff(const State & s) const {
    long long common_mask = ~(hash_umask | s.hash_umask);
    if((hash_value & common_mask) == (s.hash_value & common_mask))
        return 0;
    int d = 0;
    for(int i = 0; i < HASH_ID_COUNT; ++i) {
        if(common_mask & umask_by_id(i)) {
            if(ids[i] != s.ids[i]) ++d;
        }
    }
    return d;
}
```

Our `stateMatchScore` counts MATCHES (inverse of C++ diff which counts DIFFERENCES). The greedy optimization uses this differently. Need to align with C++ `diff()` approach for correctness.

---

## drawString changes (Step 4, AFTER Steps 1-3)

Convert ALL spaces (single-byte + CID) to padding + offset:
```typescript
if (isSpace || isCidSpace) {
    this.currentLine.appendUnicodes([0], 0); // padding char (code 0)
    this.currentLine.appendOffset(spaceAdvance); // CSS-controlled offset
}
```

This is SAFE after Steps 2-3 because:
- optimize_normal doesn't destroy space offsets (no subtraction)
- emitLineContent recovers visible spaces via single_space_offset matching

---

## Execution Order

| Step | What | Verify |
|------|------|--------|
| 0 | Revert broken changes | 71 tests, readable screenshot |
| 1 | Fix `appendOffset` merge | Tests pass |
| 2 | Rewrite `optimizeNormal` (1:1 C++) | Tests pass, letter-spacing CSS values reasonable |
| 3 | Rewrite `emitLineContent` (1:1 C++) | Tests pass, whitespace span structure matches C++ |
| 4 | Convert spaces to padding+offset | Tests pass, Hebrew words have visible CSS-controlled spaces |
| 5 | Visual verification | Screenshot sanity check, then `/visual-validate` |

---

## What we keep (no changes needed)

- `AllStateManager` and sub-managers — already working
- `FontRegistry` with opentype.js — already working
- `PixelPerfectProcessor` (checkStateChange, prepareTextLine, drawString except space handling) — already working
- `BASE_CSS` — already matches C++
- Content stream tokenizer and utilities — already working
- Page assembly and HTML output — already working

## What we add to `NumericStateManager`

The C++ `install(value, &actual)` writes back the snapped value. We need this for letter_space and word_space so the INSTALLED values are available:

```typescript
installAndGet(value: number): { id: number; installed: number } {
    for (const entry of this.entries) {
        if (Math.abs(entry.value - value) <= this.eps) return { id: entry.id, installed: entry.value };
    }
    const id = this.entries.length;
    this.entries.push({ value, id });
    return { id, installed: value };
}
```
