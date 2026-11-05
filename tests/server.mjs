import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const hostRoot = path.resolve(process.env.ST_PUBLIC_DIR || '../SillyTavern/public');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const isHost = pathname.startsWith('/host/');
        const base = isHost ? hostRoot : root;
        const target = path.resolve(base, '.' + (isHost ? pathname.slice(5) : pathname === '/' ? '/tests/fixture.html' : pathname));
        if (!target.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
        if (!(await stat(target)).isFile()) throw new Error('Not a file');
        res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
        res.end(await readFile(target));
    } catch { res.writeHead(404).end(); }
}).listen(4187, '127.0.0.1');
