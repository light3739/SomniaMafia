const fs = require('fs');
const path = require('path');

// ================= НАСТРОЙКИ =================

// Имя выходного файла
const OUTPUT_FILE = 'project_code.txt';

// Папки, которые ИГНОРИРУЕМ
const IGNORE_DIRS = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'coverage',
    '.vscode',
    '.idea',
    'public', // Часто там картинки, но если нужен html - убери из списка
    'assets'  // Обычно там бинарники
];

// Типы файлов, которые СОБИРАЕМ (чтобы не читать картинки, шрифты и т.д.)
const INCLUDE_EXTS = [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.css',
    '.scss',
    '.json',
    '.html',
    '.md'
];

// Файлы, которые тоже игнорируем (например, лок-файлы)
const IGNORE_FILES = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    OUTPUT_FILE, // Сам выходной файл не читаем
    __filename   // Сам скрипт не читаем
];

// ================= ЛОГИКА =================

const writeStream = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf8' });

function processDirectory(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (err) {
        console.error(`❌ Ошибка чтения папки ${dir}:`, err.message);
        return;
    }

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        let stats;

        try {
            stats = fs.statSync(fullPath);
        } catch (err) {
            console.error(`❌ Ошибка доступа к ${fullPath}`);
            return;
        }

        if (stats.isDirectory()) {
            if (!IGNORE_DIRS.includes(file)) {
                processDirectory(fullPath);
            }
        } else {
            const ext = path.extname(file).toLowerCase();
            
            // Проверка: расширение подходит И файл не в черном списке
            if (INCLUDE_EXTS.includes(ext) && !IGNORE_FILES.includes(file)) {
                writeFileToOutput(fullPath);
            }
        }
    });
}

function writeFileToOutput(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(__dirname, filePath);

        // Форматирование для удобного чтения нейросетями
        writeStream.write('='.repeat(50) + '\n');
        writeStream.write(`FILE PATH: ${relativePath}\n`);
        writeStream.write('='.repeat(50) + '\n');
        writeStream.write(content + '\n\n');
        
        console.log(`✅ Добавлен: ${relativePath}`);
    } catch (err) {
        console.error(`❌ Не удалось прочитать ${filePath}:`, err.message);
    }
}

console.log('🚀 Начинаю сборку проекта...');
processDirectory(__dirname);
writeStream.end();
writeStream.on('finish', () => {
    console.log(`\n🏁 Готово! Весь код собран в файл: ${OUTPUT_FILE}`);
});