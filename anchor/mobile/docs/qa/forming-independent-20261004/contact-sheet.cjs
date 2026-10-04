const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('../../../node_modules/sharp');
const dir=__dirname, styles=['prism-flow','alloy','velvet-ember','porcelain','joybrush'], times=[1,2,3,4,4.5,5,5.5,6,12,20,30];
(async()=>{let layers=[]; const cell=180, row=205;
for(let r=0;r<styles.length;r++)for(let c=0;c<times.length;c++){
 const file=path.join(dir,'raster',`${styles[r]}_${times[c].toFixed(2).padStart(5,'0')}.png`);
 const pic=await sharp(file).resize(cell,cell).toBuffer();layers.push({input:pic,left:c*cell,top:r*row});
 const lab=Buffer.from(`<svg width="${cell}" height="25"><rect width="180" height="25" fill="#14162B"/><text x="5" y="17" fill="white" font-size="11">${styles[r]} ${times[c]}s</text></svg>`);
 layers.push({input:lab,left:c*cell,top:r*row+cell});
}
await sharp({create:{width:cell*times.length,height:row*styles.length,channels:3,background:'#14162B'}}).composite(layers).png().toFile(path.join(dir,'contact-sheet.png'));
const mobile=path.resolve(dir,'../../..'),files=['src/screens/create/flow/scenes/FormScene.ts','src/screens/create/flow/scenes/styleStrokes.ts','src/screens/create/flow/components/StyleScene.tsx'];
fs.writeFileSync(path.join(dir,'source-hashes.json'),JSON.stringify({capturedAt:new Date().toISOString(),files:files.map(p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(mobile,p))).digest('hex')}))},null,2));
})();
