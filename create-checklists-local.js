const fs = require('fs');
const path = require('path');

// Your checklist data
const checklistData = [
  {
    name: "Kitchen / Back Daily Tasks",
    section: "kitchen",
    items: [
      { title: "Clean cooking utensils", frequency: "daily" },
      { title: "Pull out dishwasher", frequency: "daily" },
      { title: "Sweep / Mop floors", frequency: "daily" },
      { title: "Clean all surfaces", frequency: "daily" },
      { title: "Clean smoothie/juice machine", frequency: "daily" },
      { title: "Sink / dishes clear", frequency: "daily" },
      { title: "Boxes from back in kitchen before lockup", frequency: "daily" },
      { title: "Back door locked", frequency: "daily" },
      { title: "Eco refills system 33", frequency: "daily" },
      { title: "Clean behind kitchen fridges", frequency: "daily" },
      { title: "Bins emptied", frequency: "daily" },
      { title: "Clean toilets", frequency: "specific_days", specificDays: ["wednesday", "saturday"] },
      { title: "Back crates cleaned / concrete swept/hosed, drain cleared", frequency: "specific_days", specificDays: ["wednesday"] },
      { title: "Cutlery canisters wash properly", frequency: "specific_days", specificDays: ["monday"] },
    ]
  },
  {
    name: "Front of House Tasks",
    section: "front",
    items: [
      { title: "Clean bulk section", frequency: "daily" },
      { title: "Restock drinks fridge", frequency: "daily" },
      { title: "Clean cool room", frequency: "daily" },
      { title: "Clean Office", frequency: "daily" },
      { title: "Clean under coffee machine", frequency: "daily" },
      { title: "Fridge dates", frequency: "daily" },
      { title: "Fridge Temps", frequency: "daily" },
      { title: "Clean dry store", frequency: "daily" },
      { title: "Clean make-up shelves", frequency: "daily" },
      { title: "Clean under make-up shelves", frequency: "daily" },
      { title: "Sweep / Mop floors", frequency: "daily" },
      { title: "Deep clean tables and chairs", frequency: "daily" },
      { title: "Clean liquid bulk area and buckets", frequency: "daily" },
      { title: "Wrap cold display food", frequency: "daily" },
      { title: "Clean/wipe cold display", frequency: "daily" },
      { title: "Clean pie machine", frequency: "daily" },
      { title: "Pull cafe window closed, lock", frequency: "daily" },
      { title: "Sauces, cutlery etc inside", frequency: "daily" },
      { title: "Bring tables inside", frequency: "daily" },
      { title: "Clean top fridges", frequency: "daily" },
      { title: "Put away fruit & veg -> coolroom", frequency: "daily" },
      { title: "Lock all doors", frequency: "daily" },
      { title: "Bins emptied - 2x front, office", frequency: "daily" },
      { title: "Clean fruit & veg fridge", frequency: "specific_days", specificDays: ["tuesday"] },
      { title: "Clean fruit & veg shelves", frequency: "specific_days", specificDays: ["thursday"] },
    ]
  },
  {
    name: "Barista Tasks",
    section: "barista",
    items: [
      { title: "Pack down machine, clean properly", frequency: "daily" },
      { title: "Clean coffee bench", frequency: "daily" },
      { title: "Empty Ice bucket", frequency: "daily" },
      { title: "Reset bells - 1x coffee machine, 1x cafe till, 1x door till", frequency: "daily" },
      { title: "Restock cutlery", frequency: "daily" },
      { title: "Clean milk containers, jugs etc", frequency: "daily" },
      { title: "Turn off machine", frequency: "daily" },
    ]
  }
];

function getDayName(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function shouldShowItemForDay(item, dayName) {
  switch (item.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return dayName === 'monday'; // Show weekly tasks on Monday
    case 'specific_days':
      return item.specificDays && item.specificDays.includes(dayName);
    default:
      return true;
  }
}

function generateWeeklyChecklist(weekStart = new Date()) {
  // Get Monday of current week
  const monday = new Date(weekStart);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);

  // Generate 7 days starting from Monday
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDays.push({
      date: date.toISOString().split('T')[0],
      dayName: getDayName(date),
      displayName: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    });
  }

  const sections = checklistData.map(template => ({
    name: template.name,
    section: template.section,
    icon: template.section === 'kitchen' ? '🍳' : template.section === 'front' ? '🏪' : '☕',
    color: template.section === 'kitchen' ? '#fee2e2' : template.section === 'front' ? '#dbeafe' : '#d1fae5',
    items: template.items,
  }));

  return {
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: weekDays[6].date,
    days: weekDays,
    sections: sections,
  };
}

