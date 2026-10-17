/* Shader-only QA. Uses the production generator, mapping and SkSL, not a native screen capture. */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/thread-aura');
fs.mkdirSync(out, { recursive: true });
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => {
  if (file.endsWith(path.normalize('/utils/logger.ts'))) { module.exports = { logger: { info() {}, warn() {}, error() {} } }; return; }
  module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
};
const { generateTrueSigil } = require('../src/utils/sigil/traditional-generator.ts');
const { PlanetaryTier } = require('../src/types/index.ts');
const { threadAuraParameters, THREAD_AURA_BLUR_SIGMAS } = require('../src/components/v2/anchor/threadAuraModel.ts');
const { THREAD_AURA_SHADER } = require('../src/components/v2/anchor/threadAuraShader.ts');
const { categories } = require('../src/theme/v2/categories.ts');

(async () => {
  const ck = await require('canvaskit-wasm/bin/full/canvaskit')({ locateFile: file => require.resolve(`canvaskit-wasm/bin/full/${file}`) });
  const effect = ck.RuntimeEffect.Make(THREAD_AURA_SHADER, error => { throw Error(error); });
  if (!effect) throw Error('Production shader did not compile');
  const size = 220, span = 352, mark = size * 0.72;
  const svg = generateTrueSigil(['P', 'R', 'S', 'N', 'T', 'W', 'C', 'H', 'L', 'D'], PlanetaryTier.VENUS, 'balanced').svg;
  fs.writeFileSync(path.join(out, 'qa-anchor.svg'), svg);
  const svgImage = ck.MakeImageFromEncoded(await sharp(Buffer.from(svg)).resize(Math.round(mark), Math.round(mark)).png().toBuffer());
  const atlas = ck.MakeSurface(span * 5, span);
  const c = atlas.getCanvas(); c.clear(ck.TRANSPARENT);
  const start = performance.now();
  THREAD_AURA_BLUR_SIGMAS.forEach((sigma, tile) => {
    const paint = new ck.Paint();
    const blur = ck.ImageFilter.MakeBlur(mark * sigma, mark * sigma, ck.TileMode.Decal, null);
    paint.setImageFilter(blur);
    c.save(); c.translate(tile * span, 0); c.clipRect(ck.XYWHRect(0, 0, span, span),ck.ClipOp.Intersect,false); c.saveLayer(paint, ck.XYWHRect(0, 0, span, span));
    c.drawImageRect(svgImage, ck.XYWHRect(0, 0, svgImage.width(), svgImage.height()), ck.XYWHRect((span - mark) / 2, (span - mark) / 2, mark, mark), new ck.Paint());
    c.restore(); c.restore(); paint.delete(); blur.delete();
  });
  atlas.flush();
  const image = atlas.makeImageSnapshot();
  const atlasShader = image.makeShaderOptions(ck.TileMode.Decal, ck.TileMode.Decal, ck.FilterMode.Linear, ck.MipmapMode.None);
  const atlasMs = performance.now() - start;
  async function render(value, color, time = 3) {
    const surface = ck.MakeSurface(span, span); const canvas = surface.getCanvas();
    canvas.clear(ck.Color(251, 249, 244, 1));
    const ground = new ck.Paint(); ground.setColor(ck.Color(251,249,244,1));
    canvas.drawCircle(span/2, span/2, size/2, ground);
    const p = threadAuraParameters(value/100, 'details');
    const tint = [0,2,4].map(i => parseInt(color.slice(i+1,i+3),16)/255);
    const uniforms = [span,time,value/100,p.radius,p.blur,p.inner,p.outer,p.movement,p.particles,p.ambient,0,...tint];
    const shader = effect.makeShaderWithChildren(uniforms,[atlasShader]);
    const paint = new ck.Paint(); paint.setShader(shader); canvas.drawPaint(paint);
    // Same unchanged SVG on top, tinted through its existing currentColor contract.
    const original = ck.MakeImageFromEncoded(await sharp(Buffer.from(svg.replace(/color="[^"]*"/, `color="${color}"`))).resize(Math.round(mark),Math.round(mark)).png().toBuffer());
    canvas.drawImageRect(original,ck.XYWHRect(0,0,original.width(),original.height()),ck.XYWHRect((span-mark)/2,(span-mark)/2,mark,mark),ground);
    surface.flush(); const png = Buffer.from(surface.makeImageSnapshot().encodeToBytes());
    original.delete(); shader.delete(); paint.delete(); ground.delete(); surface.delete(); return png;
  }
  const values = [0,10,25,40,50,68,75,89,95,100];
  const tiles = await Promise.all(values.map(async value => ({ input: await render(value,categories.health), left:(values.indexOf(value)%5)*span,top:Math.floor(values.indexOf(value)/5)*span })));
  await sharp({create:{width:span*5,height:span*2,channels:4,background:'#FBF9F4'}}).composite(tiles).png().toFile(path.join(out,'strength-matrix.png'));
  const comparison = await Promise.all([10,50,95].map(async(value,i)=>({input:await render(value,categories.health),left:i*span,top:0})));
  await sharp({create:{width:span*3,height:span,channels:4,background:'#FBF9F4'}}).composite(comparison).png().toFile(path.join(out,'strength-10-50-95.png'));
  const categoryNames = ['health','career','desire','creativity','spirituality'];
  const categoryTiles = await Promise.all(categoryNames.map(async(name,i)=>({input:await render(95,categories[name]),left:i*span,top:0})));
  await sharp({create:{width:span*5,height:span,channels:4,background:'#FBF9F4'}}).composite(categoryTiles).png().toFile(path.join(out,'category-matrix.png'));
  for (let frame=0;frame<48;frame++) fs.writeFileSync(path.join(out,`motion-${String(frame).padStart(3,'0')}.png`),await render(95,categories.health,frame/12));
  const encode = require('child_process').spawnSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-framerate','12','-i',path.join(out,'motion-%03d.png'),'-c:v','libx264','-pix_fmt','yuv420p',path.join(out,'strength-95-motion.mp4')]);
  if (encode.status !== 0) throw Error(`ffmpeg failed: ${encode.stderr}`);
  for (let frame=0;frame<48;frame++) fs.unlinkSync(path.join(out,`motion-${String(frame).padStart(3,'0')}.png`));
  fs.writeFileSync(path.join(out,'shader-validation.json'),JSON.stringify({compiled:true,source:'production SkSL and mapping; existing traditional generator; CanvasKit CPU, not native device',strengths:values,atlasMs,tileSize:span,atlasBytes:span*span*5*4},null,2));
  console.log(JSON.stringify({compiled:true,atlasMs,out}));
})();
