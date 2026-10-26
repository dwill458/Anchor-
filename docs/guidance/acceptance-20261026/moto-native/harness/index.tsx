import 'react-native-gesture-handler';
import React,{useState,useEffect,useRef,useCallback} from 'react';
import {registerRootComponent} from 'expo';
import {View,Text,Pressable,StyleSheet,PixelRatio,AccessibilityInfo,useWindowDimensions,Platform,BackHandler,DeviceEventEmitter} from 'react-native';
import {SafeAreaProvider,useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFonts} from 'expo-font';
import {ScreenTeaching} from '@/components/v2/teaching/ScreenTeaching';
import {ChartOneMoveTeaching} from '@/components/v2/chart/sheet/ChartOneMoveTeaching';
import {useTeachingQueue} from '@/hooks/v2/teaching/useTeachingQueue';
import {useCelebrationActive} from '@/hooks/v2/teaching/useCelebrationActive';
import {useMilestoneCelebrationStore} from '@/stores/v2/milestoneCelebrationStore';
import {useCelebrationStore} from '@/stores/v2/celebrationStore';
import {resetTeachingSession} from '@/hooks/v2/teaching/teachingSession';
import {reset} from './memorySeen';
import {ThreadRow} from './DetailsRow';
import {WidgetPreview} from 'react-native-android-widget';
import {AnchorMediumWidget} from '@/widgets/android/AnchorMediumWidget';
import {AnchorLargeWidget} from '@/widgets/android/AnchorLargeWidget';
const medium=()=> <AnchorMediumWidget primed anchorName="QA Anchor" sigilSvg={null} anchorTotalSessions={15} anchorDayStreak={3} anchorDeepPrimeSessions={4}/>;
const large=()=> <AnchorLargeWidget primed anchorName="QA Anchor" sigilSvg={null} artworkImageUri={null} streak={3} threadStrength={50} totalSessions={15} focusSessions={8} deepPrimeSessions={4} visualizeSessions={2} releaseSessions={1} deepPrimePercent={27} constancyPercent={50} longestStreak={7} sensitivityLabel="Steady" sensitivityNote="QA only" currentWeek={[]} history={[]} today="2026-10-26" widgetWidth={344} widgetHeight={440}/>;

