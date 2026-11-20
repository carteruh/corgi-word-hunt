import {build} from 'esbuild';
import {readdir, readFile} from 'node:fs/promises';
import {extname, join, relative} from 'node:path';

const mime = {'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const assets = {};
async function visit(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    if (entry.name === '.nojekyll') continue;
    const path = join(dir,entry.name);
    if (entry.isDirectory()) { await visit(path); continue; }
    const ext = extname(path), type = mime[ext];
    if (!type) throw new Error('Missing content type for '+path);
    const binary = ['.webp','.woff2'].includes(ext);
    assets['/'+relative('docs',path)] = [type,binary?'base64':'text',await readFile(path,binary?'base64':'utf8')];
  }
}
await visit('docs');
await build({entryPoints:['worker/index.mjs'], outfile:'dist/server/index.js',bundle:true,format:'esm',target:'es2022',minify:true,
  plugins:[{name:'web-assets',setup(builder){
    builder.onResolve({filter:/^site:assets$/},()=>({path:'assets',namespace:'web'}));
    builder.onLoad({filter:/.*/,namespace:'web'},()=>({contents:JSON.stringify(assets),loader:'json'}));
  }}]});
