const fs = require('fs');
const path = require('path');

const directory = './src';

const replacements = [
  { search: /bg-\[#0B0E14\]/g, replace: 'bg-slate-50 dark:bg-[#0B0E14]' },
  { search: /bg-\[#11161D\]/g, replace: 'bg-slate-100 dark:bg-[#11161D]' },
  { search: /bg-\[#151B23\]/g, replace: 'bg-white dark:bg-[#151B23]' },
  { search: /border-\[#1E293B\]/g, replace: 'border-slate-200 dark:border-[#1E293B]' },
  { search: /text-\[#94A3B8\]/g, replace: 'text-slate-500 dark:text-[#94A3B8]' },
  { search: /text-\[#475569\]/g, replace: 'text-slate-400 dark:text-[#475569]' },
  { search: /text-gray-200/g, replace: 'text-slate-800 dark:text-gray-200' },
  { search: /text-gray-300/g, replace: 'text-slate-700 dark:text-gray-300' },
  { search: /text-white/g, replace: 'text-slate-900 dark:text-white' },
  { search: /hover:bg-\[#1E293B\]\/50/g, replace: 'hover:bg-slate-200 dark:hover:bg-[#1E293B]/50' },
  { search: /hover:bg-\[#1E293B\]\/30/g, replace: 'hover:bg-slate-200 dark:hover:bg-[#1E293B]/30' },
  { search: /hover:bg-\[#1E293B\]/g, replace: 'hover:bg-slate-200 dark:hover:bg-[#1E293B]' },
  { search: /bg-\[#1E293B\]/g, replace: 'bg-slate-200 dark:bg-[#1E293B]' },
  { search: /bg-\[#2A3441\]/g, replace: 'bg-slate-300 dark:bg-[#2A3441]' },
  { search: /hover:text-white/g, replace: 'hover:text-slate-900 dark:hover:text-white' },
  { search: /hover:text-gray-200/g, replace: 'hover:text-slate-800 dark:hover:text-gray-200' },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      replacements.forEach(r => {
        content = content.replace(r.search, r.replace);
      });
      if (original !== content) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(directory);
