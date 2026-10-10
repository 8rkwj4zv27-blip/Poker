/* Lab QA, separate from the dependency-free npm test suites.
   Start a server, then PACK_RITUAL_URL=http://127.0.0.1:8768/pack-ritual-lab.html
   node validation/pack-ritual-touch-checks.cjs.
   PACK_RITUAL_BROWSER optionally selects an already installed Chromium.
   Uses the game's touch harness, actual touch gestures and production chips. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {withPage}=require('./tools/touch-harness');
const url=process.env.PACK_RITUAL_URL||'http://127.0.0.1:8768/pack-ritual-lab.html';
const out=path.join(__dirname,'pack-ritual-captures');
fs.mkdirSync(out,{recursive:true});
const results=[];
async function study(width,height,reducedMotion=false){
  const errors=await withPage({width,height,reducedMotion,executablePath:process.env.PACK_RITUAL_BROWSER},async(page,touch)=>{
    await page.goto(url);const f=page.locator('#pk-game').contentFrame();
    await f.locator('#ritual').waitFor();const fr=page.frames()[1];
    const state=()=>fr.evaluate(()=>PackRitual.state);
    const ready=()=>fr.waitForFunction(()=>PackRitual&&!PackRitual.state.busy,null,{timeout:15000});
    const click=async(sel)=>{await ready();await f.locator(sel).tap();await ready();};
    const snap=async(name)=>{if(reducedMotion)return;await page.screenshot({path:path.join(out,`${width}x${height}-${name}.png`)});};
    const rect=async(sel)=>{const r=await f.locator(sel).boundingBox();assert.ok(r,sel+' is visible');return r;};
    const drag=async(x,y,xx,yy)=>{await touch.drag(x,y,xx,yy,14,14);await touch.end();await ready();};
    await ready();await click('#pr-tune');await click('#pr-sound');await click('#pr-done');await snap('01-packets');
    const felt=(await rect('#pr-stage'));const firstHeight=felt.height;
    // The outer page's real storage remains outside the frame's memory shim.
    await page.evaluate(()=>localStorage.setItem('pack-ritual-qa','untouched'));
    const initial=await state();assert.equal(initial.wallet,5000);
    await click('[data-packet="1"]');
    await f.locator('#pr-main').tap();await page.waitForTimeout(reducedMotion?0:240);await snap('02-buy');await ready();
    assert.equal((await state()).wallet,4700);
    const seam=await rect('[data-packet="1"] [data-seam]');
    await touch.start(seam.x+seam.width*.12,seam.y+seam.height*.5);
    await touch.move(seam.x+seam.width*.50,seam.y+seam.height*.5);await page.waitForTimeout(90);await snap('03-mid-rip');
    assert.ok((await state()).tear>0&&(await state()).tear<1,'tear is finger-driven');
    await touch.move(seam.x+seam.width*.95,seam.y+seam.height*.5);await touch.end();await ready();
    if((await state()).phase==='sealed')await click('#pr-main');
    assert.equal((await state()).phase,'open');await page.waitForTimeout(reducedMotion?0:250);await snap('04-mouth');
    assert.ok((await state()).cards.every(c=>c.pocket),'cards are still inside the wrapper');
    const packet=await rect('[data-packet="1"]');
    await touch.start(packet.x+packet.width*.5,packet.y+packet.height*.2);
    await touch.move(packet.x+packet.width*.5,packet.y-packet.height*.10);await page.waitForTimeout(100);await snap('05-extraction');
    await touch.move(packet.x+packet.width*.5,packet.y-packet.height*.5);await touch.end();await ready();
    if((await state()).phase==='open')await click('#pr-main');
    assert.equal((await state()).phase,'cards');assert.ok((await state()).cards.every(c=>!c.pocket));
    await page.waitForTimeout(reducedMotion?0:300);await snap('06-common');
    const node=await fr.evaluate(()=>{const el=document.querySelector('[data-card="0"]');el.dataset.qaIdentity='same-card';return el.dataset.qaIdentity;});
    assert.equal(node,'same-card');
    await click('[data-card="0"]');assert.equal((await state()).inspecting,0);await snap('07-inspect');
    const details=await f.locator('#pr-info').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,text:el.textContent,rect:el.getBoundingClientRect().toJSON(),lines:[...el.querySelectorAll('.crt-line')].map(p=>({client:p.clientWidth,scroll:p.scrollWidth}))}));
    assert.ok(details.text.includes('TOP PRIZE')&&details.text.includes('HOLD’EM'));
    // CRT glass has overscan effects; test the text and visible sheet bounds.
    assert.ok(details.rect.left>=0&&details.rect.right<=width,'inspection sheet fits the phone');assert.ok(details.lines.every(l=>l.scroll<=l.client+2),'event text does not clip');
    const card=await rect('[data-card="0"]');assert.ok(card.y>=felt.y-6,'inspected card clears the top rail');
    await drag(card.x+card.width*.48,card.y+card.height*.5,card.x+card.width*.80,card.y+card.height*.44);
    assert.ok(Math.abs((await state()).cards[0].yaw)>15,'inspection angle responds to touch');await snap('08-angle');
    await click('#pr-left');await page.waitForTimeout(reducedMotion?0:300);await snap('09-reverse');
    assert.ok((await state()).cards[0].yaw>90,'manual turn shows a neutral back');
    await click('#pr-main');assert.equal((await state()).inspecting,null);
    assert.equal(await f.locator('[data-card="0"]').getAttribute('data-qa-identity'),'same-card');
    const first=await rect('[data-card="0"]');await touch.flick(first.x+first.width*.5,first.y+first.height*.5,first.x+first.width*.95,first.y+first.height*.62);await ready();
    assert.equal((await state()).active,1);await page.waitForTimeout(reducedMotion?0:170);await snap('10-rare');
    if(!reducedMotion)assert.ok(await f.locator('#pr-award').evaluate(el=>Number(getComputedStyle(el).opacity)>0),'Rare is visually announced without audio');
    await click('#pr-main');await page.waitForTimeout(reducedMotion?0:280);await snap('11-legendary');
    assert.equal((await state()).active,2);assert.ok((await state()).chipRevealed);assert.ok((await state()).coinCount>0);assert.equal((await state()).chipValue,75);
    if(!reducedMotion){assert.ok(await f.locator('.pr-card[data-rarity="legendary"]').evaluate(el=>Number(el.style.getPropertyValue('--aura'))>.1),'Legendary glows without sound');}
    await page.waitForTimeout(reducedMotion?0:950);await snap('12-chips');
    const sprites=await fr.evaluate(()=>[...document.querySelectorAll('[class*="coin"] img')].map(e=>e.getAttribute('src')));
    assert.ok(!sprites.some(src=>src&&src.includes('assets/chips')),'no obsolete chip PNG sprites');
    await click('#pr-main');await click('#pr-main');assert.equal((await state()).phase,'review');await page.waitForTimeout(reducedMotion?0:250);await snap('13-spread');
    const newHeight=(await rect('#pr-stage')).height;assert.ok(Math.abs(firstHeight-newHeight)<2,'felt has no phase layout shift');
    await click('[data-card="2"]');assert.equal((await state()).inspecting,2);await snap('14-legendary-inspect');await click('#pr-main');
    await f.locator('#pr-main').tap();await page.waitForTimeout(reducedMotion?0:650);await snap('15-filing');await ready();assert.equal((await state()).phase,'choose');
    assert.equal((await state()).wallet,4775);assert.equal(Object.values((await state()).collection).reduce((a,b)=>a+b,0),4);
    await click('#pr-collection');await snap('16-collection');await click('#pr-close-collection');
    assert.equal(await page.evaluate(()=>localStorage.getItem('pack-ritual-qa')),'untouched');
    assert.equal(await fr.evaluate(()=>document.getElementById('home').scrollTop),0);
    // Four mixed packs expose all sixteen kind/rarity placeholders.
    if(width===390&&!reducedMotion){
      for(let n=1;n<4;n++){
        await click('[data-packet="0"]');await click('#pr-main');await click('#pr-main');await click('#pr-main');
        for(let i=0;i<4;i++)await click('#pr-main');
        await click('#pr-main');assert.equal((await state()).packNumber,n+1);
      }
      assert.equal(Object.keys((await state()).collection).length,16,'all sixteen combinations collect');
      assert.equal((await state()).wallet,4595);
    }
    // Reset remains usable and bounded; reduce or mute only in this memory copy.
    await click('#pr-tune');await click('#pr-reset');assert.equal((await state()).phase,'choose');
    results.push({viewport:`${width}x${height}`,reducedMotion,packNumber:(await state()).packNumber,errors:page._errors});
  });
  assert.deepEqual(errors,[],'no console or page errors');
}
(async()=>{await study(390,844);await study(375,667);await study(375,667,true);fs.writeFileSync(path.join(out,'QA.json'),JSON.stringify({tested:new Date().toISOString(),results},null,2)+'\n');console.log('Pack Ritual touch checks passed: two phones, full loop, gestures, all sixteen finds, reduced motion, storage isolation.');})().catch(e=>{console.error(e);process.exitCode=1;});
