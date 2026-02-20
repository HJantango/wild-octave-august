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
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

// ── Screen preview label - PURE INLINE STYLES (no CSS classes) ──────────
function LabelCard({ label }: { label: CafeLabel }) {
  const hasDietaryTags = label.vegan || label.glutenFree;

  return (
    <div style={{
      width: '100%',
      maxWidth: '300px',
      aspectRatio: '100/71.75',
      backgroundColor: label.bgColor,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '20px',
      borderRadius: '8px',
      boxSizing: 'border-box',
    }}>
      {label.organic && (
        <p style={{
          fontFamily: "'Dancing Script', cursive",
          fontSize: '20px',
          fontWeight: 600,
          color: DARK_GREEN,
          margin: '0 0 4px 0',
          lineHeight: 1.1,
        }}>Organic</p>
      )}
      
      <h2 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontWeight: 800,
        fontSize: '22px',
        color: DARK_GREEN,
        textTransform: 'uppercase',
        lineHeight: 1,
        margin: '4px 0 20px 0', // BIG gap for screen preview
        letterSpacing: '0.02em',
        maxWidth: '90%',
        wordBreak: 'break-word',
      }}>{label.name || 'Item Name'}</h2>
      
      {hasDietaryTags && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          {label.vegan && (
            <span style={{
              backgroundColor: DARK_GREEN,
              color: 'white',
              padding: '0 12px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              height: '20px',
              lineHeight: '20px', // EXACT match to height - forces perfect centering
              display: 'inline-block',
              textAlign: 'center',
              verticalAlign: 'top',
              fontFamily: 'Arial, sans-serif',
            }}>Vegan</span>
          )}
          {label.glutenFree && (
            <span style={{
              backgroundColor: DARK_GREEN,
              color: 'white', 
              padding: '0 12px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              height: '20px',
              lineHeight: '20px', // EXACT match to height
              display: 'inline-block',
              textAlign: 'center',
              verticalAlign: 'top',
              fontFamily: 'Arial, sans-serif',
            }}>GF</span>
          )}
        </div>
      )}
      
      {label.ingredients && (
        <p style={{
          fontSize: '11px',
          color: DARK_GREEN,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          lineHeight: 1.3,
          maxWidth: '90%',
          margin: '0 0 12px 0',
          opacity: 0.85,
        }}>{label.ingredients}</p>
      )}
      
      {label.price && (
        <span style={{
          backgroundColor: DARK_GREEN,
          color: 'white',
          padding: '0 16px',
          borderRadius: '999px',
          fontSize: '16px',
          fontWeight: 800,
          height: '28px',
          lineHeight: '28px', // EXACT match to height
          display: 'inline-block',
          textAlign: 'center',
          verticalAlign: 'top',
          fontFamily: 'Arial, sans-serif',
        }}>${parseFloat(label.price).toFixed(2)}</span>
      )}
    </div>
  );
}

