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

export default function ChecklistBackupPage() {
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
    <div style={{ fontFamily: 'Arial, sans-serif', margin: '20px' }}>
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          
          @page {
            size: A4 portrait;
            margin: 1.2cm;
          }
          
          .print-day-page {
            page-break-before: always;
            min-height: 25cm;
            display: block;
          }
          
          .print-day-page:first-child {
            page-break-before: auto;
          }
          
          .print-day-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid black;
            padding-bottom: 15px;
          }
          
          .print-day-title {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          
          .print-section {
            margin-bottom: 20px;
            border: 2px solid black;
            border-radius: 8px;
            padding: 15px;
            break-inside: avoid;
          }
          
          .print-section-header {
            background: #f5f5f5;
            margin: -15px -15px 15px -15px;
            padding: 12px 15px;
            border-radius: 6px 6px 0 0;
            border-bottom: 2px solid black;
          }
          
          .print-section-title {
            font-size: 20px;
            font-weight: bold;
            margin: 0;
          }
          
          .print-task {
            display: flex;
            align-items: flex-start;
            margin-bottom: 10px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fafafa;
          }
          
          .print-checkbox {
            width: 18px;
            height: 18px;
            border: 2px solid black;
            border-radius: 3px;
            margin-right: 12px;
            margin-top: 1px;
            background: white;
          }
          
          .print-task-title {
            font-size: 14px;
            font-weight: 600;
            line-height: 1.3;
          }
          
          .print-footer {
            position: absolute;
            bottom: 0.5cm;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 8px;
          }
        }
      `}</style>

      {/* Header - Hidden in Print */}
      <div className="no-print" style={{ 
        background: 'linear-gradient(to right, #9333ea, #2563eb, #4338ca)',
        borderRadius: '16px',
        padding: '32px',
        color: 'white',
        marginBottom: '24px'
      }}>
        <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '8px' }}>
          📋 Weekly Checklists (Backup)
        </h1>
        <p>Your complete Wild Octave task lists</p>
      </div>

      {/* Controls */}
      <div className="no-print" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <button 
          onClick={printWeek}
          style={{
            background: '#2563eb',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          🖨️ Print Week (7 Pages)
        </button>
      </div>

      {/* Screen Layout */}
      <div className="no-print">
        {checklistData.map((template) => (
          <div key={template.id} style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            marginBottom: '24px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#f3f4f6',
              padding: '16px',
              borderBottom: '1px solid #ccc'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>
                {getSectionIcon(template.section)} {template.name}
              </h2>
            </div>
            <div style={{ padding: '16px' }}>
              {template.items.map((item) => (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px',
                  marginBottom: '8px',
                  background: '#f9f9f9',
                  borderRadius: '4px'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #333',
                    borderRadius: '3px',
                    marginRight: '12px'
                  }}></div>
                  <div>
                    <div style={{ fontWeight: '500' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {item.frequency === 'daily' ? 'Every day' : 
                       item.frequency === 'weekly' && item.specificDays?.length > 0 ? 
                         `Weekly: ${item.specificDays.join(', ')}` : 
                         item.frequency}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Print Layout */}
      {weeklyData && (
        <div style={{ display: 'none' }} className="print-only">
          {weeklyData.days.map((day: any, dayIndex: number) => (
            <div key={day.date} className="print-day-page">
              <div className="print-day-header">
                <h1 className="print-day-title">{day.dayName}</h1>
                <div style={{ fontSize: '16px', color: '#333' }}>
                  {new Date(day.date).toLocaleDateString('en-US', { 
                    year: 'numeric',
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>

              {day.sections.map((section: any) => (
                <div key={section.id} className="print-section">
                  <div className="print-section-header">
                    <h2 className="print-section-title">
                      {getSectionIcon(section.section)} {section.name}
                    </h2>
                  </div>

                  {section.items.map((item: any) => (
                    <div key={item.id} className="print-task">
                      <div className="print-checkbox"></div>
                      <div className="print-task-title">
                        {item.title}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <div className="print-footer">
                Wild Octave Organics - {day.dayName} - Page {dayIndex + 1} of 7
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}