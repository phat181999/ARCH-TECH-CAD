const fs = require('fs');
const files = [
  'src/pages/CanvasEditor.tsx',
  'src/components/CadSidebar.tsx',
  'src/panels/AIAssistantPanel.tsx',
  'src/canvas/CadEngine.ts'
];

const replacements = [
  { target: /bg-\[#0B0E14\]/g, replacement: 'bg-white dark:bg-[#0B0E14] transition-colors duration-300' },
  { target: /bg-\[#151B23\]/g, replacement: 'bg-slate-50 dark:bg-[#151B23] transition-colors duration-300' },
  { target: /bg-\[#11161D\]/g, replacement: 'bg-slate-100 dark:bg-[#11161D] transition-colors duration-300' },
  { target: /border-\[#1E293B\]/g, replacement: 'border-slate-200 dark:border-[#1E293B] transition-colors duration-300' },
  { target: /bg-\[#1E293B\]/g, replacement: 'bg-slate-200 dark:bg-[#1E293B] transition-colors duration-300' },
  { target: /text-gray-300/g, replacement: 'text-slate-700 dark:text-gray-300 transition-colors duration-300' },
  { target: /text-slate-300/g, replacement: 'text-slate-700 dark:text-slate-300 transition-colors duration-300' },
  { target: /text-slate-400/g, replacement: 'text-slate-500 dark:text-slate-400 transition-colors duration-300' },
  { target: /text-gray-400/g, replacement: 'text-slate-500 dark:text-gray-400 transition-colors duration-300' },
  { target: /text-gray-500/g, replacement: 'text-slate-400 dark:text-gray-500 transition-colors duration-300' },
  { target: /text-white/g, replacement: 'text-slate-900 dark:text-white transition-colors duration-300' },
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  replacements.forEach(({target, replacement}) => {
    content = content.replace(target, replacement);
  });
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
