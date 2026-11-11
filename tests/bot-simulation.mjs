import assert from 'node:assert/strict';
import * as core from '../src/core.js';
import { nextBotAction } from '../src/bots.js';

const levels=['easy','medium','hard'];
const human={id:'p_testing',name:'Tester',look:{skin:0,hair:'short',hc:0,outfit:'tee'},pet:''};
for (const [j,difficulty] of levels.entries()) {
  const code='SIM'+String.fromCharCode(65+j);
  let now=Date.now(),s=core.partyOp(null,'create',human,{mode:25,bots:4,difficulty},now,code).state;
  assert.equal(s.players.length,5);
  s=core.partyOp(s,'start',human,{},now+100,code).state;
  let nBot=0,nHuman=0,nSteps=0,over=false;
  while(nSteps++<1800) {
    if(s.phase==='over'){over=true;break;}
    now+=1400;
    let user,action;
    const bot=nextBotAction(s);
    if(bot){ user={id:bot.id};action=bot.a;nBot++; }
    else {
      user=human;nHuman++;
      // Play as an impatient, imperfect human. Legitimate engine actions only.
      const E=globalThis.Engine;
      if(s.stage==='auction') {
        const who=s.players[s.auc.who]; user={id:who.id};
        action={t:'pass'};
      } else if(s.rush>=0) {
        const who=s.players[s.rush]; user={id:who.id};action={t:'rush',n:3};
      } else if(s.trade) {
        const who=s.players[s.trade.to]; user={id:who.id};action={t:'reject'};
      } else if(s.stage==='travel') {
        action={t:'stay'};
      } else if(s.stage==='buy') {
        action={t:s.players[E.cur(s)].cash>=E.T[s.players[E.cur(s)].pos].p+150?'buy':'skip'};
      } else if(s.stage==='roll') action={t:'roll'};
      else if(s.stage==='act') action={t:'end'};
      else if(s.stage==='debt') action={t:'bankrupt'};
      else throw Error('Unhandled stage '+s.stage);
    }
    try { s=core.partyOp(s,'act',user,{a:action},now,code).state; }
    catch(e) {
      throw Error(difficulty+' step '+nSteps+' stage '+s.stage+' action '+JSON.stringify(action)+': '+e.message);
    }
  }
  assert(nBot>20,'bot should participate in the game');
  assert(nHuman>0,'human should have active moves');
  assert(over || nSteps>=1800);
  console.log(difficulty+': '+nBot+' bot actions, '+nHuman+' human actions, '+(over?'game finished':'1800-step safety run passed'));
}
