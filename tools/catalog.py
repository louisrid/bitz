#!/usr/bin/env python3
"""Builds the shop catalogue: adds the exclusive costumes, new outfits and backgrounds, and sets every price
for the 1,000-gold-a-second economy. Writes a generated block into public/index.html, the background styles into
public/open-world.css and the server's mirror src/shop.js. Run from the repo root: python3 tools/catalog.py"""
import json, re, subprocess, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from costumes import C, B, mir
P='public/index.html'; s=open(P).read()
s=re.sub(r"/\*CAT>\*/.*?/\*<CAT\*/\n", "", s, flags=re.S)
a=s.index("const ITEMS = {"); b=s.index("const OUTC = {")
base=json.loads(subprocess.check_output(['node','-e', s[a:b]+";console.log(JSON.stringify(ITEMS))"]))
hairs=json.loads(subprocess.check_output(['node','-e', "const s=require('fs').readFileSync('src/shop.js','utf8');console.log(s.match(/HAIRS = (\\[.*?\\])/)[1])"]))
new={}; outc={}; outx={}; desc={}
# ---- exclusives: only ever from loot boxes ----
for id,c in C.items():
    new[id]=['outfit',c['name'],9000000 if c['myth'] else 2000000,1]
    outc[id]=c['c']
full={id:{k:v for k,v in c.items() if k in('m','hand','head','hm','b','h','k') and v is not None} for id,c in C.items()}
# ---- new shop outfits: colours plus a few details; 'rank' places them on the price curve (0 cheap .. 1 dear) ----
OUT=[('n_street','Streetwear set',['#a4ff86','#15171c','#f7e04d'],.1,None,[B(.3,.1,.02,'#15171c',0,.74,.16),B(.52,.06,.31,'#f7e04d',0,.46,0)]),
 ('n_varsity','Varsity jacket',['#f04362','#232f54','#ffffff'],.16,None,[B(.04,.5,.02,'#ffffff',0,.67,.16),B(.12,.14,.02,'#ffffff',-.14,.78,.16),B(.54,.06,.32,'#ffffff',0,.45,0)]),
 ('n_denim','Double denim',['#438ac9','#183b82','#ffffff'],.2,None,[B(.03,.5,.02,'#f2c04a',0,.67,.16),B(.12,.1,.02,'#2f6aa8',-.14,.78,.16),B(.12,.1,.02,'#2f6aa8',.14,.78,.16)]),
 ('n_skater','Skater fit',['#a27bff','#34313a','#ffe083'],.24,None,[B(.2,.2,.02,'#ffe083',0,.7,.16),B(.1,.1,.03,'#34313a',0,.7,.165)]),
 ('n_pilot','Ace pilot',['#71513a','#343840','#dabc80'],.34,None,[B(.56,.1,.34,'#dabc80',0,.9,0),B(.04,.5,.02,'#343840',0,.67,.16),B(.1,.06,.02,'#ffd60a',-.15,.76,.16,'s')]),
 ('n_noir','Noir detective',['#a88b69','#28262b','#e3d7bc'],.46,None,[B(.56,.07,.34,'#6b563c',0,.5,0),B(.08,.08,.03,'#ffd60a',0,.5,.17,'s'),B(.2,.3,.02,'#e3d7bc',0,.78,.16),B(.58,.1,.36,'#a88b69',0,.92,0)]),
 ('n_ronin','Ronin armour',['#d33236','#23232f','#ffd979'],.58,'s',[B(.54,.06,.32,'#ffd979',0,.82,0,'s'),B(.54,.06,.32,'#ffd979',0,.66,0,'s'),B(.54,.06,.32,'#ffd979',0,.5,0,'s')]+mir(.22,.08,.3,'#23232f',.4,.94,0,'s')),
 ('n_cyber','Cyber runner',['#16b4b9','#253a57','#d6fcff'],.64,None,[B(.03,.5,.02,'#d6fcff',-.14,.67,.16,'g'),B(.03,.5,.02,'#d6fcff',.14,.67,.16,'g'),B(.14,.1,.03,'#ff2bd6',0,.76,.17,'g')]),
 ('n_race','Racing champion',['#f2c321','#292a38','#ffffff'],.72,None,[B(.52,.08,.31,'#292a38',0,.7,0),B(.1,.1,.02,'#ffffff',-.15,.82,.16),B(.1,.1,.02,'#e02b3c',.15,.82,.16),B(.04,.5,.02,'#ffffff',0,.67,.16)]),
 ('n_glitch','Glitch explorer',['#ee47ba','#303d71','#64ffdb'],.8,None,[B(.2,.05,.02,'#64ffdb',-.1,.82,.16,'g'),B(.26,.05,.02,'#64ffdb',.1,.7,.16,'g'),B(.16,.05,.02,'#ffffff',-.14,.58,.16,'g'),B(.1,.05,.02,'#64ffdb',.18,.52,.16,'g')]),
 ('n_mecha','Mecha armour',['#3f81ac','#172a54','#7efff2'],.88,'s',[B(.3,.2,.04,'#172a54',0,.72,.16,'s'),B(.14,.08,.03,'#7efff2',0,.72,.18,'g'),B(.58,.08,.36,'#172a54',0,.45,0,'s')]+mir(.26,.14,.3,'#3f81ac',.4,.95,0,'s')+mir(.06,.06,.06,'#7efff2',.4,1.04,0,'g')),
 ('n_royalty','Galactic royalty',['#4e3b9f','#152046','#b5e3ff'],.94,None,[B(.58,.1,.36,'#b5e3ff',0,.9,0,'s'),B(.06,.5,.03,'#b5e3ff',0,.67,.16,'s'),B(.1,.1,.03,'#ffffff',0,.8,.17,'g'),B(.6,.66,.05,'#2a1f6b',0,.6,-.19)]+[B(.04,.04,.02,'#ffffff',x,y,.16,'g') for x,y in ((-.16,.56),(.17,.62),(-.12,.8))]),
 ('n_diamond','Diamond monarch',['#97f2fa','#2674b7','#ffffff'],1.0,'s',[B(.16,.16,.04,'#ffffff',0,.72,.17,'g'),B(.58,.08,.36,'#ffffff',0,.45,0,'s'),B(.58,.08,.36,'#ffffff',0,.9,0,'s')]+mir(.2,.1,.26,'#e2fcff',.37,.96,0,'t'))]