function generatePrintableHTML(weekData) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wild Octave Checklists - Week ${weekData.weekStart}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            font-size: 12px;
        }
        
        .header {
            text-align: center;
            border-bottom: 3px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
        }
        
        .week-dates {
            font-size: 16px;
            margin: 5px 0;
        }
        
        .week-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 8px;
            margin-bottom: 20px;
        }
        
        .day-column {
            border: 2px solid #000;
            padding: 8px;
            min-height: 800px;
            break-inside: avoid;
        }
        
        .day-header {
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 15px;
            padding: 5px;
            background: #f0f0f0;
            border: 1px solid #ccc;
        }
        
        .section {
            margin-bottom: 15px;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
        
        .section-kitchen { background-color: #fee2e2; }
        .section-front { background-color: #dbeafe; }
        .section-barista { background-color: #d1fae5; }
        
        .section-title {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 8px;
            text-align: center;
        }
        
        .task-item {
            display: flex;
            align-items: flex-start;
            margin-bottom: 6px;
            font-size: 10px;
        }
        
        .task-checkbox {
            width: 12px;
            height: 12px;
            border: 1px solid #000;
            margin-right: 6px;
            flex-shrink: 0;
            margin-top: 1px;
        }
        
        .task-text {
            flex: 1;
            line-height: 1.3;
        }
        
        .staff-signature {
            border-bottom: 1px solid #ccc;
            width: 40px;
            height: 12px;
            margin-left: auto;
            flex-shrink: 0;
        }
        
        .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 2px solid #000;
            font-size: 10px;
        }
        
        @media print {
            body { 
                margin: 0; 
                padding: 10px;
                print-color-adjust: exact;
            }
            .week-grid {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌿 Wild Octave Organics - Weekly Checklist 🌿</h1>
        <div class="week-dates">Week of ${weekData.weekStart} to ${weekData.weekEnd}</div>
    </div>
    
    <div class="week-grid">
        ${weekData.days.map(day => {
          return `
            <div class="day-column">
                <div class="day-header">
                    ${day.displayName}
                </div>
                
                ${weekData.sections.map(section => {
                  const tasksForDay = section.items.filter(item => shouldShowItemForDay(item, day.dayName));
                  if (tasksForDay.length === 0) return '';
                  
                  return `
                    <div class="section section-${section.section}">
                        <div class="section-title">${section.icon} ${section.name}</div>
                        ${tasksForDay.map(item => `
                            <div class="task-item">
                                <div class="task-checkbox"></div>
                                <div class="task-text">${item.title}</div>
                                <div class="staff-signature"></div>
                            </div>
                        `).join('')}
                    </div>
                  `;
                }).join('')}
            </div>
          `;
        }).join('')}
    </div>
    
    <div class="footer">
        <p>Wild Octave Organics | Generated: ${new Date().toLocaleDateString()}</p>
        <p>Kitchen: 🍳 ${checklistData[0].items.length} tasks | Front: 🏪 ${checklistData[1].items.length} tasks | Barista: ☕ ${checklistData[2].items.length} tasks</p>
    </div>
</body>
</html>`;
  
  return html;
}

// Generate current week
console.log('📋 Generating Wild Octave Checklists...');

const weekData = generateWeeklyChecklist();
const html = generatePrintableHTML(weekData);

// Create output directory
const outputDir = './checklist-output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Write HTML file
const htmlPath = path.join(outputDir, `checklist-week-${weekData.weekStart}.html`);
fs.writeFileSync(htmlPath, html, 'utf8');

// Write JSON data file
const jsonPath = path.join(outputDir, `checklist-data-${weekData.weekStart}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(weekData, null, 2), 'utf8');

console.log('✅ Checklist files generated:');
console.log(`📄 HTML: ${htmlPath}`);
console.log(`📊 Data: ${jsonPath}`);
console.log('');
console.log('📋 Summary:');
console.log(`   Week: ${weekData.weekStart} to ${weekData.weekEnd}`);
checklistData.forEach(section => {
  const icon = section.section === 'kitchen' ? '🍳' : section.section === 'front' ? '🏪' : '☕';
  console.log(`   ${icon} ${section.name}: ${section.items.length} tasks`);
});
console.log('');
console.log('🖨️  To use:');
console.log('   1. Open the HTML file in your browser');
console.log('   2. Print (Ctrl/Cmd + P)');
console.log('   3. Laminate the printout');
console.log('   4. Use dry-erase markers for daily completion');
console.log('');
console.log('🔄 To generate next week:');
console.log('   node create-checklists-local.js');