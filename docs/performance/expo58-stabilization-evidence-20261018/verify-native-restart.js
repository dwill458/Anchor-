(() => {
 const load=suffix=>{const found=[...__r.getModules()].find(([,m])=>(m.verboseName??'').endsWith(suffix));if(!found)throw Error('Missing module '+suffix);return __r(found[0]);};
 if(!/^file:\/\/\/data\/user\/10\//.test(load('expo-file-system/build/legacy/FileSystem.js').documentDirectory??''))throw Error('Profile10 required');
 globalThis.__anchorRecovery={status:'pending'};
 (async()=>{const db=load('src/storage/sqlcipher/runtime.ts').recordDatabase();
 const owner='stabilization-synthetic-owner';
 const history=await db.read(`anchor:practice-history:${owner}`);const queue=await db.read(`anchor:practice-write-queue:${owner}`);const snapshot=await db.read(`anchor:session-snapshot:${owner}`);
 const count=history?.length??0;const uncommittedPresent=history?.some(x=>x.id==='stabilization-native-uncommitted');
 if(count!==42||queue?.length!==42||snapshot?.totalSessionsCount!==42||uncommittedPresent)throw Error('Restart count/atomicity mismatch');
 return {status:'complete',profile:10,committedCount:count,outboxCount:queue.length,snapshotCount:snapshot.totalSessionsCount,threadStrength:snapshot.threadStrength,uncommittedPresent:false,adapter:load('src/storage/sqlcipher/persistence.ts').sqlCipherEnabled(),dev:__DEV__};
 })().then(result=>globalThis.__anchorRecovery=result,error=>globalThis.__anchorRecovery={status:'failed',message:String(error.message)});
 return {scheduled:true,profile:10};
})()