rank={}
for id,name,cols,r,m,deco in OUT:
    new[id]=['outfit',name,1]; outc[id]=cols; rank[id]=r
    outx[id]={'deco':deco, **({'m':m} if m else {})}
# ---- new backgrounds ----
G=lambda ang,*c: f"linear-gradient({ang}deg,{','.join(c)})"
def dots(col,size,gap): return f"radial-gradient({col} {size}px,transparent {size+1}px) 0 0/{gap}px {gap}px"
def stripes(ang,col,w,gap): return f"repeating-linear-gradient({ang}deg,{col} 0 {w}px,transparent {w}px {gap}px)"
def glow(col,x,y,r): return f"radial-gradient(circle at {x}% {y}%,{col},transparent {r}%)"
BG=[('b_cyber','Cyber city',[stripes(90,'#19e3ff33',2,26),stripes(0,'#ff2bd633',2,26),G(180,'#0b1030','#1c375e','#87e9ff')],0),
 ('b_haunt','Haunted castle',[glow('#e9e0ff',72,22,14),G(180,'#17132b','#373052','#b8a3e6')],0),
 ('b_rainbow','Rainbow falls',[G(120,'#ff7ad9','#ffd60a','#7ef9ff','#b388ff','#ff7ad9')],1),
 ('b_temple','Golden temple',[stripes(90,'#ffffff22',10,40),G(180,'#ffdd83','#e0a244','#ad7136')],0),
 ('b_stargarden','Star garden',[dots('#ffffff',1,34),dots('#caabfc',2,58),G(180,'#120f3a','#2d266a','#caabfc')],0),
 ('b_snow','Snowy forest',[dots('#ffffff',2,30),G(180,'#e2f5fa','#a9d5da','#579ba0')],0),
 ('b_desert','Desert nights',[glow('#fff3c9',76,24,9),G(180,'#221a4d','#382d6b 45%','#f6bc93')],0),
 ('b_funfair','Funfair lights',[dots('#ffe14d',3,28),G(160,'#3a1466','#9b3ea4','#ffcd9c')],0),
 ('b_casino','Luxury casino',[stripes(45,'#f6dba822',6,22),stripes(-45,'#f6dba822',6,22),G(180,'#3a1424','#77415a')],0),
 ('b_falls','Mystic waterfall',[stripes(90,'#ffffff33',5,17),G(180,'#b4eeef','#5fa9c9','#427eac')],0),
 ('b_autumn','Autumn park',[dots('#a74e33',3,40),G(180,'#ffdd99','#f0a45a','#a74e33')],0),
 ('b_sunrise','Sunrise summit',[glow('#fff6c9',50,78,22),G(180,'#6a79c9','#e98f8b 55%','#ffe2ad')],0),
 ('b_orbit','Orbit station',[dots('#ffffff',1,26),glow('#91ddff',20,30,16),G(180,'#0d1326','#34456c')],0),
 ('b_cavern','Crystal cavern',[stripes(60,'#ffffff26',8,34),G(200,'#2b2a66','#5d57b4','#a6f7ff')],0),
 ('b_gardens','Royal gardens',[dots('#ffffff',2,36),dots('#ff8ad8',3,54),G(180,'#daf0a5','#7fb86a','#45774d')],0),
 ('b_dream','Dreamscape',[G(130,'#ffd5f1','#b9b6ff','#777abf','#ffd5f1')],1),
 ('b_holo','Hologram grid',[stripes(90,'#9efaff55',1,22),stripes(0,'#9efaff55',1,22),G(180,'#061a22','#164c61')],0),
 ('b_lava','Lava core',[G(140,'#2a0505','#b01212','#ff7a1a','#ffd60a','#b01212','#2a0505')],1),
 ('b_ocean','Deep ocean',[dots('#bfeaff66',3,46),G(180,'#3fa9ff','#12408a','#060f2e')],0),
 ('b_candy','Candy clouds',[dots('#ffffff',9,44),G(180,'#ffc6e6','#ffe9f6')],0),
 ('b_tokyo','Midnight city',[stripes(90,'#ffe14d44',3,19),G(180,'#0a0a1e','#27134a 60%','#ff2bd6')],0),
 ('b_emerald','Emerald forest',[stripes(90,'#0b3d2466',9,31),G(180,'#bff5c5','#3ddc84','#0f6b3c')],0),
 ('b_thunder','Thunderstorm',[stripes(100,'#ffe14d55',2,90),G(180,'#1a1f33','#3b4666','#8a96b8')],0),
 ('b_blossom','Cherry blossom',[dots('#ffffff',3,38),dots('#ff8ad8',4,62),G(180,'#ffe3ef','#ffb3d1')],0),
 ('b_arctic','Arctic dawn',[G(180,'#b388ff','#8fdbff 45%','#ffffff')],0),
 ('b_volcano','Volcano sunset',[glow('#ffd60a',50,92,30),G(180,'#3a0a2a','#b01212 60%','#ff9f1c')],0),
 ('b_matrix','Code rain',[stripes(90,'#39ff1455',2,13),G(180,'#020a04','#0a2e12')],0),
 ('b_vapor','Vaporwave',[stripes(0,'#ffffff44',2,24),G(180,'#ff7ad9','#b388ff 50%','#7ef9ff')],0),
 ('b_velvet','Royal velvet',[stripes(90,'#00000022',14,28),G(180,'#7b2cbf','#3a0f66')],0),
 ('b_swamp','Toxic swamp',[dots('#c6ff3d',4,50),G(180,'#1c2a10','#3d5a1a','#c6ff3d')],0),
 ('b_flare','Solar flare',[G(120,'#fff6b0','#ffd60a','#ff5a1f','#ffd60a','#fff6b0')],1),
 ('b_moon','Moonlit lake',[glow('#ffffff',70,24,8),stripes(0,'#ffffff1f',2,14),G(180,'#0d1a3a','#27447a','#8fb3e6')],0),
 ('b_gum','Bubblegum pop',[dots('#ffffff',6,30),G(135,'#ff8ad8','#ffd60a')],0),
 ('b_blackgold','Black gold',[stripes(45,'#ffd60a55',3,26),G(180,'#0a0a0a','#2a2208')],0)]
