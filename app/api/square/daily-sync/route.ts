// Run this script to find files with incorrect import paths
// node check-imports.js

const fs = require('fs');
const path = require('path');

function findFilesWithIncorrectImports(dir) {
  const results = [];
  
  function searchDirectory(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        searchDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for problematic imports
        const problematicImports = [
          /import.*from\s+['"]\.\/square-sync['"]/,
          /import.*from\s+['"]\.\/db['"]/,
          /import.*from\s+['"]\.\/square-api['"]/
        ];
        
        for (const pattern of problematicImports) {
          if (pattern.test(content)) {
            results.push({
              file: filePath,
              issue: 'Relative import should use @/ prefix',
              content: content.match(pattern)[0]
            });
          }
        }
      }
    }
  }
  
  searchDirectory(dir);
  return results;
}

console.log('Checking for incorrect import paths...\n');

const issues = findFilesWithIncorrectImports('./app');

if (issues.length === 0) {
  console.log('✅ No import path issues found!');
} else {
  console.log('❌ Found import path issues:');
  issues.forEach(issue => {
    console.log(`\nFile: ${issue.file}`);
    console.log(`Issue: ${issue.issue}`);
    console.log(`Found: ${issue.content}`);
  });
  
  console.log('\n🔧 Fix by changing relative imports to use @/ prefix:');
  console.log("  './square-sync' → '@/lib/square-sync'");
  console.log("  './db' → '@/lib/db'");
  console.log("  './square-api' → '@/lib/square-api'");
}
