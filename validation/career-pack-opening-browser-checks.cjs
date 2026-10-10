/* Run against the isolated local lab. Uses externally supplied Playwright; installs nothing. */
const {chromium}=require(process.env.POKER_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('assert/strict'),fs=require('fs');
const OUT=require('path').join(__dirname,'career-pack-opening-screenshots/pass2');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({headless:true,...(process.env.POKER_CHROMIUM ? {executablePath:process.env.POKER_CHROMIUM} : {})});let checks=0,inspections=0,errors=[];
async function state(p){return p.evaluate(()=>PokerPackLab.state)}
async function ready(p){await p.waitForFunction(()=>!PokerPackLab.state.busy);}
async function setup(p,study){await p.goto(`${process.env.POKER_LAB_ORIGIN || 'http://127.0.0.1:8766'}/career-pack-opening-lab.html?pass=2`);await p.locator('#pko-sound').click();await p.locator('.pko-lab summary').click();await p.locator('#pko-study').selectOption(study);await p.locator('#pko-load-study').click();await p.locator('.pko-lab summary').click();await p.evaluate(()=>scrollTo(0,0));}
async function open(p,pack){await p.locator(`[data-packet="${pack}"]`).click();await p.waitForTimeout(400);await p.evaluate(()=>window.qaCards=[...document.querySelectorAll('[data-card]')]);await p.locator('#pko-main').click();await ready(p);assert.equal((await state(p)).phase,'open');await p.locator('#pko-main').click();await ready(p);await p.waitForTimeout(380);assert.equal((await state(p)).phase,'cards');assert(await p.evaluate(()=>qaCards.every((el,i)=>document.querySelector(`[data-card="${i}"]`)===el)));checks+=3;}
for(const [width,height,study]of [[390,844,'A'],[390,844,'B'],[390,844,'C'],[390,844,'D'],[320,700,'ordinary'],[375,667,'double'],[430,932,'cosmetic'],[768,1024,'A']]){
 const ctx=await b.newContext({viewport:{width,height},deviceScaleFactor:2});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(`${width}:${e.message}`));await p.addInitScript(()=>{window.qaWrites=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){qaWrites.push(k);return set.call(this,k,v)};});await setup(p,study);await p.screenshot({path:`${OUT}/choose-${width}-${study}.png`});const buttons=await p.locator('.pko-console').boundingBox();assert(buttons.y+buttons.height<=height+8,`console off-screen at ${width}x${height}: ${JSON.stringify(buttons)}`);checks++;
 await open(p,(width+height)%3);const n=(await state(p)).items.length;
 for(let i=0;i<n;i++){
  let s=await state(p);assert.equal(s.active,i);assert.equal(s.seen,i+1);assert.equal(s.parked,i);checks+=3;
  await p.locator('#pko-left').click();await p.waitForTimeout(350);assert.equal((await state(p)).inspecting,i);assert(await p.evaluate(()=>qaCards.every(el=>el.isConnected)));checks+=2;const box=await p.locator(`[data-card="${i}"]`).boundingBox();const area=await p.locator('#pko-stage').boundingBox();const info=await p.locator('#pko-inspect-info').boundingBox();assert(box.y>=area.y+50&&box.y+box.height<=info.y+4,`card overlaps detail panel ${width}:${study}:${i}`);checks++;
  await p.screenshot({path:`${OUT}/inspect-${width}-${study}-${i}.png`});if(width===390){await p.locator('#pko-right').click();await p.waitForTimeout(400);assert(Math.abs((await state(p)).items[i].yaw-180)<6);checks++;await p.locator('#pko-main').click();await p.waitForTimeout(350);}
  await p.locator('#pko-left').click();await p.waitForTimeout(180);assert.equal((await state(p)).inspecting,null);inspections++;
  if(s.items[i].kind==='chip'){await p.locator('#pko-main').click();await ready(p);await p.waitForTimeout(450);assert((await state(p)).chips>=8);checks++;await p.screenshot({path:`${OUT}/chips-${width}-${study}.png`});}
  await p.locator('#pko-main').click();await ready(p);await p.waitForTimeout(130);
 }
 await p.waitForTimeout(450);assert.equal((await state(p)).phase,'review');await p.screenshot({path:`${OUT}/haul-${width}-${study}.png`});await p.locator('[data-card="0"]').click();await p.waitForTimeout(250);assert.equal((await state(p)).inspecting,0);await p.keyboard.press('Escape');await p.locator('#pko-main').click();await ready(p);assert.equal((await state(p)).phase,'kept');checks+=3;
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);assert.deepEqual(await p.evaluate(()=>qaWrites),[]);checks+=2;console.log('PASS',width,height,study,'inspections',n);await ctx.close();
}
assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,inspections,errors,evidence:OUT}));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