css=[]
for i,(id,name,layers,anim) in enumerate(BG):
    new[id]=['bg',name,1]; rank[id]=(i+1)/(len(BG)+1)
    css.append(f".bg-{id}{{background:{','.join(layers)}" + (";background-size:300% 300%;animation:hue 5s ease-in-out infinite" if anim else "") + "}")
# ---- BITZ PIECE special sale: fixed prices, about ten minutes of gold each ----
import bitzpiece as BP
bp_price={}; hatv={}; accv={}; petv={}
for id,(name,cols,deco,price) in BP.OUT.items(): new[id]=['outfit',name,1]; outc[id]=cols; outx[id]={'deco':deco}; bp_price[id]=price
for id,(name,spec,price) in BP.HAT.items(): new[id]=['hat',name,1]; hatv[id]=spec; bp_price[id]=price
for id,(name,spec,price) in BP.ACC.items(): new[id]=['acc',name,1]; accv[id]=spec; bp_price[id]=price
for id,(name,spec,price) in BP.PET.items(): new[id]=['pet',name,1]; petv[id]=spec; bp_price[id]=price
for id,name,price in [('g_blaster','Blaster',0),('g_pulse','Pulse',150000),('g_scatter','Scatter',250000),('g_cannon','Cannon',400000),('g_longshot','Longshot',600000)]:
    new[id]=['gun',name,1]; bp_price[id]=price
