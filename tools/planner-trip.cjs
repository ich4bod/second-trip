const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const mode=process.argv[2];
const messages={core:'treasure weight changes the cost of a real return trip',bridge:'banking the first haul closes the arch but leaves the longer way home',flask:'a carried fuel flask uses pack space and refills only at the gate'};
assert(messages[mode]);
(async()=>{
 const {create,act}=await import(pathToFileURL(process.cwd()+'/site/engine.mjs'));
 let s=create();
 const step=(type,id)=>{const old=structuredClone(s),next=act(s,{type,id});assert.deepEqual(s,old,'input mutated');s=next;return s};
 assert.equal(s.room,'gate');assert.equal(s.fuel,20);assert.deepEqual(s.pack,[]);assert.deepEqual(s.banked,[]);assert.equal(s.status,'playing');
 step('move','hall');step('move','vault');assert.equal(s.fuel,18);
 step('take','idol');step('take','ruby');assert.equal(s.pack.reduce((w,id)=>w+({idol:4,ruby:2}[id]),0),6);
 assert.equal(act(s,{type:'take',id:'coin'}),s);assert.equal(act(s,{type:'bank'}),s);
 step('move','hall');step('move','gate');assert.equal(s.fuel,14);
 step('bank');assert.deepEqual(s.pack,[]);assert.deepEqual(s.banked,['idol','ruby']);assert.equal(s.trips,1);
 assert.equal(act(s,{type:'bank'}),s);
 if(mode==='core'){
  let light=create();light=act(light,{type:'move',id:'hall'});light=act(light,{type:'move',id:'vault'});light=act(light,{type:'take',id:'ruby'});light=act(light,{type:'move',id:'hall'});light=act(light,{type:'move',id:'gate'});assert.equal(light.fuel,16);
  step('leave');assert.equal(s.status,'left');assert.equal(act(s,{type:'move',id:'hall'}),s);
  let exhausted={...create(),room:'hall',fuel:1};exhausted=act(exhausted,{type:'move',id:'well'});assert.equal(exhausted.fuel,0);assert.equal(exhausted.status,'stranded');assert.equal(act(exhausted,{type:'take',id:'cup'}),exhausted);
  let final={...create(),room:'hall',fuel:1};final=act(final,{type:'move',id:'gate'});assert.equal(final.status,'playing');assert.equal(act(final,{type:'leave'}).status,'left');
  let low={...create(),room:'well',fuel:1};assert.equal(act(low,{type:'move',id:'vault'}),low);
 }
 if(mode==='bridge'){
  step('move','hall');assert.equal(act(s,{type:'move',id:'vault'}),s);step('move','well');step('move','vault');assert.equal(s.fuel,10);assert.equal(s.room,'vault');
  let fresh=create();fresh=act(fresh,{type:'move',id:'hall'});assert.equal(act(fresh,{type:'move',id:'vault'}).room,'vault');
 }
 if(mode==='flask'){
  assert.deepEqual(create().ground.well,['cup','flask']);let f=create();f=act(f,{type:'move',id:'hall'});f=act(f,{type:'move',id:'well'});f=act(f,{type:'take',id:'cup'});f=act(f,{type:'take',id:'flask'});assert.deepEqual(f.pack,['cup','flask']);f=act(f,{type:'move',id:'hall'});f=act(f,{type:'move',id:'gate'});assert.equal(f.fuel,14);f=act(f,{type:'bank'});assert.equal(f.fuel,20);assert.deepEqual(f.banked,['cup']);assert.deepEqual(f.pack,[]);assert.equal(f.trips,1);assert(!Object.values(f.ground).flat().includes('flask'));
  let full=create();full=act(full,{type:'move',id:'hall'});full=act(full,{type:'move',id:'vault'});full=act(full,{type:'take',id:'idol'});full=act(full,{type:'take',id:'ruby'});full=act(full,{type:'move',id:'well'});assert.equal(act(full,{type:'take',id:'flask'}),full);
 }
 const {chromium}=require('playwright-core');const b=await chromium.launch({args:['--no-sandbox']});try{
 for(const width of[390,1280]){const p=await b.newPage({viewport:{width,height:900},reducedMotion:'reduce'});assert.equal((await p.goto(process.argv[3])).status(),200);
 const click=async id=>{const e=p.locator('#'+id);await e.scrollIntoViewIfNeeded();assert(await e.evaluate(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===h||e.contains(h)}));await e.click()};
 await click('move-hall');await click('move-vault');await click('take-idol');await click('take-ruby');assert.equal(await p.locator('#pack-weight').textContent(),'Pack: 6 / 6 weight. Heavy: roads cost twice as much fuel.');await click('move-hall');await click('move-gate');assert.equal(await p.locator('#fuel').textContent(),'Lantern: 14 / 20 fuel.');await click('bank');assert.equal(await p.locator('#banked-value').textContent(),'Safe at the gate: 19 treasure value.');
 if(mode==='bridge'){await click('move-hall');assert(await p.locator('#move-vault').isDisabled());assert.equal(await p.locator('#arch-note').textContent(),'The short arch has fallen. The Well road is still open.');await click('undo');await click('undo');assert.equal(await p.locator('#arch-note').textContent(),'The short arch stands until you bank your first haul.');}
 if(mode==='flask'){await click('restart');await click('move-hall');await click('move-well');await click('take-cup');await click('take-flask');await click('move-hall');await click('move-gate');await click('bank');assert.equal(await p.locator('#fuel').textContent(),'Lantern: 20 / 20 fuel.');assert.equal(await p.locator('#banked-value').textContent(),'Safe at the gate: 5 treasure value.');await click('undo');assert.equal(await p.locator('#fuel').textContent(),'Lantern: 14 / 20 fuel.');assert(await p.locator('#drop-flask').isVisible());}
 if(mode==='core'){await click('undo');assert.equal(await p.locator('#pack-weight').textContent(),'Pack: 6 / 6 weight. Heavy: roads cost twice as much fuel.');await click('bank');await click('leave');assert.equal(await p.locator('#result').textContent(),'You left with 19 treasure value safe. What remains can stay in the dark.');await click('undo');assert(await p.locator('#bank').isDisabled());}
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`/tmp/second-trip-${mode}-${width}.png`,fullPage:true});await p.close();}
 }finally{await b.close()}
 console.log(messages[mode]);
})().catch(e=>{console.error(e);process.exitCode=1});
