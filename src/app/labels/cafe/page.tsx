'use client';

import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Printer, Plus, Trash2, Download, X, Save, Search, FolderOpen } from 'lucide-react';

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

interface LabelTemplate {
  id: string;
  name: string;
  organic: boolean;
  vegan: boolean;
  glutenFree: boolean;
  ingredients: string | null;
  price: string | null;
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

  // For print: labels are ~97mm x 70mm each, so we use proportional sizing
  // Screen preview uses larger sizes for visibility
  return (
    <div
      className="label-card relative flex flex-col items-center justify-center text-center overflow-hidden"
      style={{
        backgroundColor: label.bgColor,
        padding: forPrint ? '8px 12px' : '36px 32px',
        borderRadius: forPrint ? '0' : '14px',
        minHeight: forPrint ? 'auto' : '320px',
        height: forPrint ? '100%' : 'auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Organic script — ABOVE item name */}
      {label.organic && (
        <p
          style={{
            fontFamily: "'Dancing Script', cursive",
            fontSize: forPrint ? '28px' : '34px',
            color: DARK_GREEN,
            marginBottom: forPrint ? '0px' : '4px',
            lineHeight: 1.1,
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
          fontSize: forPrint ? '32px' : '38px',
          color: DARK_GREEN,
          textTransform: 'uppercase',
          lineHeight: 1.1,
          margin: forPrint ? '2px 0 4px' : '8px 0 12px',
          letterSpacing: '0.02em',
          maxWidth: '100%',
          wordBreak: 'break-word',
        }}
      >
        {label.name || 'Item Name'}
      </h2>

      {/* Dietary badges row — BELOW item name */}
      {hasDietaryTags && (
        <div className="flex items-center justify-center gap-2" style={{ marginBottom: forPrint ? '4px' : '10px' }}>
          {label.vegan && (
            <span
              style={{
                backgroundColor: DARK_GREEN,
                color: '#fff',
                fontSize: forPrint ? '12px' : '13px',
                fontWeight: 700,
                padding: forPrint ? '3px 12px' : '4px 16px',
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
                fontSize: forPrint ? '12px' : '13px',
                fontWeight: 700,
                padding: forPrint ? '3px 12px' : '4px 16px',
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
            fontSize: forPrint ? '11px' : '13px',
            color: DARK_GREEN,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            lineHeight: 1.4,
            maxWidth: '95%',
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
            fontSize: forPrint ? '18px' : '22px',
            fontWeight: 800,
            padding: forPrint ? '5px 18px' : '6px 24px',
            borderRadius: '999px',
            marginTop: forPrint ? '6px' : '14px',
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

  // Templates
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch templates on mount and when search changes
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const params = templateSearch ? `?search=${encodeURIComponent(templateSearch)}` : '';
        const res = await fetch(`/api/labels/cafe/templates${params}`);
        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      }
    };
    fetchTemplates();
  }, [templateSearch]);

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

  // Save current label as template
  const saveAsTemplate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/labels/cafe/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          organic,
          vegan,
          glutenFree,
          ingredients,
          price,
          bgColor,
        }),
      });
      if (res.ok) {
        const newTemplate = await res.json();
        setTemplates((prev) => [...prev, newTemplate].sort((a, b) => a.name.localeCompare(b.name)));
        alert('Template saved!');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save template');
      }
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Load template into form
  const loadTemplate = (template: LabelTemplate) => {
    setName(template.name);
    setOrganic(template.organic);
    setVegan(template.vegan);
    setGlutenFree(template.glutenFree);
    setIngredients(template.ingredients || '');
    setPrice(template.price || '');
    setBgColor(template.bgColor);
    setShowTemplates(false);
  };

  // Add template directly to print sheet
  const addTemplateToSheet = (template: LabelTemplate) => {
    setLabels((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: template.name,
        organic: template.organic,
        vegan: template.vegan,
        glutenFree: template.glutenFree,
        ingredients: template.ingredients || '',
        price: template.price || '',
        bgColor: template.bgColor,
      },
    ]);
  };

  // Delete template
  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      const res = await fetch(`/api/labels/cafe/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  return (
    <DashboardLayout>
      <FontLoader />

      {/* Print-only styles — 8 labels per A4 page, edge-to-edge with crop marks */}
      <style jsx global>{`
        @media print {
          /* Hide all page content */
          body * {
            visibility: hidden;
          }
          /* Show only print sheet and its contents */
          #print-sheet,
          #print-sheet * {
            visibility: visible !important;
          }
          #print-sheet {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 8mm !important; /* Small margin for crop marks */
            background: white !important;
            z-index: 999999 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          /* Reset body/html margins */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          #print-sheet .print-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: repeat(4, 1fr);
            gap: 0;
            padding: 0;
            width: 100%; /* 194mm available */
            height: 100%; /* 281mm available */
            box-sizing: border-box;
            position: relative;
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
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box;
            padding: 12px 16px !important;
          }
          /* Crop marks */
          #print-sheet .crop-marks {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
          }
          #print-sheet .crop-mark {
            position: absolute;
            background: black;
          }
          /* Vertical crop mark (center column) */
          #print-sheet .crop-v {
            width: 0.25mm;
            height: 5mm;
            left: 50%;
            transform: translateX(-50%);
          }
          #print-sheet .crop-v.top { top: -7mm; }
          #print-sheet .crop-v.bottom { bottom: -7mm; }
          /* Row crop marks */
          #print-sheet .crop-v.row1 { top: 25%; transform: translate(-50%, -50%); }
          #print-sheet .crop-v.row2 { top: 50%; transform: translate(-50%, -50%); }
          #print-sheet .crop-v.row3 { top: 75%; transform: translate(-50%, -50%); }
          /* Horizontal crop marks */
          #print-sheet .crop-h {
            width: 5mm;
            height: 0.25mm;
          }
          #print-sheet .crop-h.left { left: -7mm; }
          #print-sheet .crop-h.right { right: -7mm; }
          #print-sheet .crop-h.row1 { top: 25%; transform: translateY(-50%); }
          #print-sheet .crop-h.row2 { top: 50%; transform: translateY(-50%); }
          #print-sheet .crop-h.row3 { top: 75%; transform: translateY(-50%); }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>

      <div className="space-y-6 no-print">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cafe Label Maker</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create beautiful food labels for display. Save templates for quick reuse.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            {showTemplates ? 'Hide' : 'Show'} Templates ({templates.length})
          </Button>
        </div>

        {/* ── Saved Templates Panel ──────────────────────────────────── */}
        {showTemplates && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Saved Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {templates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No templates saved yet. Create a label and click &quot;Save as Template&quot;.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="relative group border rounded-lg p-3 hover:border-green-500 cursor-pointer transition-colors"
                      style={{ backgroundColor: template.bgColor + '40' }}
                    >
                      <div onClick={() => loadTemplate(template)}>
                        <p className="font-semibold text-sm truncate" style={{ color: DARK_GREEN }}>
                          {template.name}
                        </p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {template.organic && (
                            <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Organic</span>
                          )}
                          {template.vegan && (
                            <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Vegan</span>
                          )}
                          {template.glutenFree && (
                            <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">GF</span>
                          )}
                        </div>
                        {template.price && (
                          <p className="text-xs text-gray-600 mt-1">${parseFloat(template.price).toFixed(2)}</p>
                        )}
                      </div>
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); addTemplateToSheet(template); }}
                          className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                          title="Add to print sheet"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTemplate(template.id); }}
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                          title="Delete template"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
              <div className="flex flex-wrap gap-3 pt-2">
                <Button onClick={addLabel} disabled={!name.trim()} className="text-base px-6 py-5">
                  <Plus className="w-5 h-5 mr-2" />
                  Add to Page
                </Button>
                <Button
                  variant="outline"
                  onClick={saveAsTemplate}
                  disabled={!name.trim() || saving}
                  className="text-base px-6 py-5"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saving ? 'Saving...' : 'Save as Template'}
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

      {/* Hidden print-only sheet — 2×4 grid filling A4 with crop marks */}
      <div id="print-sheet" style={{ display: 'none' }} ref={printRef}>
        <div className="print-grid">
          {labels.map((label) => (
            <LabelCard key={label.id} label={label} forPrint />
          ))}
        </div>
        {/* Crop marks overlay */}
        <div className="crop-marks">
          {/* Top & bottom center column marks */}
          <div className="crop-mark crop-v top" />
          <div className="crop-mark crop-v bottom" />
          {/* Row divider marks - left side */}
          <div className="crop-mark crop-h left row1" />
          <div className="crop-mark crop-h left row2" />
          <div className="crop-mark crop-h left row3" />
          {/* Row divider marks - right side */}
          <div className="crop-mark crop-h right row1" />
          <div className="crop-mark crop-h right row2" />
          <div className="crop-mark crop-h right row3" />
          {/* Center column marks at row intersections */}
          <div className="crop-mark crop-v row1" />
          <div className="crop-mark crop-v row2" />
          <div className="crop-mark crop-v row3" />
        </div>
      </div>
    </DashboardLayout>
  );
}
