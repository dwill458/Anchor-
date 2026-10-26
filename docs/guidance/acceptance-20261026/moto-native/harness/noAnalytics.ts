export const AnalyticsService={track:(event:string,props:any)=>{fetch('http://127.0.0.1:8094/event',{method:'POST',body:JSON.stringify({event,...props})}).catch(()=>{});}};
