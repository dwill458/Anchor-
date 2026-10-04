const sharp=require('../../../node_modules/sharp'), path=require('path');
const ids=['prism-flow','alloy','porcelain','graphic','velvet-ember','joybrush'], src=path.resolve(__dirname,'../forming-pass-20261004/production-pairs');
(async()=>{const ops=[];for(let r=0;r<ids.length;r++)for(let c=0;c<2;c++){
const input=await sharp(path.join(src,`${ids[r]}-form-${c+1}.png`)).resize(430,430,{fit:'contain',background:'#eee'}).toBuffer();ops.push({input,left:c*430,top:r*450});
const label=Buffer.from(`<svg width="430" height="20"><rect width="430" height="20" fill="white"/><text x="6" y="15" font-size="13">${ids[r]} Form ${c+1}</text></svg>`);ops.push({input:label,left:c*430,top:r*450+430});
}await sharp({create:{width:860,height:2700,channels:3,background:'white'}}).composite(ops).png().toFile(path.join(__dirname,'actual-pairs-contact-sheet.png'));})();

