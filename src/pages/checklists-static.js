import { useState, useEffect } from 'react';
import Link from 'next/link';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday = 1
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export default function ChecklistsStatic() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/checklists-static');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch checklists:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getItemsForDay = (template, dayIndex) => {
    return template.items.filter(item => {
      if (item.frequency === 'daily') return true;
      if (item.frequency === 'specific_days') {
        const dayName = days[dayIndex];
        return item.specificDays && item.specificDays.includes(dayName);
      }
      return false;
    });
  };

  const generatePrintableWeek = () => {
    const weekStart = formatDate(currentWeek);
    const weekData = {
      weekStart,
      templates: templates.map(template => ({
        ...template,
        dailyTasks: days.map((day, index) => ({
          day: dayNames[index],
          items: getItemsForDay(template, index)
        }))
      }))
    };

    // Generate HTML
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Wild Octave Checklists - Week of ${weekStart}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            font-size: 12px;
            line-height: 1.3;
        }
        .week-header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }
        .section { 
            margin-bottom: 40px; 
            page-break-inside: avoid; 
        }
        .section-title { 
            background: #333; 
            color: white; 
            padding: 8px; 
            font-weight: bold; 
            text-align: center;
            font-size: 14px;
        }
        .days-grid { 
            display: grid; 
            grid-template-columns: repeat(7, 1fr); 
            gap: 1px; 
            border: 2px solid #333; 
        }
        .day-column { 
            background: #f5f5f5; 
            min-height: 200px;
            padding: 8px 4px;
        }
        .day-header { 
            font-weight: bold; 
            text-align: center; 
            background: #666;
            color: white;
            padding: 4px;
            margin: -8px -4px 8px -4px;
            font-size: 11px;
        }
        .task-item { 
            margin: 3px 0; 
            font-size: 10px;
            line-height: 1.2;
        }
        .checkbox { 
            margin-right: 4px; 
            transform: scale(1.2);
        }
        .task-text {
            word-wrap: break-word;
        }
        @media print {
            body { margin: 10px; font-size: 10px; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="week-header">
        <h1>Wild Octave Organics - Weekly Checklists</h1>
        <h2>Week of ${weekStart}</h2>
    </div>
    
    ${weekData.templates.map(template => `
    <div class="section">
        <div class="section-title">${template.name}</div>
        <div class="days-grid">
            ${template.dailyTasks.map(dayTasks => `
            <div class="day-column">
                <div class="day-header">${dayTasks.day}</div>
                ${dayTasks.items.map(item => `
                <div class="task-item">
                    <input type="checkbox" class="checkbox">
                    <span class="task-text">${item.title}</span>
                </div>
                `).join('')}
            </div>
            `).join('')}
        </div>
    </div>
    `).join('')}
</body>
</html>`;

    // Create and download
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wild-octave-checklists-${weekStart}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-xl text-gray-600 mb-2">Loading checklists...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-xl text-red-600 mb-2">Error loading checklists</div>
        <div className="text-gray-600 mb-4">{error}</div>
        <button 
          onClick={fetchChecklists}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Wild Octave Checklists</h1>
              <p className="text-gray-600">Weekly task management for shop operations</p>
            </div>
            <Link 
              href="/"
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Generate Weekly Checklist</h2>
              <p className="text-sm text-gray-600">
                Week starting: <span className="font-medium">{formatDate(currentWeek)}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <input
                type="date"
                value={formatDate(currentWeek)}
                onChange={(e) => setCurrentWeek(getWeekStart(new Date(e.target.value)))}
                className="px-3 py-2 border rounded-md text-sm"
              />
              <button
                onClick={generatePrintableWeek}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                📄 Generate Printable Week
              </button>
            </div>
          </div>
        </div>

        {/* Templates Preview */}
        <div className="grid gap-8">
          {templates.map(template => (
            <div key={template.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-800 text-white px-6 py-4">
                <h3 className="text-lg font-semibold">{template.name}</h3>
                <p className="text-gray-300 text-sm">{template.items.length} tasks total</p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-7 gap-4">
                  {dayNames.map((dayName, index) => {
                    const dayTasks = getItemsForDay(template, index);
                    return (
                      <div key={dayName} className="bg-gray-50 rounded-lg p-3">
                        <h4 className="font-medium text-gray-800 text-center mb-3 text-sm">
                          {dayName}
                        </h4>
                        <div className="space-y-2">
                          {dayTasks.map(item => (
                            <div key={item.id} className="text-xs text-gray-700 flex items-start gap-2">
                              <div className="w-3 h-3 border border-gray-400 rounded flex-shrink-0 mt-0.5"></div>
                              <span>{item.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How to Use</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Select a week starting date above</li>
            <li>• Click "Generate Printable Week" to create a lamination-ready HTML file</li>
            <li>• Print the HTML file and laminate for dry-erase marker use</li>
            <li>• Tasks are automatically scheduled based on their frequency rules</li>
          </ul>
        </div>
      </div>
    </div>
  );
}