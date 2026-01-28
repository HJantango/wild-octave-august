'use client';

import { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Printer, Plus, Trash2, Download, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface CafeLabel {
  id: string;
  name: string;
  organic: boolean;
  vegan: boolean;
  glutenFree: boolean;
  ingredients: string;
  price: string;
  bgColor: string;
}

// ── Palette (extracted from reference PDF) ─────────────────────────────────
const PALETTE = [
  { name: 'Lavender', value: '#E2E3F0' },
  { name: 'Sage', value: '#A9D196' },
  { name: 'Cream', value: '#FCF9C1' },
  { name: 'Lime', value: '#D4E8C4' },
  { name: 'White', value: '#FFFFFF' },
];

const DARK_GREEN = '#054921';

// ── Google Fonts (loaded once via <link>) ──────────────────────────────────
function FontLoader() {
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Playfair+Display:wght@700;800;900&display=swap"
    />
  );
}

// ── Single label card (used in preview + print sheet) ──────────────────────
function LabelCard({ label, forPrint }: { label: CafeLabel; forPrint?: boolean }) {
  const hasDietaryTags = label.vegan || label.glutenFree;

  return (
    <div
      className="label-card relative flex flex-col items-center justify-center text-center overflow-hidden"
      style={{
        backgroundColor: label.bgColor,
        padding: forPrint ? '14px 12px' : '36px 32px',
        borderRadius: forPrint ? '0' : '14px',
        minHeight: forPrint ? 'auto' : '320px',
        height: forPrint ? '100%' : 'auto',
        width: '100%',
      }}
    >
      {/* Organic script — ABOVE item name */}
      {label.organic && (
        <p
          style={{
            fontFamily: "'Dancing Script', cursive",
            fontSize: forPrint ? '20px' : '34px',
            color: DARK_GREEN,
            marginBottom: forPrint ? '2px' : '4px',
            lineHeight: 1.2,
          }}
        >
          Organic
        </p>
      )}

      {/* Item name */}
      <h2
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 800,
          fontSize: forPrint ? '24px' : '38px',
          color: DARK_GREEN,
          textTransform: 'uppercase',
          lineHeight: 1.15,
          margin: forPrint ? '4px 0 6px' : '8px 0 12px',
          letterSpacing: '0.02em',
          maxWidth: '100%',
          wordBreak: 'break-word',
        }}
      >
        {label.name || 'Item Name'}
      </h2>

      {/* Dietary badges row — BELOW item name */}
      {hasDietaryTags && (
        <div className="flex items-center justify-center gap-2" style={{ marginBottom: forPrint ? '6px' : '10px' }}>
          {label.vegan && (
            <span
              style={{
                backgroundColor: DARK_GREEN,
                color: '#fff',
                fontSize: forPrint ? '10px' : '13px',
                fontWeight: 700,
                padding: forPrint ? '2px 10px' : '4px 16px',
                borderRadius: '999px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Vegan
            </span>
          )}
          {label.glutenFree && (
            <span
              style={{
                backgroundColor: DARK_GREEN,
                color: '#fff',
                fontSize: forPrint ? '10px' : '13px',
                fontWeight: 700,
                padding: forPrint ? '2px 10px' : '4px 16px',
                borderRadius: '999px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              GF
            </span>
          )}
        </div>
      )}

      {/* Ingredients */}
      {label.ingredients && (
        <p
          style={{
            fontSize: forPrint ? '9px' : '13px',
            color: DARK_GREEN,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            lineHeight: 1.5,
            maxWidth: '90%',
            margin: '0 auto',
            opacity: 0.85,
          }}
        >
          {label.ingredients}
        </p>
      )}

      {/* Price badge */}
      {label.price && (
        <span
          style={{
            backgroundColor: DARK_GREEN,
            color: '#fff',
            fontSize: forPrint ? '14px' : '22px',
            fontWeight: 800,
            padding: forPrint ? '4px 16px' : '6px 24px',
            borderRadius: '999px',
            marginTop: forPrint ? '8px' : '14px',
            display: 'inline-block',
          }}
        >
          ${parseFloat(label.price).toFixed(2)}
        </span>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function CafeLabelsPage() {
  const printRef = useRef<HTMLDivElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [organic, setOrganic] = useState(true);
  const [vegan, setVegan] = useState(false);
  const [glutenFree, setGlutenFree] = useState(false);
  const [ingredients, setIngredients] = useState('');
  const [price, setPrice] = useState('');
  const [bgColor, setBgColor] = useState(PALETTE[0].value);

  // Print sheet
  const [labels, setLabels] = useState<CafeLabel[]>([]);

  const currentLabel: CafeLabel = {
    id: 'preview',
    name,
    organic,
    vegan,
    glutenFree,
    ingredients,
    price,
    bgColor,
  };

  const addLabel = () => {
    if (!name.trim()) return;
    setLabels((prev) => [
      ...prev,
      { ...currentLabel, id: crypto.randomUUID() },
    ]);
    // Reset form
    setName('');
    setIngredients('');
    setPrice('');
  };

  const removeLabel = (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
  };

  const clearAll = () => setLabels([]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <FontLoader />

      {/* Print-only styles — 8 labels per A4 page, filling the space */}
      <style jsx global>{`
        @media print {
          /* Hide the UI, show only print sheet */
          .print\\:hidden,
          .no-print {
            display: none !important;
          }
          #print-sheet {
            display: block !important;
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: white;
            z-index: 99999;
          }
          #print-sheet .print-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-auto-rows: calc(297mm / 4);
            gap: 0;
            padding: 0;
            width: 210mm;
            height: auto;
          }
          #print-sheet .label-card {
            break-inside: avoid;
            page-break-inside: avoid;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
            border: none;
            border-radius: 0;
          }
          /* Crop marks */
          #print-sheet .print-grid {
            position: relative;
          }
          #print-sheet .crop-mark {
            position: absolute;
            background: #000;
            z-index: 10;
          }
          /* Vertical crop marks (center column) */
          #print-sheet .crop-v {
            width: 0.3mm;
            height: 5mm;
            left: 50%;
            transform: translateX(-50%);
          }
          /* Horizontal crop marks (row dividers) */
          #print-sheet .crop-h {
            height: 0.3mm;
            width: 5mm;
          }
          #print-sheet .crop-left { left: -6mm; }
          #print-sheet .crop-right { right: -6mm; }
          #print-sheet .crop-top { top: -6mm; }
          #print-sheet .crop-bottom { bottom: -6mm; }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      <div className="space-y-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cafe Label Maker</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create beautiful food labels for display. Add labels then print or generate PDF.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Form ──────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Label Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Item name */}
              <div>
                <Label htmlFor="item-name">Item Name</Label>
                <Input
                  id="item-name"
                  placeholder="e.g. Strawberry Cheesecake"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-lg"
                />
              </div>

              {/* Dietary tags */}
              <div>
                <Label>Dietary Tags</Label>
                <div className="flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={organic}
                      onCheckedChange={(v) => setOrganic(v === true)}
                    />
                    <span className="text-sm font-medium">Organic</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={vegan}
                      onCheckedChange={(v) => setVegan(v === true)}
                    />
                    <span className="text-sm font-medium">Vegan</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={glutenFree}
                      onCheckedChange={(v) => setGlutenFree(v === true)}
                    />
                    <span className="text-sm font-medium">Gluten Free</span>
                  </label>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <Label htmlFor="ingredients">Ingredients</Label>
                <Textarea
                  id="ingredients"
                  placeholder="e.g. Cashews, coconut cream, strawberries, maple syrup, vanilla"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  rows={3}
                  className="text-base"
                />
              </div>

              {/* Price */}
              <div>
                <Label htmlFor="price">Price (optional)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 8.50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="text-lg"
                />
              </div>

              {/* Background colour */}
              <div>
                <Label>Background Colour</Label>
                <div className="flex items-center gap-3 mt-2">
                  {PALETTE.map((c) => (
                    <button
                      key={c.value}
                      title={c.name}
                      onClick={() => setBgColor(c.value)}
                      className="w-10 h-10 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c.value,
                        borderColor: bgColor === c.value ? DARK_GREEN : '#d1d5db',
                        boxShadow: bgColor === c.value ? `0 0 0 3px ${DARK_GREEN}40` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button onClick={addLabel} disabled={!name.trim()} className="text-base px-6 py-5">
                  <Plus className="w-5 h-5 mr-2" />
                  Add to Page
                </Button>
                {labels.length > 0 && (
                  <Button variant="secondary" onClick={clearAll} className="text-base px-6 py-5">
                    <Trash2 className="w-5 h-5 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Live Preview ──────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto">
                <LabelCard label={currentLabel} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Print Sheet ──────────────────────────────────────────── */}
        {labels.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                Print Sheet ({labels.length} label{labels.length !== 1 ? 's' : ''})
              </CardTitle>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handlePrint} className="text-base">
                  <Printer className="w-5 h-5 mr-2" />
                  Print
                </Button>
                <Button onClick={handlePrint} className="text-base">
                  <Download className="w-5 h-5 mr-2" />
                  Generate PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                8 labels per A4 page (2 columns × 4 rows). To save as PDF, choose &quot;Save as PDF&quot; in the print dialog.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {labels.map((label) => (
                  <div key={label.id} className="relative group">
                    <LabelCard label={label} />
                    <button
                      onClick={() => removeLabel(label.id)}
                      className="absolute top-3 right-3 bg-white/80 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      title="Remove label"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hidden print-only sheet — 2×4 grid filling A4 */}
      <div id="print-sheet" style={{ display: 'none' }} ref={printRef}>
        <div className="print-grid" style={{ position: 'relative' }}>
          {labels.map((label) => (
            <LabelCard key={label.id} label={label} forPrint />
          ))}
          {/* Crop marks — centre column */}
          <div className="crop-mark crop-v crop-top" />
          <div className="crop-mark crop-v crop-bottom" />
          {/* Crop marks — row lines, left side */}
          {[1, 2, 3].map((row) => (
            <div key={`hl-${row}`} className="crop-mark crop-h crop-left" style={{ top: `${(row / 4) * 100}%`, transform: 'translateY(-50%)' }} />
          ))}
          {/* Crop marks — row lines, right side */}
          {[1, 2, 3].map((row) => (
            <div key={`hr-${row}`} className="crop-mark crop-h crop-right" style={{ top: `${(row / 4) * 100}%`, transform: 'translateY(-50%)' }} />
          ))}
          {/* Crop marks — centre column at each row intersection */}
          {[1, 2, 3].map((row) => (
            <div key={`vc-${row}`} className="crop-mark crop-v" style={{ top: `calc(${(row / 4) * 100}% - 2.5mm)` }} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