const report=(event:string,data:any={})=>fetch('http://127.0.0.1:8094/event',{method:'POST',body:JSON.stringify({event,...data})}).catch(()=>{});
function App(){
 const [config,setConfig]=useState<any>(null);
 const [fonts]=useFonts({'Figtree-Regular':require('@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf'),'Figtree-SemiBold':require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf'),'EBGaramond-Medium':require('@expo-google-fonts/eb-garamond/500Medium/EBGaramond_500Medium.ttf')});
 useEffect(()=>{let alive=true;const poll=()=>fetch('http://127.0.0.1:8094').then(r=>r.json()).then(c=>{if(alive)setConfig((old:any)=>JSON.stringify(old)===JSON.stringify(c)?old:c);}).catch(()=>{});poll();const t=setInterval(poll,300);return()=>{alive=false;clearInterval(t);};},[]);
 useEffect(()=>{report('bootstrap',{fonts,native:Platform.constants});},[fonts]);
 useEffect(()=>{const a=DeviceEventEmitter.addListener('hardwareBackPress',()=>report('nativeBackEvent'));const b=BackHandler.addEventListener('hardwareBackPress',()=>{report('probeBackHandler');return false;});return()=>{a.remove();b.remove();};},[]);
 if(!fonts||!config)return <View><Text>Loading isolated guidance QA</Text></View>;
 return <SafeAreaProvider><Run key={config.id} config={config}/></SafeAreaProvider>;
}
function Run({config:c}:any){
 const dims=useWindowDimensions(),insets=useSafeAreaInsets();
 const [dismissed,setDismissed]=useState(false),[hits,setHits]=useState(0),[chartReady,setChartReady]=useState(false);
 const target=useRef<any>(null),circle=useRef<any>(null),body=useRef<any>(null),viewport=useRef<any>(null);
 const active=useCelebrationActive();
 useEffect(()=>{reset();resetTeachingSession();report('run',{id:c.id,mode:c.mode,fontScale:PixelRatio.getFontScale(),dimensions:dims,insets});},[]);
 useEffect(()=>{useMilestoneCelebrationStore.setState({queue:c.milestone?[{key:'qa-only',mode:'replay',accountId:null,record:{}} as any]:[]});useCelebrationStore.setState({active:c.scene?{id:'qa-scene',level:2,skippable:false}:null,queueLength:0});},[c.milestone,c.scene]);
 const queue=useTeachingQueue({screenId:'qa-home',accountId:'guidance-isolated-qa',eligible:c.mode==='home'?['home.today']:[],cap:1,blocked:active,isFocused:c.focus});
 useEffect(()=>{report('queue',{id:c.id,steps:queue.steps,ready:queue.ready,blocked:active,focused:c.focus});},[queue.steps,queue.ready,active,c.focus]);
 const layout=(name:string)=>(()=>{requestAnimationFrame(()=>{(name==='target'?target:viewport).current?.measureInWindow((x:number,y:number,width:number,height:number)=>report('rect',{id:c.id,name,x,y,width,height}));});});
 const hit=(kind:string)=>{setHits(n=>n+1);report('hit',{id:c.id,kind});};
 const dismiss=useCallback(()=>{setDismissed(true);report('chartDismiss',{id:c.id});},[c.id]);
 const ready=useCallback(()=>{setChartReady(true);report('chartReady',{id:c.id});},[c.id]);
 const request=useCallback(()=>report('chartRequestVisible',{id:c.id}),[c.id]);
 return <View ref={viewport} collapsable={false} onLayout={layout('viewport')} style={{flex:1,backgroundColor:'#F4EFE6',width:c.width||undefined,alignSelf:c.width?'center':'stretch'}}>
 <Text style={{marginTop:insets.top+12,marginHorizontal:20,fontSize:18}}>ISOLATED GUIDANCE QA â€” {c.mode}</Text>
 <Text style={{margin:20,fontSize:12}}>Run {c.id} Â· hits {hits} Â· blocked {String(active)} Â· chart ready {String(chartReady)}</Text>
 {c.mode==='widgets'?<View style={{marginTop:30,alignItems:'center',gap:24}}><WidgetPreview renderWidget={medium} width={344} height={180}/><WidgetPreview renderWidget={large} width={344} height={440}/></View>:c.mode==='details'?<View style={{marginHorizontal:16,marginTop:40}}><ThreadRow value={c.value} delta={0} category="growth" size="centered" active onPress={()=>hit('progress')} onExplain={()=>hit('explain')}/><Text style={{marginTop:80}}>Extracted production Details row / styles</Text></View>:<>
 <View ref={target} collapsable={false} onLayout={layout('target')} style={{position:'absolute',left:28,right:28,top:c.y,height:80,flexDirection:'row',backgroundColor:'#ddd4c4',borderRadius:16}}>
 <Pressable ref={circle} accessibilityRole="button" accessibilityLabel={c.mode==='chart'?'Complete sample move':'Start sample practice'} onPress={()=>hit('circle')} style={{width:64,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:26}}>â—‹</Text></Pressable>
 <Pressable ref={body} accessibilityRole="button" accessibilityLabel={c.mode==='chart'?'Open sample move details':'Open sample Today card'} onPress={()=>hit('body')} style={{flex:1,justifyContent:'center'}}><Text style={{fontFamily:'Figtree-Regular',fontSize:16}}>{c.mode==='chart'?'Your next move':'Today â€” Focus'}</Text></Pressable>
 </View>
 {c.mode==='home'&&<ScreenTeaching screen="qa-home" reducedMotion={c.reduced} queue={queue} targets={{'home.today':{targetRef:target}}}/>}
 {c.mode==='chart'&&<ChartOneMoveTeaching visible={!dismissed&&c.focus&&!active} replayVersion={c.id} reducedMotion={c.reduced} detent="mid" targets={{rowRef:target,circleRef:circle,bodyRef:body}} viewportRef={viewport} onReady={ready} onRequestVisible={request} onDismiss={dismiss}/>}
 {active&&<View style={[StyleSheet.absoluteFill,{backgroundColor:'#d4b978',justifyContent:'center',alignItems:'center',zIndex:100}]}><Text>QA milestone blocking stand-in</Text></View>}
 </>}
 </View>;
}
registerRootComponent(App);