import wild as WILDM
for id,(name,price,spec) in WILDM.W.items(): new[id]=['pet',name,price,2]; petv[id]=spec
items={**base,**new}
# ---- prices. Regular shop items: about one every 20 seconds at first, most of the catalogue in roughly six hours ----
PRESTIGE={'aurora':3200000,'halo':3600000,'phoenix':4200000,'cosmic':5000000}
reg=[k for k,v in items.items() if v[2]>0 and not (len(v)>3 and v[3]) and k not in PRESTIGE and k not in bp_price]
old=lambda k: rank[k] if k in rank else None
ranked=sorted([k for k in reg if k not in rank], key=lambda k:(base[k][2],k))
n0=len(ranked); pos={k:i/(n0-1) for i,k in enumerate(ranked)}; pos.update(rank)
order=sorted(reg,key=lambda k:(pos[k],k)); N=len(order)
TARGET=21600000
def curve(t,top): return 15000*(top/15000)**(t**1.35)
lo,hi=100000,5000000
for _ in range(60):
    mid=(lo+hi)/2; tot=sum(curve(i/(N-1),mid) for i in range(N))
    lo,hi=(mid,hi) if tot<TARGET else (lo,mid)
def nice(p): 
    step=1000 if p<50000 else 5000 if p<250000 else 10000 if p<1000000 else 50000
    return int(round(p/step)*step)
prices={k:nice(curve(i/(N-1),lo)) for i,k in enumerate(order)}
prices.update(PRESTIGE); prices.update(bp_price)
for k,v in items.items():
    if len(v)>3 and v[3]==1: prices[k]=9000000 if (k in C and C[k]['myth']) else 2000000
    elif len(v)>3 and v[3]==2: prices[k]=v[2]
for k,p in prices.items(): items[k][2]=p
print('regular items',N,'sum',sum(prices[k] for k in order),'cheapest',prices[order[0]],'median',prices[order[N//2]],'top',prices[order[-1]],'exclusives',sum(1 for v in items.values() if len(v)>3 and v[3]),'bgs',sum(1 for v in items.values() if v[0]=='bg'))
j=lambda o: json.dumps(o,separators=(',',':'))
block="/*CAT>*/\n/* generated by tools/catalog.py: exclusive costumes, new outfits and scenes, and every price */\nconst FULLV = "+j(full)+";\nObject.assign(ITEMS, "+j(new)+");\nObject.assign(OUTC, "+j(outc)+");\nObject.assign(OUTX, "+j(outx)+");\nObject.assign(HATV, "+j(hatv)+");\nObject.assign(ACCV, "+j(accv)+");\nObject.assign(PETV, "+j(petv)+");\nconst BITZP = "+j([k for k in bp_price if not k.startswith('g_')])+", BITZD = "+j({**BP.DESC,**WILDM.DESC})+";\n{ const P = "+j(prices)+"; Object.keys(P).forEach(k => { if (ITEMS[k]) ITEMS[k][2] = P[k]; }); }\n/*<CAT*/\n"
anchor="const SLOTN = {"
assert anchor in s
s=s.replace(anchor,block+anchor,1)
open(P,'w').write(s)
open('src/shop.js','w').write("/* generated by tools/catalog.py from the page: what exists, which slot it goes in, what it costs, and [3] = only from loot boxes */\nexport const ITEMS = "+j(items)+";\nexport const HAIRS = "+j(hairs)+";\n")
c=open('public/open-world.css').read(); c=re.sub(r"/\*BG>\*/.*?/\*<BG\*/\n","",c,flags=re.S)
open('public/open-world.css','w').write(c+"/*BG>*/\n"+"\n".join(css)+"\n/*<BG*/\n")
