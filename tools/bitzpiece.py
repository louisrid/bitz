"""BITZ PIECE: a special-sale pirate-adventure collection. Original designs only.
Outfits: OUTC colours [top, trousers, shoes] + deco on the body (torso y .42-.92, front face z .15).
Hats: head-local boxes (top of head y .56, face z .28). Extras: b = body, h = head. Pets: small voxel animals."""
from costumes import B, mir
GOLD='#e8b830'
OUT={
 'bp_captain':('Captain\'s greatcoat',['#8c1f24','#2a1d17','#1a1210'],[B(.58,.62,.05,'#8c1f24',0,.58,-.19),B(.06,.5,.03,GOLD,-.1,.67,.16,'s'),B(.06,.5,.03,GOLD,.1,.67,.16,'s')]+[B(.05,.05,.03,GOLD,x,y,.17,'s') for x in (-.17,.17) for y in (.58,.7,.82)]+mir(.2,.08,.28,GOLD,.36,.94,0,'s')+[B(.56,.07,.34,'#2a1d17',0,.46,0),B(.12,.1,.04,GOLD,0,.46,.18,'s')], 900000),
 'bp_deckhand':('Deckhand stripes',['#f2f2ec','#2b3f73','#3a2a1a'],[B(.53,.05,.31,'#2b3f73',0,y,0) for y in (.52,.64,.76,.88)]+[B(.56,.07,.33,'#c23b2f',0,.45,0)], 450000),
 'bp_navigator':('Navigator\'s vest',['#1f6f78','#d9c79f','#5a3a22'],[B(.2,.48,.02,'#f2f2ec',0,.68,.16),B(.14,.14,.03,GOLD,-.15,.78,.17,'s'),B(.08,.08,.04,'#1f6f78',-.15,.78,.18),B(.02,.06,.04,'#c23b2f',-.15,.8,.19)], 520000),
 'bp_cook':('Galley cook',['#f7f4ea','#2b2b33','#151515'],[B(.24,.12,.32,'#f08a24',0,.9,0),B(.08,.22,.03,'#f08a24',.1,.74,.17),B(.42,.3,.02,'#f7f4ea',0,.5,.17)]+[B(.05,.05,.03,'#2b2b33',.06,y,.17) for y in (.62,.72,.82)], 560000),
 'bp_gunner':('Cannoneer gear',['#4a3424','#2b2b2b','#151515'],[B(.08,.62,.03,'#2b1d12',0,.66,.16,None)]+[B(.06,.07,.04,'#c9c9c9',0,y,.18,'s') for y in (.48,.6,.72,.84)]+[B(.58,.08,.35,'#2b1d12',0,.46,0),B(.14,.12,.04,'#8a8a8a',.15,.46,.18,'s')], 650000),
 'bp_corsair':('Storm corsair',['#16161c','#16161c','#0b0b0d'],[B(.6,.64,.05,'#16161c',0,.58,-.19),B(.07,.5,.03,'#c9ced6',0,.67,.16,'s'),B(.6,.12,.36,'#3a7bd5',0,.47,0),B(.12,.3,.03,'#3a7bd5',.14,.3,.17)]+mir(.22,.1,.3,'#c9ced6',.37,.94,0,'s'), 800000),
}
HAT={
 'bp_tricorn':('Captain\'s tricorn',[B(.9,.06,.86,'#16161c',0,.6,0),B(.58,.24,.54,'#16161c',0,.74,0),B(.92,.05,.05,GOLD,0,.63,.42,'s'),B(.05,.05,.86,GOLD,.45,.63,0,'s'),B(.05,.05,.86,GOLD,-.45,.63,0,'s'),B(.14,.14,.03,GOLD,0,.74,.28,'s')]+mir(.2,.18,.2,'#16161c',.4,.7,-.36), 700000),
 'bp_bandana':('Sea bandana',[B(.68,.16,.64,'#2f6fd0',0,.58,0),B(.66,.12,.06,'#2f6fd0',0,.46,.3),B(.14,.14,.12,'#2f6fd0',0,.5,-.36),B(.06,.24,.04,'#2f6fd0',.06,.36,-.42),B(.06,.2,.04,'#2f6fd0',-.06,.38,-.42)]+[B(.06,.06,.02,'#ffffff',x,.6,.33) for x in (-.2,0,.2)], 480000),
 'bp_plume':('Plumed explorer hat',[B(1.0,.05,.96,'#5a3a22',0,.6,0),B(.56,.26,.52,'#5a3a22',0,.75,0),B(.58,.06,.54,'#c23b2f',0,.66,0),B(.08,.5,.08,'#f2f2ec',-.22,.98,-.12),B(.12,.32,.06,'#f2f2ec',-.26,1.1,-.18),B(.08,.18,.05,'#ffd60a',-.3,1.28,-.22)], 620000),
}
ACC={
 'bp_eyepatch':('Eyepatch',{'h':[B(.18,.16,.03,'#0b0b0d',.15,.27,.3),B(.66,.03,.02,'#0b0b0d',0,.4,.3),B(.03,.03,.6,'#0b0b0d',.33,.4,0),B(.03,.03,.6,'#0b0b0d',-.33,.4,0)]}, 460000),
 'bp_cutlass':('Cutlass',{'b':[B(.05,.62,.1,'#d9dde3',.33,.42,-.08,'s'),B(.16,.05,.14,GOLD,.33,.76,-.08,'s'),B(.06,.16,.06,'#3a2414',.33,.86,-.08),B(.08,.08,.08,GOLD,.33,.96,-.08,'s'),B(.58,.06,.34,'#3a2414',0,.48,0)]}, 580000),
}
PET={
 'bp_crab':('Pocket crab',[B(.42,.18,.32,'#e2452d',0,.16,0),B(.3,.1,.24,'#f26a4f',0,.28,0),B(.06,.12,.06,'#e2452d',.1,.32,.12),B(.06,.12,.06,'#e2452d',-.1,.32,.12),B(.07,.07,.07,'#ffffff',.1,.41,.12),B(.07,.07,.07,'#ffffff',-.1,.41,.12),B(.04,.04,.03,'#000',.1,.41,.16),B(.04,.04,.03,'#000',-.1,.41,.16)]+mir(.16,.12,.14,'#e2452d',.3,.24,.22)+mir(.08,.1,.08,'#c23b2f',.36,.3,.32)+[B(.04,.12,.04,'#c23b2f',sx*x,.06,z) for sx in (-1,1) for x in (.18,.24) for z in (-.08,.06)], 500000),
 'bp_monkey':('Deck monkey',[B(.3,.32,.24,'#7a4a26',0,.3,0),B(.3,.28,.26,'#7a4a26',0,.6,.04),B(.22,.18,.04,'#e0b48a',0,.56,.17),B(.05,.05,.02,'#000',.06,.62,.19),B(.05,.05,.02,'#000',-.06,.62,.19),B(.08,.04,.02,'#5a2f16',0,.52,.19)]+mir(.08,.12,.08,'#e0b48a',.18,.66,.04)+mir(.08,.26,.08,'#7a4a26',.2,.3,0)+mir(.09,.16,.1,'#7a4a26',.08,.08,0)+[B(.06,.06,.3,'#7a4a26',0,.22,-.24),B(.06,.2,.06,'#7a4a26',0,.32,-.38),B(.3,.08,.28,'#2f6fd0',0,.76,.04)], 600000),
 'bp_turtle':('Sea turtle',[B(.5,.18,.6,'#2f8a5a',0,.2,0),B(.4,.1,.5,'#3fa86e',0,.32,0),B(.18,.04,.18,'#256e47',0,.38,0),B(.2,.16,.2,'#8fc96e',0,.2,.38),B(.05,.05,.02,'#000',.06,.24,.48),B(.05,.05,.02,'#000',-.06,.24,.48)]+mir(.18,.06,.12,'#8fc96e',.3,.12,.2)+mir(.14,.06,.1,'#8fc96e',.28,.12,-.22), 680000),
}
DESC={'bp_captain':'A long red coat with gold buttons. Every crew needs one.','bp_deckhand':'Navy stripes for swabbing the deck.','bp_navigator':'A teal vest with a brass compass on the chest.','bp_cook':'Whites and an orange neckerchief for the ship\'s kitchen.','bp_gunner':'Leather, a bandolier and soot on the sleeves.','bp_corsair':'A black storm coat with a blue sash.',
 'bp_tricorn':'Three corners and a gold edge.','bp_bandana':'Tied tight for wild seas.','bp_plume':'A wide brim and a huge white feather.','bp_eyepatch':'Mysterious. Possibly unnecessary.','bp_cutlass':'A curved sword on your belt.',
 'bp_crab':'Scuttles sideways after you.','bp_monkey':'Climbs the rigging, steals your snacks.','bp_turtle':'Slow, steady and very old.'}
