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

// ── Palette ────────────────────────────────────────────────────────────────
const PALETTE = [
  { name: 'Lavender', value: '#E8E0F0' },
  { name: 'Sage', value: '#D4E2D4' },
  { name: 'Cream', value: '#F5F0E0' },
  { name: 'Lime', value: '#E8F0D4' },
  { name: 'White', value: '#FFFFFF' },
];

const DARK_GREEN = '#2D5016';

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
function LabelCard({ label, compact }: { label: CafeLabel; compact?: boolean }) {
  const hasDietaryTags = label.vegan || label.glutenFree;

  return (
    <div
      className="label-card relative flex flex-col items-center justify-center text-center overflow-hidden"
      style={{
        backgroundColor: label.bgColor,
        padding: compact ? '24px 20px' : '32px 28px',
        borderRadius: '12px',
        minHeight: compact ? '220px' : '280px',
        width: '100%',
      }}
    >
      {/* Organic script */}
      {label.organic && (
        <p
          style={{
            fontFamily: "'Dancing Script', cursive",
            fontSize: compact ? '22px' : '28px',
            color: DARK_GREEN,
            marginBottom: '2px',
            lineHeight: 1.2,
          }}
        >
          Organic
        </p>
      )}

      {/* Dietary badges row */}
      {hasDietaryTags && (
        <div className="flex items-center justify-center gap-2" style={{ marginBottom: '8px', marginTop: '2px' }}>
          {label.vegan && (
            <span
              style={{
                backgroundColor: DARK_GREEN,
                color: '#fff',
                fontSize: compact ? '9px' : '11px',
                fontWeight: 700,
                padding: '3px 12px',
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
                fontSize: compact ? '9px' : '11px',
                fontWeight: 700,
                padding: '3px 12px',
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

      {/* Item name */}
      <h2
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 800,
          fontSize: compact ? '20px' : '26px',
          color: DARK_GREEN,
          textTransform: 'uppercase',
          lineHeight: 1.15,
          margin: '6px 0 10px',
          letterSpacing: '0.02em',
          maxWidth: '100%',
          wordBreak: 'break-word',
        }}
      >
        {label.name || 'Item Name'}
      </h2>

      {/* Ingredients */}
      {label.ingredients && (
        <p
          style={{
            fontSize: compact ? '9px' : '11px',
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
            fontSize: compact ? '14px' : '18px',
            fontWeight: 800,
            padding: '5px 20px',
            borderRadius: '999px',
            marginTop: '12px',
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

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except print sheet */
          body * {
            visibility: hidden;
          }
          #print-sheet,
          #print-sheet * {
            visibility: visible;
          }
          #print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            padding: 10mm;
          }
          #print-sheet .print-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8mm;
          }
          #print-sheet .label-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>

      <div className="space-y-6 print:hidden">
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
                    <span className="text-sm">Organic</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={vegan}
                      onCheckedChange={(v) => setVegan(v === true)}
                    />
                    <span className="text-sm">Vegan</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={glutenFree}
                      onCheckedChange={(v) => setGlutenFree(v === true)}
                    />
                    <span className="text-sm">Gluten Free</span>
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
                      className="w-9 h-9 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c.value,
                        borderColor: bgColor === c.value ? DARK_GREEN : '#d1d5db',
                        boxShadow: bgColor === c.value ? `0 0 0 2px ${DARK_GREEN}40` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button onClick={addLabel} disabled={!name.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Page
                </Button>
                {labels.length > 0 && (
                  <Button variant="secondary" onClick={clearAll}>
                    <Trash2 className="w-4 h-4 mr-2" />
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
              <div className="max-w-sm mx-auto">
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
                <Button variant="secondary" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handlePrint}>
                  <Download className="w-4 h-4 mr-2" />
                  Generate PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 mb-4">
                Tip: To save as PDF, choose &quot;Save as PDF&quot; in the print dialog destination.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {labels.map((label) => (
                  <div key={label.id} className="relative group">
                    <LabelCard label={label} compact />
                    <button
                      onClick={() => removeLabel(label.id)}
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      title="Remove label"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hidden print-only sheet */}
      <div id="print-sheet" className="hidden print:block" ref={printRef}>
        <div className="print-grid">
          {labels.map((label) => (
            <LabelCard key={label.id} label={label} compact />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
