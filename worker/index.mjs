import assets from 'site:assets';
import {serveScores} from './leaderboard.mjs';

export default {
  async fetch(request, env) {
    const {pathname} = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      try { return await serveScores(request, env.DB); }
      catch (error) {
        console.error('Leaderboard request failed', error.message);
        return Response.json({error:'The leaderboard is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
      }
    }
    if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
    const asset = assets[pathname === '/' ? '/index.html' : pathname];
    if (!Array.isArray(asset)) return new Response('Page not found',{status:404});
    const [type,encoding,data] = asset;
    const body = request.method === 'HEAD' ? null : encoding === 'base64' ? Uint8Array.from(atob(data), c=>c.charCodeAt(0)) : data;
    return new Response(body,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff'}});
  }
};
