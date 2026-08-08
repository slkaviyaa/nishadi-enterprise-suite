const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function fixTheme(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            fixTheme(filePath);
        } else if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let originalContent = content;

            // 1. Dark mode classes එකතු කිරීම
            content = content.replace(/\bbg-white\b/g, 'bg-white dark:bg-gray-800');
            content = content.replace(/\btext-gray-900\b/g, 'text-gray-900 dark:text-white');
            content = content.replace(/\btext-gray-800\b/g, 'text-gray-800 dark:text-gray-200');
            content = content.replace(/\bbg-gray-100\b/g, 'bg-gray-100 dark:bg-gray-700');
            content = content.replace(/\bbg-gray-50\b/g, 'bg-gray-50 dark:bg-gray-900');
            content = content.replace(/\bborder-gray-200\b/g, 'border-gray-200 dark:border-gray-700');
            content = content.replace(/\bborder-gray-300\b/g, 'border-gray-300 dark:border-gray-600');

            // 2. දැනටමත් හදාපු ඒවායේ classes ඩබල් වෙලා ඇත්නම් පිරිසිදු කිරීම
            content = content.replace(/(dark:bg-gray-800\s*){2,}/g, 'dark:bg-gray-800 ');
            content = content.replace(/(dark:text-white\s*){2,}/g, 'dark:text-white ');
            content = content.replace(/(dark:text-gray-200\s*){2,}/g, 'dark:text-gray-200 ');
            content = content.replace(/(dark:bg-gray-700\s*){2,}/g, 'dark:bg-gray-700 ');
            content = content.replace(/(dark:bg-gray-900\s*){2,}/g, 'dark:bg-gray-900 ');
            content = content.replace(/(dark:border-gray-700\s*){2,}/g, 'dark:border-gray-700 ');
            content = content.replace(/(dark:border-gray-600\s*){2,}/g, 'dark:border-gray-600 ');

            // ෆයිල් එක වෙනස් වුණා නම් විතරක් සේව් කිරීම
            if (content !== originalContent) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`✅ Theme Fixed: ${file}`);
            }
        }
    });
}

console.log("🚀 Scanning files and applying Dark Mode fixes...");
fixTheme(directoryPath);
console.log("🎉 Done! Dark Mode applied to all pages.");