// ── Print label with INLINE mm styles (bypasses all CSS specificity issues) ──
function PrintLabel({ label, index }: { label: CafeLabel; index: number }) {
  const hasDietaryTags = label.vegan || label.glutenFree;
  
  // Calculate position: 2 columns × 4 rows
  // Each label: 100mm wide × 71.75mm tall
  // Page: 210mm × 297mm with 5mm margins = 200mm × 287mm usable
  const col = index % 2;
  const row = Math.floor(index / 2);
  const left = col * 100; // 0 or 100mm
  const top = row * 71.75; // 0, 71.75, 143.5, 215.25mm

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}mm`,
        top: `${top}mm`,
        width: '100mm',
        height: '71.75mm',
        backgroundColor: label.bgColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '10mm',
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      } as React.CSSProperties}
    >
      {label.organic && (
        <p style={{
          fontFamily: "'Dancing Script', cursive",
          fontSize: '8mm',
          color: DARK_GREEN,
          margin: '0 0 1mm 0',
          lineHeight: 1.1,
        }}>Organic</p>
      )}
      
      <h2 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontWeight: 800,
        fontSize: '8mm',
        color: DARK_GREEN,
        textTransform: 'uppercase',
        lineHeight: 0.95,
        margin: '1mm 0 8mm 0', // Good breathing room - not extreme but noticeable
        letterSpacing: '0.02em',
        maxWidth: '80mm',
        wordBreak: 'break-word',
      }}>{label.name || 'Item Name'}</h2>
      
      {hasDietaryTags && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2mm', marginBottom: '3mm' }}>
          {label.vegan && (
            <span style={{
              backgroundColor: DARK_GREEN,
              padding: '0 3mm',
              borderRadius: '999px', 
              height: '3mm', // Slim but readable
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                color: '#fff',
                fontSize: '2.5mm', // Proportional to 3mm height
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                lineHeight: 1,
              }}>Vegan</span>
            </span>
          )}
          {label.glutenFree && (
            <span style={{
              backgroundColor: DARK_GREEN,
              padding: '0 3mm',
              borderRadius: '999px',
              height: '3mm', // Match the vegan badge
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                color: '#fff',
                fontSize: '2.5mm', // Match vegan badge
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                lineHeight: 1,
              }}>GF</span>
            </span>
          )}
        </div>
      )}
      
      {label.ingredients && (
        <p style={{
          fontSize: '3.5mm',
          color: DARK_GREEN,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          lineHeight: 1.3,
          maxWidth: '80mm',
          margin: 0,
          opacity: 0.85,
        }}>{label.ingredients}</p>
      )}
      
      {label.price && (
        <span style={{
          backgroundColor: DARK_GREEN,
          padding: '0.5mm 4mm', // Match PDF route padding
          borderRadius: '999px',
          marginTop: '3mm',
          height: '5.5mm', // Match PDF route height
          minHeight: '5.5mm',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            color: '#fff',
            fontSize: '4.5mm', // Keep same font size
            fontWeight: 800,
          }}>${parseFloat(label.price).toFixed(2)}</span>
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
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  // Generate PDF - FORCE client-side generation (server-side seems broken on Railway)
  const generatePDF = async () => {
    if (labels.length === 0 || !printRef.current) return;
    
    setGeneratingPdf(true);
    try {
      // SKIP server-side, go straight to client-side with fresh styling
      console.log('Using client-side PDF generation for consistent styling');
      await generatePDFClientSide();
    } catch (clientErr) {
      console.error('Client PDF failed:', clientErr);
      alert('Failed to generate PDF. Please try the Print button instead.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Client-side PDF generation using html2canvas + jsPDF with fresh styling
  const generatePDFClientSide = async () => {
    if (!printRef.current) return;
    
    // Temporarily show the print sheet for capture
    const printSheet = printRef.current;
    const originalDisplay = printSheet.style.display;
    printSheet.style.display = 'block';
    printSheet.style.position = 'fixed';
    printSheet.style.left = '0';
    printSheet.style.top = '0';
    printSheet.style.zIndex = '-9999';
    
    // Force style recalculation to avoid cached styles
    printSheet.style.opacity = '0.99';
    await new Promise(resolve => setTimeout(resolve, 100));
    printSheet.style.opacity = '1';
    
    try {
      // Wait for fonts to load
      await document.fonts.ready;
      
      const canvas = await html2canvas(printSheet, {
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // A4 width at 96dpi
        height: 1123, // A4 height at 96dpi
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      // A4 is 210mm x 297mm
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      pdf.save('cafe-labels.pdf');
    } finally {
      // Restore print sheet visibility
      printSheet.style.display = originalDisplay;
      printSheet.style.position = '';
      printSheet.style.left = '';
      printSheet.style.top = '';
      printSheet.style.zIndex = '';
    }
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

      {/* Label styles for screen and print */}
      <style jsx global>{`
        /* ═══ SCREEN STYLES ═══ */
        .label-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
          padding: 36px 32px;
          border-radius: 14px;
          min-height: 320px;
          width: 100%;
          box-sizing: border-box;
        }
        .label-organic {
          font-family: 'Dancing Script', cursive;
          font-size: 34px;
          color: #054921;
          margin-bottom: 4px;
          line-height: 1.1;
        }
        .label-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 800;
          font-size: 38px;
          color: #054921;
          text-transform: uppercase;
          line-height: 1.15;
          margin: 8px 0 12px;
          letter-spacing: 0.02em;
          max-width: 100%;
          word-break: break-word;
        }
        .label-badges {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .label-badge {
          background-color: #054921;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          padding: 2px 16px;
          border-radius: 999px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .label-ingredients {
          font-size: 13px;
          color: #054921;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          line-height: 1.5;
          max-width: 90%;
          margin: 0 auto;
          opacity: 0.85;
        }
        .label-price {
          background-color: #054921;
          color: #fff;
          font-size: 22px;
          font-weight: 800;
          padding: 6px 24px;
          border-radius: 999px;
          margin-top: 14px;
          display: inline-block;
        }
        
        /* Hide print sheet on screen */
        #print-sheet {
          display: none;
        }
        
        /* ═══ PRINT STYLES ═══ */
        @media print {
          /* Hide everything except print sheet */
          body * {
            visibility: hidden;
          }
          
          #print-sheet,
          #print-sheet * {
            visibility: visible !important;
          }
          
          #print-sheet {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
          
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
                <Button onClick={generatePDF} disabled={generatingPdf} className="text-base">
                  <Download className="w-5 h-5 mr-2" />
                  {generatingPdf ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                8 labels per A4 page (2 columns × 4 rows). Click Download PDF for exact sizing.
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

      {/* Print-only sheet — absolute positioned labels on A4 */}
      <div id="print-sheet" ref={printRef} style={{
        width: '210mm',
        height: '297mm',
        padding: '5mm',
        boxSizing: 'border-box',
        position: 'relative',
        background: 'white',
      }}>
        {/* Labels container - 200mm × 287mm */}
        <div style={{ position: 'relative', width: '200mm', height: '287mm' }}>
          {labels.slice(0, 8).map((label, index) => (
            <PrintLabel key={label.id} label={label} index={index} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
