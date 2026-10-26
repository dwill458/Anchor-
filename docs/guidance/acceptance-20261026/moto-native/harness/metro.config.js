const path=require('path');const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);config.watchFolders=['E:/Projects/Anchor/anchor/mobile'];
config.resolver.nodeModulesPaths=['E:/Projects/Anchor/anchor/mobile/node_modules'];
config.resolver.resolveRequest=(ctx,name,platform)=>{
 if (name.endsWith('/teachingSeen')||name==='./teachingSeen') return {type:'sourceFile',filePath:path.join(__dirname,'memorySeen.ts')};
 if(name.endsWith('/AnalyticsService')) return {type:'sourceFile',filePath:path.join(__dirname,'noAnalytics.ts')};
 return ctx.resolveRequest(ctx,name,platform);
};module.exports=config;
