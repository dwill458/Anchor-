const fs=require('fs'),path=require('path');
const ts=require(path.resolve(__dirname,'../../../../node_modules/typescript'));
require.extensions['.txt']=require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
require(path.join(__dirname,process.argv[2]||'prompts.ts.txt'));
