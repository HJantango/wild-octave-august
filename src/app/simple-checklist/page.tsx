'use client';

import { useState, useEffect } from 'react';

const checklistData = [
  {
    id: 'kitchen_template',
    name: 'Kitchen & Back Tasks',
    section: 'kitchen',
    items: [
      { id: 'k1', title: 'Clean cooking utensils', frequency: 'daily', specificDays: [] },
      { id: 'k2', title: 'Pull out dishwasher', frequency: 'daily', specificDays: [] },
      { id: 'k3', title: 'Sweep/Mop floors', frequency: 'daily', specificDays: [] },
      { id: 'k4', title: 'Clean all surfaces', frequency: 'daily', specificDays: [] },
      { id: 'k5', title: 'Clean smoothie/juice machine', frequency: 'daily', specificDays: [] },
      { id: 'k6', title: 'Sink/dishes clear', frequency: 'daily', specificDays: [] },
      { id: 'k7', title: 'Boxes from back in kitchen before lock up', frequency: 'daily', specificDays: [] },
      { id: 'k8', title: 'Back door locked', frequency: 'daily', specificDays: [] },
      { id: 'k9', title: 'Eco refills system 33', frequency: 'daily', specificDays: [] },
      { id: 'k10', title: 'Clean behind kitchen fridges', frequency: 'weekly', specificDays: ['Wednesday'] },
      { id: 'k11', title: 'Clean toilets', frequency: 'weekly', specificDays: ['Wednesday', 'Saturday'] },
      { id: 'k12', title: 'Back crates cleaned/concrete swept/hosed, drain cleared', frequency: 'weekly', specificDays: ['Sunday'] },
      { id: 'k13', title: 'Cutlery canisters wash properly', frequency: 'weekly', specificDays: ['Sunday'] },
      { id: 'k14', title: 'Bins emptied', frequency: 'weekly', specificDays: ['Sunday'] }
    ]
  },
  {
    id: 'front_template',
    name: 'Front of House Tasks',
    section: 'front',
    items: [
      { id: 'f1', title: 'Clean bulk section', frequency: 'daily', specificDays: [] },
      { id: 'f2', title: 'Restock drinks fridge', frequency: 'daily', specificDays: [] },
      { id: 'f3', title: 'Clean cool room', frequency: 'daily', specificDays: [] },
      { id: 'f4', title: 'Clean Office', frequency: 'daily', specificDays: [] },
      { id: 'f5', title: 'Clean under coffee machine', frequency: 'daily', specificDays: [] },
      { id: 'f6', title: 'Fridge dates', frequency: 'daily', specificDays: [] },
      { id: 'f7', title: 'Fridge Temps', frequency: 'daily', specificDays: [] },
      { id: 'f8', title: 'Clean dry store', frequency: 'daily', specificDays: [] },
      { id: 'f9', title: 'Clean make-up shelves', frequency: 'daily', specificDays: [] },
      { id: 'f10', title: 'Clean under make-up shelves', frequency: 'daily', specificDays: [] },
      { id: 'f11', title: 'Sweep/Mop floors', frequency: 'daily', specificDays: [] },
      { id: 'f12', title: 'Deep clean tables and chairs', frequency: 'daily', specificDays: [] },
      { id: 'f13', title: 'Clean liquid bulk area and buckets', frequency: 'daily', specificDays: [] },
      { id: 'f14', title: 'Wrap cold display food', frequency: 'daily', specificDays: [] },
      { id: 'f15', title: 'Clean/wipe cold display', frequency: 'daily', specificDays: [] },
      { id: 'f16', title: 'Clean pie machine', frequency: 'daily', specificDays: [] },
      { id: 'f17', title: 'Pull cafe window closed, lock', frequency: 'daily', specificDays: [] },
      { id: 'f18', title: 'Sauces, cutlery etc inside', frequency: 'daily', specificDays: [] },
      { id: 'f19', title: 'Bring tables inside', frequency: 'weekly', specificDays: ['Sunday'] },
      { id: 'f20', title: 'Clean top fridges', frequency: 'weekly', specificDays: ['Sunday'] },
      { id: 'f21', title: 'Put away fruit & veg -> coolroom', frequency: 'weekly', specificDays: ['Sunday'] },
      { id: 'f22', title: 'Lock all doors', frequency: 'weekly', specificDays: ['Sunday'] },
      { id: 'f23', title: 'Bins emptied - 2 x front, office', frequency: 'weekly', specificDays: ['Sunday'] },
      { id: 'f24', title: 'Clean fruit & veg fridge', frequency: 'weekly', specificDays: ['Sunday'] },
      { id: 'f25', title: 'Clean fruit & veg shelves', frequency: 'weekly', specificDays: ['Sunday'] }
    ]
  },
  {
    id: 'barista_template',
    name: 'Barista Tasks',
    section: 'barista',
    items: [
      { id: 'b1', title: 'Clean coffee machine', frequency: 'daily', specificDays: [] },
      { id: 'b2', title: 'Empty coffee grounds', frequency: 'daily', specificDays: [] },
      { id: 'b3', title: 'Wipe down counter', frequency: 'daily', specificDays: [] },
      { id: 'b4', title: 'Restock cups and lids', frequency: 'daily', specificDays: [] },
      { id: 'b5', title: 'Clean milk steamer', frequency: 'daily', specificDays: [] },
      { id: 'b6', title: 'Deep clean espresso machine', frequency: 'weekly', specificDays: ['Saturday'] },
      { id: 'b7', title: 'Descale coffee machine', frequency: 'weekly', specificDays: ['Monday'] }
    ]
  }
];

