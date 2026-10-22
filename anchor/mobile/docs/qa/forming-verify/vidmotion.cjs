// usage: node vidmotion.cjs <dir> <fps> [thr]  -> per-frame changed-pixel counts and longest static run (vs run start)
const fs=require('fs'),path=require('path');const sharp=require(path.resolve(__dirname,'../../..','node_modules/sharp'));
(async()=>{const dir=process.argv[2],fps=+process.argv[3],thr=+(process.argv[4]||10),N=+(process.argv[5]||25);
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.png')).sort();const bufs=[];
for(const f of files)bufs.push(await sharp(path.join(dir,f)).removeAlpha().raw().toBuffer());
const ch=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=3){if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>thr)n++;}return n;};
const c=[];for(let i=1;i<bufs.length;i++)c.push(ch(bufs[i-1],bufs[i]));
console.log('consec changed px (t=sec):');console.log(c.map((v,i)=>((i+1)/fps).toFixed(1)+':'+v).join(' '));
let best=0,bs=0,i=0;while(i<bufs.length){let j=i+1;while(j<bufs.length&&ch(bufs[i],bufs[j])<N)j++;const len=(Math.min(j,bufs.length-1)-i)/fps;if(len>best){best=len;bs=i/fps;}i=Math.max(j-1,i+1);}
console.log('longest static run (<'+N+' px changed vs run start):',best.toFixed(2),'s from',bs.toFixed(1));})();
