// 纯概率模型模拟（独立复刻 luma_operations.js 的每刻哈希概率逻辑，仅用于拍板验证）
const SLOT_MS = 10 * 60000;
function seededHash(str) { let h=1779033703^str.length; for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19);} h=Math.imul(h^(h>>>16),2246822507); h=Math.imul(h^(h>>>13),3266489909); h^=h>>>16; return (h>>>0)/4294967296; }
const liveSlotIndex = now => Math.floor(now/SLOT_MS);
const clamp01 = x => x<0?0:(x>1?1:x);
function getDailyFlavor(cid){ const k=`2026-9-1`; const mood=seededHash(`${cid}::mood::${k}`); const wants=seededHash(`${cid}::shy::${k}`)>=0.08; return {mood, wants}; }
function hashOpenProb(cid,slot,startTend,mood,elRest,maxBlue){ const base=(startTend!=null&&startTend>=0?startTend/200:0)*(0.4+mood*0.6); const r=clamp01(elRest/Math.max(maxBlue,1)); return clamp01(base+0.62*(1-Math.pow(1-r,2))); }
function hashStopProb(cid,slot,stopTend,mood,live,maxLive){ const base=(stopTend!=null&&stopTend>=0?stopTend/200:0.12)*(0.4+(1-mood)*0.6); const r=clamp01(live/Math.max(maxLive,1)); return clamp01(base+0.75*(1-Math.pow(1-r,2))); }

const maxLiveMins=240, minRestMins=10, maxRestMins=480, minLiveMins=Math.max(15,Math.round(maxLiveMins*0.35));
const SIX = new Date(2026,8,1,6,0,0,0).getTime();
const MID = new Date(2026,8,1,24,0,0,0).getTime();
const N=12;
const chars=Array.from({length:N},(_,i)=>`id${i+1}`);

function simulate(startTend=null,stopTend=null){
  const states={};
  const report=[];
  for(const cid of chars){
    const s={isLive:false,liveStart:0,restBase:null,forced:0,sessions:[]};
    const flavor=getDailyFlavor(cid);
    for(let t=SIX;t<MID;t+=SLOT_MS){
      const slot=liveSlotIndex(t), roll=seededHash(`${cid}::slot::${slot}`);
      if(s.isLive){
        const live=(t-s.liveStart)/60000;
        if(live<minLiveMins) continue;
        if(roll<hashStopProb(cid,slot,stopTend,flavor.mood,live,maxLiveMins)){
          s.isLive=false; s.sessions.push({st:s.liveStart,en:t+SLOT_MS}); s.restBase=t; s.forced=t+minRestMins*60000;
        }
      } else {
        if(!flavor.wants) continue;
        if(t<s.forced) continue;
        const elRest=s.restBase!=null?t-s.restBase:t-SIX;
        if(roll<hashOpenProb(cid,slot,startTend,flavor.mood,Math.max(0,elRest),maxRestMins*60000)){ s.isLive=true; s.liveStart=Math.max(t,s.restBase!=null?s.restBase+minRestMins*60000:t); }
      }
    }
    report.push({cid,ses:s.sessions.length,avgL:s.sessions.length?Math.round(s.sessions.reduce((a,x)=>(x.en-x.st)/60000,0)/s.sessions.length):0, gaps: s.sessions.length?Math.round(s.sessions.reduce((a,x,i)=>a+(i? (x.st-s.sessions[i-1].en)/60000:0),0)/Math.max(1,s.sessions.length-1)):0});
  }
  return report;
}
function summarize(label,rep){
  const ses=rep.reduce((a,x)=>a+x.ses,0), avgS=ses/N, avgL=Math.round(rep.reduce((a,x)=>a+x.avgL,0)/N), avgG=Math.round(rep.reduce((a,x)=>a+x.gaps,0)/N);
  const off=rep.filter(x=>x.ses===0).length;
  console.log(`\n【${label}】总场次=${ses} 场均/天=${avgS.toFixed(1)} 单场均长=${avgL}分 平均休息=${avgG}分 当天空档(没播)=${off}人`);
  console.table(rep.map(x=>({ID:x.cid,场次:x.ses,场均:x.avgL+'分',场均间隔:x.gaps+'分'})));
}
summarize('默认倾向(null)', simulate(null,null));
summarize('倾向偏强(startT=70,stopT=25)', simulate(70,25));
summarize('倾向偏弱(startT=20,stopT=60)', simulate(20,60));