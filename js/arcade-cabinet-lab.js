"use strict";
/* Isolated art/motion composition. Nothing here advances or settles poker. */
(() => {
  const W=360, P={ink:'#110e16',burgundy:'#44232e',velvet:'#281923',rose:'#754451',hi:'#97616a',gold:'#c5a45b',goldHi:'#f2d78a',goldLo:'#786239',cream:'#eee5cf',felt:'#1d4232',feltLo:'#163629',feltHi:'#274c38',glass:'#0c1919'};
  const roster=[{name:'LUCY',color:6,mood:'neutral1',body:'#665071',light:'#9374a2',dark:'#352e47'}, {name:'HARRY',color:3,mood:'neutral2',body:'#456b5c',light:'#7b9a75',dark:'#243f36'}, {name:'TONY',color:1,mood:'suspicious1',body:'#806143',light:'#b79964',dark:'#4d3829'}];
  const scene={motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,active:-1,key:-1,keyDown:false,start:0,dealStart:0};
  let canvas,c,layer,shade,tune,live,H=740,scale=1,raf=0,actionTimer=0,keys=[],cabinetHits=[],portraits=[],chipImages=[],tableCache,tableKey='';
  const cardCache=new Map();
  function rect(x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  // Scanline rasterization keeps the silhouette and sloping faces on whole pixels.
  function poly(ps,col){
    c.fillStyle=col;const lo=Math.ceil(Math.min(...ps.map(p=>p[1]))),hi=Math.floor(Math.max(...ps.map(p=>p[1])));
    for(let y=lo;y<=hi;y++){
      const xs=[];for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)c.fillRect(Math.ceil(xs[i]),y,Math.floor(xs[i+1])-Math.ceil(xs[i])+1,1);
    }
  }
  function line(x1,y1,x2,y2,col){
    let x=Math.round(x1),y=Math.round(y1),endX=Math.round(x2),endY=Math.round(y2),dx=Math.abs(endX-x),sx=x<endX?1:-1,dy=-Math.abs(endY-y),sy=y<endY?1:-1,err=dx+dy;
    while(true){rect(x,y,1,1,col);if(x===endX&&y===endY)break;const e=err*2;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
  }
  function box(x,y,w,h,col,cut=3){poly([[x+cut,y],[x+w-cut,y],[x+w,y+cut],[x+w,y+h-cut],[x+w-cut,y+h],[x+cut,y+h],[x,y+h-cut],[x,y+cut]],col);}
  function text(s,x,y,size=7,col=P.cream,align='left'){
    c.font=size+'px "Press Start 2P", monospace';c.textBaseline='top';c.textAlign=align;c.fillStyle=col;c.fillText(s,Math.round(x),Math.round(y));
  }
  const NUMBERS={
    '0':['01110','10001','10011','10101','11001','10001','01110'],
    '1':['00100','01100','00100','00100','00100','00100','01110'],
    '2':['01110','10001','00001','00010','00100','01000','11111'],
    '3':['11110','00001','00001','01110','00001','00001','11110'],
    '4':['00010','00110','01010','10010','11111','00010','00010'],
    '5':['11111','10000','10000','11110','00001','00001','11110'],
    '6':['01110','10000','10000','11110','10001','10001','01110'],
    '7':['11111','00001','00010','00100','01000','01000','01000'],
    '8':['01110','10001','10001','01110','10001','10001','01110'],
    '9':['01110','10001','10001','01111','00001','00001','01110'],
    '$':['00100','01111','10100','01110','00101','11110','00100']
  };
  function digits(s,x,y,k=1,col=P.goldHi){
    let left=Math.round(x-(s.length*6-1)*k/2);
    for(const ch of s){const rows=NUMBERS[ch];if(rows)rows.forEach((row,j)=>[...row].forEach((v,i)=>{if(v==='1')rect(left+i*k,y+j*k,k,k,col);}));left+=6*k;}
  }
  function screw(x,y){rect(x,y,3,3,P.ink);rect(x,y,2,1,P.hi);}
  function recess(x,y,w,h,ink=P.glass){box(x-2,y-2,w+4,h+5,P.ink,2);box(x,y,w,h,ink,1);rect(x+2,y+h,w-4,1,P.rose);rect(x,y,w,2,'#060d0c');}
  function readout(s,x,y,w,h,size=7,col=P.goldHi){recess(x,y,w,h);text(s,x+w/2,y+(h-size)/2,size,col,'center');}
  function diamond(x,y,r,col){poly([[x,y-r],[x+r,y],[x,y+r],[x-r,y]],col);}
  function suit(s,x,y,k,col){
    c.save();c.translate(Math.round(x),Math.round(y));
    if(s==='♦')diamond(0,0,k,col);
    if(s==='♥'){poly([[-k,-k/2],[-k/2,-k],[0,-k/2],[k/2,-k],[k,-k/2],[k,0],[0,k],[-k,0]],col);}
    if(s==='♠'){poly([[0,-k],[-k,k/4],[-k,k/2],[-k/2,k*.7],[0,k/3],[k/2,k*.7],[k,k/2],[k,k/4]],col);rect(-1,1,2,k,col);rect(-k/2,k-1,k,1,col);}
    if(s==='♣'){box(-k/2,-k,k,k,col,1);box(-k,-k/3,k,k,col,1);box(0,-k/3,k,k,col,1);rect(-1,0,2,k,col);rect(-k/2,k-1,k,1,col);}
    c.restore();
  }
  function card(rank,s,x,y,w=38,h=52,angle=0,back=false){
    const key=[rank,s,w,h,back].join(':');let art=cardCache.get(key);
    if(!art){
      art=document.createElement('canvas');art.width=w+5;art.height=h+5;
      const saved=c;c=art.getContext('2d');c.imageSmoothingEnabled=false;
      box(2,4,w,h,P.ink,2);box(0,0,w,h,'#857c67',2);box(0,0,w,h-2,P.cream,2);rect(2,2,w-4,1,'#fff6df');
      if(back){
        rect(2,2,w-4,h-6,P.goldLo);rect(3,3,w-6,h-8,'#5e293d');
        for(let a=5;a<w-4;a+=4)for(let b=5;b<h-6;b+=4)if((a+b)%8===2)rect(a,b,1,1,'#8e4c5b');
        diamond(w/2,h/2,5,P.gold);diamond(w/2,h/2,2,'#673648');
      }else{
        const col=s==='♥'||s==='♦'?'#ae4945':P.ink;
        text(rank,3,4,w<25?5:9,col);suit(s,7,19,w<25?2:3,col);suit(s,w/2,h*.59,w<25?3:7,col);
        if(w>=30){c.save();c.translate(w-3,h-6);c.rotate(Math.PI);text(rank,0,0,7,col);c.restore();}
      }
      c=saved;cardCache.set(key,art);
    }
    // Rotate a completed sprite; rotating individual scanlines creates seams.
    c.save();c.translate(Math.round(x),Math.round(y));c.rotate(angle*Math.PI/180);c.drawImage(art,0,0);c.restore();
  }
  function chip(x,y,color,stack=1,sz=14){
    const img=chipImages[color];for(let i=0;i<stack;i++){rect(x+1,y-i*3+sz*.55,sz-2,3,P.ink);if(img)c.drawImage(img,Math.round(x),Math.round(y-i*3),sz,Math.round(sz*.72));}
  }
  function platform(x,y,w,dx,top,bottom){
    poly([[x,y],[x+w,y],[x+w+dx,y+8],[x+dx,y+8]],top);
    poly([[x+dx,y+8],[x+w+dx,y+8],[x+w+dx,y+12],[x+dx,y+12]],bottom);
    line(x+dx,y+8,x+w+dx,y+8,P.goldLo);
  }
  function background(){
    rect(0,0,W,H,P.velvet);
    for(let y=0;y<H;y+=4)for(let x=0;x<W;x+=4){if((x*7+y*13)%28===0)rect(x,y,2,2,'#2e1c27');}
    rect(0,0,W,35,'#1b131e');rect(0,34,W,1,'#5a3441');
    text('POKER FACES',14,14,9,P.goldHi);text('CABINET STUDY',14,27,5,'#977a77');
    // Quiet velvet alcove: the objects get the bright accents.
    rect(7,49,2,150,'#57323e');rect(W-9,49,2,150,'#382530');
    for(const x of [15,343]){rect(x,60,2,65,'#372430');rect(x+1,60,1,1,P.hi);}
    rect(45,43,270,2,'#392732');
  }
  function feltShape(inset=0){const far=160,near=H-275;return [[64+inset,far+inset],[296-inset,far+inset],[307-inset,far+12+inset],[356-inset,near-17-inset],[354-inset,near-5-inset],[341-inset,near+7-inset],[19+inset,near+7-inset],[6+inset,near-5-inset],[4+inset,near-17-inset],[53+inset,far+12+inset]];}
  function table(){
    const far=160,near=H-275;
    if(tableKey!==String(H)){
      const saved=c;tableCache=document.createElement('canvas');tableCache.width=W;tableCache.height=H;c=tableCache.getContext('2d');c.imageSmoothingEnabled=false;
      const ps=feltShape();poly(ps.map(([x,y])=>[x+4,y+14]),'#140f19');poly(ps.map(([x,y])=>[x,y+10]),'#251c21');poly(ps,P.burgundy);poly(feltShape(3),P.rose);poly(feltShape(8),'#301f28');poly(feltShape(12),P.feltLo);
      const inner=feltShape(14);poly(inner,P.felt);
      // Pixel weave and a broad dithered pool of warm light.
      for(let y=175;y<near-7;y+=2){const t=(y-175)/(near-182),left=76+(16-76)*t,right=284+(344-284)*t;
        for(let x=Math.ceil(left/2)*2;x<right;x+=2){
          const d=Math.pow((x-180)/150,2)+Math.pow((y-(far+near)*.52)/Math.max(90,(near-far)*.7),2);
          const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5][((y/2)%4)*4+(x/2)%4];
          if(d<.8&&bayer<(1-d)*2)rect(x,y,2,2,P.feltHi);else if((x+y)%4===0)rect(x,y,1,1,'#204534');
        }
      }
      // Hand-authored stitching follows the converging rail.
      line(66,173,294,173,'#76505b');for(let i=0;i<10;i++){let y=190+i*(near-210)/10,t=(y-174)/(near-174);rect(58-40*t,y,2,3,'#141e19');rect(300+40*t,y,2,3,'#141e19');}
      line(22,near+6,338,near+6,P.hi);line(25,near+8,335,near+8,'#20171f');
      c=saved;tableKey=String(H);
    }
    c.drawImage(tableCache,0,0);
    // Counter wells are shaped into the tabletop, rather than floating UI.
    const py=near-(H<700?40:66);box(132,py-16,96,31,'#152d24',4);line(138,py-15,220,py-15,'#10231d');line(138,py+14,220,py+14,'#3d5c42');
    chip(154,py-3,0,3);chip(166,py+1,2,2);chip(179,py-5,0,4);chip(193,py+2,1,2);chip(206,py-1,0,2);
    readout('POT $80',143,py+(H<700?17:20),74,H<700?14:17,7);
    const dx=30,dy=near-70;card('', '',dx,dy,28,39,-8,true);card('','',dx+1,dy-4,28,39,-8,true);rect(dx+1,dy+34,26,2,P.goldLo);
    // Marks stay quiet. No extra economy or achievement systems.
    for(const x of [71,289]){line(x-18,243,x-12,243,'#16372b');line(x+12,243,x+18,243,'#16372b');}
  }
  function cabinet(index,now){
    const r=roster[index],x=[41,145,257][index],y=[58,42,58][index],w=62,dx=[-16,5,16][index];
    const active=scene.active===index,t=active?(now-scene.start):99999;
    const knock=scene.motion&&active&&t<520?[0,1,2,1,0][Math.min(4,Math.floor(t/104))]:0;
    c.save();c.translate(0,knock);
    // Feet and a stepped directional contact shadow anchor the cabinet.
    poly([[x-9,y+146],[x+w+8,y+146],[x+w+23,y+155],[x+3,y+155]],'#10271f');rect(x+3,y+141,12,8,P.ink);rect(x+w-14,y+141,12,8,P.ink);
    rect(x+5,y+147,8,2,P.goldLo);rect(x+w-12,y+147,8,2,P.goldLo);
    const sideX=dx<0?x:x+w,backX=sideX+dx;
    poly([[sideX,y],[backX,y-10],[backX,y+73],[backX+Math.sign(dx)*5,y+86],[backX+Math.sign(dx)*5,y+119],[backX,y+132],[sideX,y+144]],P.ink);
    poly([[sideX,y+2],[backX+Math.sign(dx)*2,y-7],[backX+Math.sign(dx)*2,y+73],[backX+Math.sign(dx)*6,y+88],[backX+Math.sign(dx)*6,y+118],[backX+Math.sign(dx)*2,y+130],[sideX,y+141]],r.dark);
    line(sideX,y+5,backX,y-7,r.light);line(backX,y+1,backX,y+69,r.body);
    // Side stripe and ventilation, visible only on the outward flank.
    const sx=(sideX+backX)/2;line(sx,y+17,sx,y+66,r.body);for(let i=0;i<4;i++)line(sx-2,y+106+i*4,sx+2,y+103+i*4,'#14161b');
    poly([[x,y],[x+dx,y-10],[x+w+dx,y-10],[x+w,y]],r.light);line(x+dx+2,y-9,x+w+dx-2,y-9,'#b2ad83');
    // Front profile: prominent hood, recessed screen, projecting shelf.
    poly([[x,y],[x+w,y],[x+w,y+75],[x+w+4,y+84],[x+w+4,y+105],[x+w,y+113],[x+w,y+144],[x,y+144],[x,y+113],[x-4,y+105],[x-4,y+84],[x,y+75]],P.ink);
    poly([[x+2,y+2],[x+w-2,y+2],[x+w-2,y+75],[x+w+2,y+85],[x+w+2,y+104],[x+w-2,y+112],[x+w-2,y+140],[x+2,y+140],[x+2,y+112],[x-2,y+104],[x-2,y+85],[x+2,y+75]],r.body);
    line(x+2,y+3,x+w-2,y+3,r.light);line(x+2,y+4,x+2,y+74,r.light);line(x+w-2,y+15,x+w-2,y+75,r.dark);
    recess(x+5,y+6,w-10,14);text(r.name,x+w/2,y+10,7,P.cream,'center');
    rect(x+5,y+20,w-10,3,P.ink);rect(x+6,y+22,w-12,1,r.light);
    recess(x+5,y+26,w-10,52);rect(x+7,y+28,w-14,46,'#101c20');
    const face=portraits[index];if(face)c.drawImage(face,x+7,y+28,48,46);
    // Glass reflection in two authored pixel bands, never blur or bloom.
    rect(x+8,y+29,20,1,'#d8e3b322');rect(x+8,y+30,8,1,'#d8e3b322');
    for(let v=y+31;v<y+74;v+=3)rect(x+7,v,w-14,1,'#0a0d1612');
    rect(x+4,y+78,w-8,3,r.dark);rect(x+6,y+79,w-12,1,r.light);
    platform(x-4,y+85,w+8,0,r.light,r.dark);recess(x+6,y+85,w-12,12);digits('$0980',x+w/2,y+87);
    // A small action key and coin slot belong to the machine itself.
    const act=active&&(t>330||!scene.motion)?'CHECK':'—';recess(x+7,y+106,w-14,15);text(act,x+w/2,y+110,6,active?P.goldHi:'#96a494','center');
    rect(x+8,y+127,15,3,P.ink);rect(x+10,y+126,11,1,r.light);for(let v=0;v<3;v++)rect(x+35,y+126+v*3,15,1,r.dark);
    rect(x+3,y+139,w-6,2,r.light);screw(x+4,y+121);screw(x+w-7,y+121);
    // Status lamps signal a turn; no constant flashing.
    rect(x+w-10,y+9,3,3,active?P.goldHi:r.dark);if(active)rect(x+w-10,y+13,3,1,P.goldLo);
    // Cards emerge onto a shallow shelf, rather than hanging from the frame.
    platform(x+7,y+143,w-14,0,'#887348','#463a29');rect(x+12,y+144,w-24,2,P.ink);
    card('','',x+12,y+150,17,23,-5,true);card('','',x+34,y+150,17,23,5,true);
    c.restore();
    cabinetHits[index]={x:x-15,y:y-13,w:w+30,h:185};
  }
  function board(now){
    const near=H-275,small=H<700,y=Math.max(small?220:246,160+(near-160)*(small?.36:.43)),w=small?36:39,h=small?46:52,gap=9,total=w*3+gap*2,left=(W-total)/2;
    [['K','♥'],['Q','♥'],['10','♣']].forEach(([rank,s],i)=>{
      let off=0,ang=[-2,0,2][i];if(scene.dealStart&&scene.motion){const t=Math.max(0,Math.min(1,(now-scene.dealStart-i*100)/600));off=t<.75?-44*(1-t/.75):Math.sin((t-.75)/.25*Math.PI)*2;ang+=t<.75?-9*(1-t/.75):0;if(now-scene.dealStart<i*100)return;}
      card(rank,s,left+i*(w+gap),y+off,w,h,ang);
    });
  }
  function desk(){
    const top=H-248,bottom=H-14;
    // One wedge casing, with an actual front face under the controls.
    poly([[27,top-6],[333,top-6],[358,bottom-20],[358,bottom],[350,bottom+7],[10,bottom+7],[2,bottom],[2,bottom-20]],P.ink);
    poly([[25,top],[335,top],[357,bottom-25],[353,bottom-18],[7,bottom-18],[3,bottom-25]],P.rose);
    poly([[30,top+3],[330,top+3],[348,bottom-29],[12,bottom-29]],P.burgundy);
    line(30,top+3,330,top+3,P.hi);line(30,top+4,13,bottom-29,P.goldLo);line(330,top+4,348,bottom-29,'#241a25');
    poly([[7,bottom-18],[353,bottom-18],[352,bottom+1],[348,bottom+4],[12,bottom+4],[8,bottom+1]],'#33212b');
    line(8,bottom-18,352,bottom-18,P.gold);line(12,bottom+3,348,bottom+3,'#613e49');
    for(let i=0;i<7;i++)rect(151+i*8,bottom-10,5,2,P.ink);screw(21,bottom-9);screw(336,bottom-9);
    // Fasteners and hard-lit edges are restrained, consistent details.
    screw(35,top+10);screw(322,top+10);line(33,top+9,98,top+9,P.hi);line(267,top+9,327,top+9,P.hi);
    // Deep bank compartment, back rows raised on physical shelves.
    poly([[26,top+29],[91,top+29],[99,top+153],[18,top+153]],P.ink);
    poly([[29,top+32],[88,top+32],[95,top+147],[23,top+147]],'#291e25');
    poly([[29,top+32],[35,top+39],[35,top+134],[23,top+147]],'#48333a');
    line(29,top+32,88,top+32,P.goldLo);line(23,top+147,95,top+147,P.gold);text('BANK',59,top+17,6,P.gold,'center');
    rect(34,top+103,48,5,'#6f573a');rect(31,top+123,55,5,'#80653b');rect(26,top+143,66,4,'#ab894b');
    [[36,top+97,2,5],[51,top+96,1,7],[67,top+95,2,5],[33,top+119,0,4],[48,top+118,1,6],[64,top+117,0,5],[79,top+120,2,4],[29,top+139,0,3],[46,top+139,0,4],[63,top+139,0,3],[80,top+139,0,2]].forEach(a=>chip(...a));
    // Readable displays in recessed bays. All information has a physical home.
    readout('KING HIGH',109,top+59,142,17,7,P.cream);
    recess(109,top+83,142,30);text('YOUR TURN',180,top+89,7,P.goldHi,'center');text('CHECK OR BET',180,top+101,6,'#aaa98c','center');
    text('STACK',180,top+122,5,'#ad9777','center');recess(109,top+133,142,20);
    for(let i=0;i<5;i++){const x=137+i*20;rect(x,top+135,18,16,'#212627');rect(x,top+141,18,1,'#090e11');digits('00980'[i],x+9,top+136,2);}text('$',116,top+139,8,P.gold);
    // Your cards are seated inside a projecting brass holder.
    card('5','♥',130,top-29,42,62,-5);card('8','♦',182,top-30,42,62,5);
    poly([[123,top+30],[238,top+30],[242,top+36],[119,top+36]],P.goldLo);rect(119,top+36,123,5,P.ink);rect(120,top+36,121,2,P.goldHi);rect(122,top+39,117,1,P.gold);
    // Blind lamps, hand investment and two small built-in keys.
    rect(271,top+27,21,12,'#172422');rect(300,top+27,21,12,'#172422');text('SB',282,top+31,5,'#657260','center');text('BB',310,top+31,5,'#657260','center');
    text('BET THIS',296,top+54,5,P.cream,'center');text('HAND',296,top+63,5,P.cream,'center');readout('$20',271,top+76,51,22,8);
    readout('P.I.P.',273,top+113,47,14,5,'#839781');rect(277,top+104,3,3,'#526749');
    // Physical wagering fader in a narrow trough above the main key deck.
    recess(109,top+166,142,17);text('20',116,top+171,5,P.gold);rect(145,top+173,84,2,P.ink);for(let i=0;i<9;i++)rect(147+i*9,top+170,1,2,P.goldLo);
    rect(156,top+169,8,7,P.ink);rect(156,top+168,8,5,P.gold);rect(157,top+168,6,1,P.goldHi);text('+',240,top+171,5,P.gold);
    screw(32,top+166);screw(321,top+166);
    line(14,top+190,346,top+190,P.ink);line(16,top+191,344,top+191,P.hi);
  }
  function actionKeys(now){
    const y=H-67,xs=[18,132,246],families=[['FOLD','#b86460','#de8a79','#743b40'],['CHECK','#c7a451','#f0d087','#7a632f'],['BET','#629574','#93b08c','#395d48']];
    families.forEach(([label,face,hi,lo],i)=>{
      const down=scene.key===i?(scene.keyDown?5:release(now-scene.start)):0,x=xs[i],w=96;
      box(x-3,y-4,w+6,48,P.ink,3);box(x-1,y+4,w+2,41,'#241b25',2);
      box(x,y+down,w,36,lo,2);box(x,y-5+down,w,33,face,2);
      rect(x+2,y-5+down,w-4,2,hi);rect(x+1,y-2+down,1,25,hi);rect(x+2,y+28+down,w-4,2,lo);
      text(label,x+w/2,y+8+down,9,P.ink,'center');
      keys[i]={x:x-4,y:y-8,w:w+8,h:53};
    });
  }
  function release(t){if(!scene.motion)return 0;const frames=[5,2,-1,1,0];return frames[Math.min(frames.length-1,Math.floor(t/70))];}
  function draw(now=performance.now()){
    c.clearRect(0,0,W,H);background();table();cabinet(1,now);cabinet(0,now);cabinet(2,now);board(now);desk();actionKeys(now);
  }
  function animate(){
    if(raf)return;function tick(t){draw(t);const age=t-scene.start,dealAge=t-scene.dealStart;
      if(scene.keyDown||scene.motion&&((scene.active>=0&&age<900)||(scene.key>=0&&age<360)||(scene.dealStart&&dealAge<900)))raf=requestAnimationFrame(tick);else{raf=0;draw(t);}}
    raf=requestAnimationFrame(tick);
  }
  function announce(s){live.textContent=s;}
  function act(index){clearTimeout(actionTimer);scene.active=index;scene.start=performance.now();layer.dataset.action=roster[index].name+' checks';announce(roster[index].name+' checks. Animation demonstration; the hand stays the same.');animate();actionTimer=setTimeout(()=>{scene.active=-1;draw();},1800);}
  function land(){scene.dealStart=performance.now();layer.dataset.action='Card landing';announce('Replaying the three community cards landing.');animate();}
  function size(){const r=layer.getBoundingClientRect();scale=r.width/W;H=Math.round(r.height/scale);canvas.width=W;canvas.height=H;c=canvas.getContext('2d');c.imageSmoothingEnabled=false;draw();
    document.querySelectorAll('[data-cc-seat]').forEach((b,i)=>place(b,cabinetHits[i]));document.querySelectorAll('[data-cc-key]').forEach((b,i)=>place(b,keys[i]));
  }
  function place(el,r){Object.assign(el.style,{left:r.x/W*100+'%',top:r.y/H*100+'%',width:r.w/W*100+'%',height:r.h/H*100+'%'});}
  async function imageAsset(src){const img=new Image();img.src=src;await img.decode();return img;}
  async function portrait(mood,color){const img=await imageAsset(faceArtPath(mood)),cv=document.createElement('canvas');cv.width=48;cv.height=48;const cc=cv.getContext('2d');cc.imageSmoothingEnabled=false;cc.drawImage(img,0,0,48,48);
    const data=cc.getImageData(0,0,48,48),k=faceTintK(FACE_COLORS[color].fill,FACE_SOURCE_FAMILIES.purple.sourceFill);
    for(let i=0;i<data.data.length;i+=4){const r=data.data[i],m=(data.data[i+1]+data.data[i+2])/2;for(let j=0;j<3;j++)data.data[i+j]=Math.max(0,Math.min(255,k[j]*r+(1-k[j])*m));}cc.putImageData(data,0,0);return cv;
  }
  function build(){
    document.documentElement.dataset.ccStudy='on';settings.sound=false;
    document.querySelectorAll('#app > *').forEach(el=>el.classList.add('hidden'));
    layer=document.createElement('section');layer.id='cc-study';layer.setAttribute('aria-label','Poker Faces pixel arcade cabinet visual study');
    layer.innerHTML='<canvas id="cc-art" aria-label="Three dimensional pixel arcade cabinets around a green poker table, with a burgundy control desk. Staged flop: King of Hearts, Queen of Hearts, Ten of Clubs. Your cards: Five of Hearts, Eight of Diamonds. Pot 80. Stack 980." role="img"></canvas>'+roster.map((r,i)=>'<button class="cc-hit cc-cabinet-hit" data-cc-seat="'+i+'" aria-label="Animate '+r.name+' checking"></button>').join('')+['Fold','Check','Bet'].map((s,i)=>'<button class="cc-hit cc-action-hit" data-cc-key="'+i+'" aria-label="Try '+s+' key press"></button>').join('')+'<button class="cc-tune" aria-label="Tune cabinet study">TUNE</button><span class="cc-live" aria-live="polite"></span><div class="cc-loading">PREPARING THE TABLE…</div>';
    $('app').appendChild(layer);canvas=layer.querySelector('canvas');tune=layer.querySelector('.cc-tune');live=layer.querySelector('.cc-live');
    shade=document.createElement('div');shade.className='cc-shade';shade.hidden=true;
    shade.innerHTML='<section class="cc-sheet" role="dialog" aria-modal="true" aria-labelledby="cc-title"><div class="cc-sheet-head"><h2 id="cc-title">THE CABINET EXPERIMENT</h2><button class="cc-close" aria-label="Close cabinet study controls">×</button></div><p>A composed pixel art and motion study using the v0.66.1 faces. Tap a cabinet to see its action. Hold and release the three action keys.</p><div class="cc-options"><button data-cc-motion="on" aria-pressed="true">MOTION ON</button><button data-cc-motion="off" aria-pressed="false">STILL</button></div><button class="cc-replay">REPLAY TABLE MOMENT</button><button class="cc-deal">REPLAY CARD LANDING</button><p class="cc-note">This is a visual prototype. Actions do not play poker or change your save. The current game remains untouched.</p></section>';
    layer.appendChild(shade);const close=()=>{shade.hidden=true;tune.focus();};tune.onclick=()=>{shade.hidden=false;shade.querySelector('.cc-close').focus();};shade.querySelector('.cc-close').onclick=close;
    shade.addEventListener('click',e=>{if(e.target===shade)close();const b=e.target.closest('[data-cc-motion]');if(b){scene.motion=b.dataset.ccMotion==='on';syncMotion();draw();}});
    shade.querySelector('.cc-deal').onclick=()=>{close();land();};shade.querySelector('.cc-replay').onclick=()=>{close();act(1);setTimeout(land,650);};
    shade.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const bs=[...shade.querySelectorAll('button')],first=bs[0],last=bs.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
    layer.querySelectorAll('[data-cc-seat]').forEach((b,i)=>b.onclick=()=>act(i));
    layer.querySelectorAll('[data-cc-key]').forEach((b,i)=>{
      const down=()=>{scene.key=i;scene.keyDown=true;scene.start=performance.now();draw();};
      const up=()=>{if(scene.key!==i||!scene.keyDown)return;scene.keyDown=false;scene.start=performance.now();announce(['Fold','Check','Bet'][i]+' key released. Press demonstration only.');animate();};
      b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);down();});b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
      b.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();down();}});b.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();up();}});b.addEventListener('blur',up);
      b.addEventListener('click',e=>{e.preventDefault();if(e.detail===0&&!scene.keyDown){scene.key=i;scene.start=performance.now();animate();}});
    });
    new ResizeObserver(size).observe(layer);syncMotion();size();
    document.addEventListener('visibilitychange',()=>{if(document.hidden){scene.keyDown=false;scene.active=-1;scene.key=-1;if(raf)cancelAnimationFrame(raf);raf=0;}else draw();});
  }
  function syncMotion(){shade.querySelectorAll('[data-cc-motion]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.ccMotion==='on')===scene.motion)));layer.dataset.motion=scene.motion?'on':'off';}
  async function start(){build();await document.fonts.ready;cardCache.clear();[portraits,chipImages]=await Promise.all([Promise.all(roster.map(r=>portrait(r.mood,r.color))),Promise.all(['white','red','yellow'].map(s=>imageAsset('assets/chips/chip-'+s+'-01.png')))]);layer.querySelector('.cc-loading').remove();layer.dataset.ready='true';size();}
  const fail=err=>{console.error('Cabinet study:',err);const el=layer?.querySelector('.cc-loading');if(el)el.textContent='STUDY COULD NOT LOAD — RELOAD TO RETRY';};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start().catch(fail));else start().catch(fail);
})();