export default function SimpleChecklistPage() {
  const [weeklyData, setWeeklyData] = useState<any>(null);

  const getSectionIcon = (section: string) => {
    const icons: { [key: string]: string } = {
      kitchen: '🍳',
      front: '🏪',
      barista: '☕'
    };
    return icons[section] || '📋';
  };

  const buildWeeklyData = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday

    const weeklyData: any = {
      weekStart: startOfWeek.toISOString().split('T')[0],
      weekEnd: new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      days: []
    };

    // Build 7 days
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const sections: any[] = [];

      // Process each template/section
      checklistData.forEach(template => {
        const sectionItems: any[] = [];

        template.items.forEach(item => {
          let shouldInclude = false;

          if (item.frequency === 'daily') {
            shouldInclude = true;
          } else if (item.frequency === 'weekly' && item.specificDays?.length > 0) {
            shouldInclude = item.specificDays.includes(dayName);
          }

          if (shouldInclude) {
            sectionItems.push(item);
          }
        });

        if (sectionItems.length > 0) {
          sections.push({
            id: template.id,
            name: template.name,
            section: template.section,
            items: sectionItems
          });
        }
      });

      weeklyData.days.push({
        date: currentDate.toISOString().split('T')[0],
        dayName,
        sections
      });
    }

    setWeeklyData(weeklyData);
  };

  const printWeek = () => {
    window.print();
  };

  useEffect(() => {
    buildWeeklyData();
  }, []);

  return (
    <div>
      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page { 
              size: A4; 
              margin: 15mm; 
            }
            
            body { 
              margin: 0; 
              padding: 0; 
              font-family: Arial; 
              font-size: 6px; 
              line-height: 1.1; 
              color: black;
              background: white;
            }
            
            * { 
              margin: 0; 
              padding: 0; 
              border: none; 
              background: transparent;
            }
            
            .no-print { display: none; }
            
            .print-page { 
              page-break-before: always; 
              page-break-after: always; 
            }
            
            .print-page:first-child { 
              page-break-before: auto; 
            }
            
            .day-header { 
              text-align: center; 
              margin-bottom: 8px; 
            }
            
            .day-title { 
              font-size: 12px; 
              font-weight: bold; 
            }
            
            .day-date { 
              font-size: 7px; 
            }
            
            .section { 
              margin-bottom: 6px; 
            }
            
            .section-title { 
              font-size: 8px; 
              font-weight: bold; 
              margin-bottom: 2px; 
            }
            
            .task { 
              font-size: 6px; 
              margin-bottom: 1px; 
            }
          }
        `
      }} />

      {/* Header */}
      <div className="no-print" style={{ padding: '20px', textAlign: 'center', background: '#2563eb', color: 'white', margin: '20px', borderRadius: '8px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>📋 Simple Checklist (New Page)</h1>
        <p>Ultra-minimal print layout - no caching issues</p>
        <button 
          onClick={printWeek}
          style={{
            background: 'white',
            color: '#2563eb',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: '16px'
          }}
        >
          🖨️ Print 7 Days (Simple)
        </button>
      </div>

      {/* Print Content */}
      {weeklyData && weeklyData.days.map((day: any, dayIndex: number) => (
        <div 
          key={day.date}
          className="print-page"
          style={{ 
            display: 'none',
            pageBreakBefore: dayIndex > 0 ? 'always' : 'auto'
          }}
        >
          <div className="day-header">
            <div className="day-title">{day.dayName}</div>
            <div className="day-date">
              {new Date(day.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
          </div>

          {day.sections.map((section: any) => (
            <div key={section.id} className="section">
              <div className="section-title">
                {getSectionIcon(section.section)} {section.name}
              </div>
              {section.items.map((item: any) => (
                <div key={item.id} className="task">
                  ☐ {item.title}
                </div>
              ))}
            </div>
          ))}
          
          <div style={{ position: 'fixed', bottom: '10mm', width: '100%', textAlign: 'center', fontSize: '5px' }}>
            Wild Octave - {day.dayName} - Page {dayIndex + 1}/7
          </div>
        </div>
      ))}
      
      {/* Screen view for testing */}
      <div className="no-print" style={{ padding: '20px' }}>
        <h2>Screen Preview (Print shows different minimal layout):</h2>
        {weeklyData && weeklyData.days.map((day: any) => (
          <div key={day.date} style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '10px' }}>
            <h3>{day.dayName}</h3>
            {day.sections.map((section: any) => (
              <div key={section.id}>
                <h4>{section.name} ({section.items.length} tasks)</h4>
                {section.items.slice(0, 3).map((item: any) => (
                  <div key={item.id}>• {item.title}</div>
                ))}
                {section.items.length > 3 && <div>... and {section.items.length - 3} more</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}