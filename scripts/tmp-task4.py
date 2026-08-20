import io

# --- 1. The block template: inline tiles -> <ui-stat-card> ---
p = 'packages/blocks/dashboard/dashboard.component.html'
s = io.open(p, encoding='utf-8', newline='').read()
old = """    @for (stat of stats; track stat.label) {
      <ui-card>
        <ui-card-header>
          <ui-card-description>{{ stat.label }}</ui-card-description>
          <ui-card-title>{{ stat.value }}</ui-card-title>
        </ui-card-header>
        <ui-card-content>
          <ui-badge
            [variant]="stat.positive ? 'default' : 'destructive'"
            [label]="stat.delta" />
        </ui-card-content>
      </ui-card>
    }"""
new = """    @for (stat of stats; track stat.label) {
      <!--
        `trendIcon` is off, and that is deliberate: these tiles record whether a
        change is FAVOURABLE, not which way the number moved. Churn falling by
        0.4% is good news and is badged primary. With no direction to point at,
        an arrow would be decoration at best and wrong at worst — and adding one
        would change how this block renders, which the extraction must not do.
      -->
      <ui-stat-card
        [label]="stat.label"
        [value]="stat.value"
        [delta]="stat.delta"
        [trend]="stat.positive ? 'up' : 'down'"
        [trendIcon]="false" />
    }"""
assert old in s, 'tile markup not found'
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('template ok')

# --- 2. The block component: swap imports ---
p = 'packages/blocks/dashboard/dashboard.component.ts'
s = io.open(p, encoding='utf-8', newline='').read()

old_imp = "import { BadgeComponent } from '../../components/ui/badge';\n"
assert old_imp in s
s = s.replace(old_imp, '', 1)

anchor = "import { BarChartComponent } from '../../components/ui/bar-chart';"
assert anchor in s
s = s.replace(anchor, anchor + "\nimport { StatCardComponent } from '../../components/ui/stat-card';", 1)

old_list = "  imports: [\n    BadgeComponent,\n    BarChartComponent,"
new_list = "  imports: [\n    BarChartComponent,\n    StatCardComponent,"
assert old_list in s
s = s.replace(old_list, new_list, 1)

# CardTitle/Description are still used by the two section cards below the grid.
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('component ok')

# --- 3. T-4's header comment: the glyph claim is no longer true ---
p = 'packages/blocks/dashboard/dashboard.component.spec.ts'
s = io.open(p, encoding='utf-8', newline='').read()
old_c = """ * It deliberately does NOT pin `innerHTML`: the extraction adds a
 * `display: contents` host element and a trend glyph inside the badge, neither
 * of which a reader can see, and an HTML-string snapshot would fail on both
 * while still missing a genuine colour or ordering regression."""
new_c = """ * It deliberately does NOT pin `innerHTML`: the extraction wraps each tile in a
 * `display: contents` host element, which a reader cannot see, and an
 * HTML-string snapshot would fail on that while still missing a genuine colour
 * or ordering regression. (The component can also draw a trend arrow inside the
 * badge; the block passes `trendIcon=false` precisely so it does not, which is
 * what keeps this snapshot honest about the block rendering unchanged.)"""
assert old_c in s
s = s.replace(old_c, new_c, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('spec comment ok')
