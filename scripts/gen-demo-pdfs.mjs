// Generates the demo example PDFs in demo/public/examples/ by printing
// hand-authored HTML through headless Chromium. All content is fictional and
// authored in-repo, so the PDFs are safe to commit and redistribute.
// Run: node scripts/gen-demo-pdfs.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(import.meta.dirname, '..', 'demo', 'public', 'examples');
mkdirSync(OUT_DIR, { recursive: true });

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; font-size: 11pt; }
  .sans { font-family: Arial, Helvetica, sans-serif; }
`;

const DOCS = {
    'invoice.pdf': `
<style>${BASE_CSS}
  body { font-family: Arial, sans-serif; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 22pt; font-weight: bold; color: #1d4e89; }
  .brand small { display: block; font-size: 9pt; color: #555; font-weight: normal; letter-spacing: 2px; }
  .box { background: #1d4e89; color: #fff; padding: 14pt 18pt; width: 45%; }
  .box h1 { font-size: 16pt; margin-bottom: 4pt; }
  .meta { margin-top: 18pt; font-size: 9.5pt; color: #333; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-top: 22pt; font-size: 10pt; }
  th { text-align: left; border-bottom: 1.5pt solid #1d4e89; padding: 6pt 4pt; color: #1d4e89; }
  td { border-bottom: 0.5pt solid #ccc; padding: 6pt 4pt; }
  .num { text-align: right; }
  .total td { border-bottom: none; font-weight: bold; }
  .total .pill { background: #1d4e89; color: white; padding: 3pt 10pt; }
  .terms { margin-top: 30pt; font-size: 9pt; color: #666; border-top: 0.5pt solid #999; padding-top: 8pt; }
</style>
<div class="top">
  <div>
    <div class="brand">Northwind Roastery<small>SPECIALTY COFFEE · EST. 2011</small></div>
    <div class="meta">14 Harbor Lane, Portside 04101<br>hello&#64;northwind-roastery.example<br>+1 (555) 014-2286</div>
  </div>
  <div class="box">
    <h1>INVOICE #2047</h1>
    <div>Issued: March 4, 2026<br>Due: April 3, 2026</div>
  </div>
</div>
<div class="meta"><strong>Billed to:</strong><br>Cedar &amp; Stone Cafe<br>88 Mill Street, Suite 12<br>Lakewood 04240</div>
<table>
  <tr><th>Item</th><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr>
  <tr><td>ETH-71</td><td>Ethiopia Sidamo, whole bean, 5 lb</td><td class="num">8</td><td class="num">$62.00</td><td class="num">$496.00</td></tr>
  <tr><td>COL-12</td><td>Colombia Huila, whole bean, 5 lb</td><td class="num">6</td><td class="num">$54.00</td><td class="num">$324.00</td></tr>
  <tr><td>DEC-03</td><td>Swiss water decaf, ground, 2 lb</td><td class="num">4</td><td class="num">$31.50</td><td class="num">$126.00</td></tr>
  <tr><td>FLT-20</td><td>Paper filters, case of 500</td><td class="num">2</td><td class="num">$18.00</td><td class="num">$36.00</td></tr>
  <tr><td colspan="4" class="num">Subtotal</td><td class="num">$982.00</td></tr>
  <tr><td colspan="4" class="num">Sales tax (5.5%)</td><td class="num">$54.01</td></tr>
  <tr class="total"><td colspan="4" class="num">Total due</td><td class="num"><span class="pill">$1,036.01</span></td></tr>
</table>
<div class="terms">Payment is due within 30 days. Please reference the invoice number on your transfer.
Wholesale accounts receive free roastery delivery on orders above $500.</div>`,

    'newsletter.pdf': `
<style>${BASE_CSS}
  .masthead { text-align: center; border-bottom: 3pt double #333; padding-bottom: 10pt; }
  .masthead h1 { font-size: 26pt; letter-spacing: 1px; }
  .masthead p { font-size: 9pt; color: #666; margin-top: 4pt; letter-spacing: 3px; }
  h2 { font-size: 15pt; margin: 16pt 0 8pt; }
  .cols { column-count: 2; column-gap: 22pt; margin-top: 8pt; text-align: justify; font-size: 10pt; line-height: 1.5; }
  .cols p { margin-bottom: 8pt; text-indent: 14pt; }
  .pull { border-left: 2.5pt solid #333; margin: 10pt 0 10pt 12pt; padding: 4pt 0 4pt 10pt; font-style: italic; font-size: 11pt; color: #444; }
  ul { margin: 8pt 0 8pt 20pt; }
  li { margin-bottom: 3pt; }
</style>
<div class="masthead"><h1>Field Notes</h1><p>A QUARTERLY ON CITY NATURE · ISSUE 14 · SPRING 2026</p></div>
<h2>The Quiet Art of Urban Beekeeping</h2>
<div class="cols">
<p>On the roof of a converted grain warehouse, four wooden hives face the morning sun. Their keeper, a retired drafting teacher, checks them twice a week with the calm of someone reading a familiar book. The bees, she says, mind the weather far more than they mind the city.</p>
<p>Urban colonies often outperform their rural cousins. Gardens, balconies and street trees bloom in staggered waves, so forage is available from the first crocus to the last aster. The honey changes flavour room by room across the calendar: pale and floral in May, dark and resinous by October.</p>
<div class="pull">“The honey changes flavour room by room across the calendar.”</div>
<p>Getting started costs less than most hobbies that involve smoke. A basic setup asks for three things:</p>
<ul><li>a hive body with frames,</li><li>a veil and gloves,</li><li>patience measured in seasons, not weekends.</li></ul>
<p>City ordinances vary, and most registrars ask only that hives sit a polite distance from property lines. Neighbours, in the keeper's experience, come around quickly — usually at the first jar handed over a fence.</p>
<p>What surprises newcomers most is the sound. Not the buzz itself, but its weather: a contented colony hums low and even, while a queenless one frets in a higher register. Learning to hear the difference takes a summer. After that, she says, you check the hives with your ears first and the smoker second.</p>
</div>`,

    'quarterly-report.pdf': `
<style>${BASE_CSS}
  body { font-family: Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; }
  .head { border-bottom: 2pt solid #0b6e4f; padding-bottom: 8pt; display: flex; justify-content: space-between; align-items: baseline; }
  h1 { font-size: 19pt; color: #0b6e4f; }
  .head span { font-size: 9.5pt; color: #555; }
  h2 { font-size: 13pt; color: #0b6e4f; margin: 16pt 0 6pt; }
  p { margin-bottom: 7pt; }
  ul { margin: 4pt 0 10pt 20pt; }
  li { margin-bottom: 3pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 9.5pt; }
  th, td { border: 0.5pt solid #aaa; padding: 5pt 7pt; text-align: left; }
  th { background: #e8f3ee; color: #0b6e4f; }
  .num { text-align: right; }
  .note { background: #f4f4f4; border-left: 3pt solid #0b6e4f; padding: 8pt 10pt; font-size: 9.5pt; margin-top: 14pt; }
</style>
<div class="head"><h1>Lighthouse Library Network</h1><span>Quarterly Report · Q1 2026</span></div>
<h2>Summary</h2>
<p>Circulation across the six branches grew for the fifth consecutive quarter. The evening
opening pilot at the Dockside branch drew steady after-work traffic, and the tool-lending
shelf — a member suggestion — proved the quarter's most borrowed collection per item held.</p>
<h2>Highlights</h2>
<ul>
  <li>Total loans rose 9% year over year, led by audiobooks and children's titles.</li>
  <li>The seed library returned for spring with 44 varieties, all donated locally.</li>
  <li>Wi-Fi sessions passed 60,000, with a median visit of 41 minutes.</li>
</ul>
<h2>Circulation by branch</h2>
<table>
  <tr><th>Branch</th><th class="num">Loans</th><th class="num">New members</th><th class="num">Events held</th></tr>
  <tr><td>Dockside</td><td class="num">18,420</td><td class="num">312</td><td class="num">22</td></tr>
  <tr><td>Hillcrest</td><td class="num">14,876</td><td class="num">201</td><td class="num">17</td></tr>
  <tr><td>Old Mill</td><td class="num">11,053</td><td class="num">148</td><td class="num">12</td></tr>
  <tr><td>Fairweather</td><td class="num">9,442</td><td class="num">126</td><td class="num">9</td></tr>
</table>
<h2>Next quarter</h2>
<p>The bookmobile route adds two Saturday stops in June. Renovation of the Old Mill reading
room begins in May; loans will continue from the temporary desk in the annex.</p>
<div class="note"><strong>Board note:</strong> the annual budget hearing moves to June 11.
Branch managers should file space requests by May 23.</div>`,

    'hebrew-receipt.pdf': `
<style>${BASE_CSS}
  body { font-family: Arial, sans-serif; direction: rtl; font-size: 12pt; color: #14355e; }
  .head { text-align: center; border-bottom: 1.5pt solid #14355e; padding-bottom: 10pt; }
  .head h1 { font-size: 20pt; }
  .head p { font-size: 10pt; color: #666; margin-top: 3pt; }
  h2 { text-align: center; font-size: 15pt; margin: 18pt 0 4pt; }
  .ok { text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 14pt; }
  .fields { width: 60%; margin: 0 auto; font-size: 11pt; line-height: 2; }
  .fields div { display: flex; justify-content: space-between; border-bottom: 0.5pt dotted #999; }
  .btn { display: inline-block; border: 1pt solid #777; color: #777; padding: 5pt 16pt; margin-top: 22pt; }
  .foot { display: flex; justify-content: space-between; font-size: 8.5pt; color: #555; margin-top: 40pt; border-top: 0.5pt solid #999; padding-top: 6pt; direction: ltr; }
</style>
<div class="head"><h1>קפה הרים בע״מ</h1><p>רחוב האלון 12, נוף הגליל · ח.פ 514000000</p></div>
<h2>אישור תשלום</h2>
<div class="ok">התשלום התקבל בהצלחה!</div>
<p style="text-align:center; font-size:10.5pt; color:#333">לידיעתך, קבלה מסודרת תישלח לכתובת הדואר האלקטרוני הרשומה במערכת בתוך 24 שעות.</p>
<div class="fields">
  <div><span>מספר הזמנה :</span><span>73-105642</span></div>
  <div><span>תאריך :</span><span>04/03/2026</span></div>
  <div><span>אמצעי תשלום :</span><span>ויזה 4211-x</span></div>
  <div><span>סכום לתשלום :</span><span>₪ 148.50</span></div>
  <div><span>מספר אישור :</span><span>ZA 5540912</span></div>
</div>
<div style="text-align:right"><span class="btn">הדפסה</span></div>
<div class="foot"><span>coffee-harim.example/receipts/73-105642</span><span>1/1</span></div>`,

    'registration-form.pdf': `
<style>${BASE_CSS}
  body { font-family: Arial, sans-serif; font-size: 10.5pt; }
  .head { background: #7a3e8f; color: #fff; padding: 14pt 18pt; }
  .head h1 { font-size: 17pt; }
  .head p { font-size: 9.5pt; margin-top: 3pt; }
  h2 { font-size: 12pt; color: #7a3e8f; margin: 18pt 0 8pt; border-bottom: 0.75pt solid #7a3e8f; padding-bottom: 3pt; }
  .row { display: flex; gap: 24pt; margin-bottom: 14pt; }
  .field { flex: 1; }
  .field label { font-size: 8.5pt; color: #555; text-transform: uppercase; letter-spacing: 1px; }
  .field .line { border-bottom: 1pt solid #333; height: 16pt; }
  .choices { margin: 6pt 0 4pt; line-height: 1.9; }
  .choices span { display: inline-block; width: 10pt; height: 10pt; border: 1pt solid #333; margin-right: 6pt; vertical-align: -1pt; }
  .sig { display: flex; gap: 40pt; margin-top: 34pt; text-align: center; }
  .sig div { flex: 1; }
  .sig .line { border-bottom: 1.25pt solid #7a3e8f; height: 22pt; }
  .sig label { font-size: 9pt; color: #7a3e8f; }
  .fine { font-size: 8pt; color: #666; margin-top: 26pt; }
</style>
<div class="head"><h1>Community Workshop Registration</h1>
<p>Maple Hall Makerspace · Spring session · April – June 2026</p></div>
<h2>Participant details</h2>
<div class="row"><div class="field"><label>Full name</label><div class="line"></div></div>
<div class="field"><label>Date of birth</label><div class="line"></div></div></div>
<div class="row"><div class="field"><label>Email</label><div class="line"></div></div>
<div class="field"><label>Phone</label><div class="line"></div></div></div>
<h2>Workshop selection</h2>
<div class="choices">
  <div><span></span> Woodworking fundamentals — Tuesdays, 18:00</div>
  <div><span></span> Ceramics: wheel throwing — Wednesdays, 17:30</div>
  <div><span></span> Intro to letterpress — Thursdays, 18:30</div>
  <div><span></span> Bicycle repair clinic — Saturdays, 10:00</div>
</div>
<h2>Consent</h2>
<p>I confirm the details above are correct and agree to the makerspace safety rules,
which are reviewed together during the first session of every course.</p>
<div class="sig">
  <div><div class="line"></div><label>Participant signature</label></div>
  <div><div class="line"></div><label>Date</label></div>
  <div><div class="line"></div><label>Staff initials</label></div>
</div>
<div class="fine">Maple Hall Makerspace is a fictional venue used for demonstration documents.
Sessions are capped at ten participants; confirmation arrives by email within three days.</div>`,
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, body] of Object.entries(DOCS)) {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`, { waitUntil: 'networkidle' });
    await page.pdf({
        path: join(OUT_DIR, name),
        format: 'A4',
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
        printBackground: true,
    });
    console.log('wrote', name);
}
await browser.close();
