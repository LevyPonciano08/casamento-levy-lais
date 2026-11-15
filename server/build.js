import { mkdir, copyFile, cp } from 'node:fs/promises';
import { publicFiles } from './public-files.js';
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/',root), { recursive: true });
for (const file of publicFiles) await copyFile(new URL(file,root), new URL(`public/${file}`,root));
for (const dir of ['assets','img']) await cp(new URL(dir,root), new URL(`public/${dir}`,root), { recursive: true });
console.log('Arquivos públicos preparados para a Vercel.');
