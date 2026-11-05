import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
function check(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) check(path);
        else if (/\.m?js$/.test(path)) {
            const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
            if (result.status !== 0) process.exit(result.status || 1);
        }
    }
}
check('src'); check('scripts'); check('tests');
JSON.parse(readFileSync('manifest.json', 'utf8'));
console.log('JavaScript syntax and manifest checks passed.');
