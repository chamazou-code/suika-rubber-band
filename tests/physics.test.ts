import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { TableBody } from '../src/visual/physics';
import { makeTornSurface, tornEdge } from '../src/visual/fracture';

const body = (restitution = .2) => new TableBody({ position:new Vector3(0,2,0), velocity:new Vector3(1,3,0), angularVelocity:new Vector3(1,2,3), support:[new Vector3(0,-.1,0),new Vector3(.1,0,0),new Vector3(-.1,0,0),new Vector3(0,.1,0)], restitution, friction:8 });
test('fixed-step fragments follow the same trajectory at 30fps and 60fps and pause during hit-stop',()=>{
  const a=body(),b=body();for(let i=1;i<=180;i++)a.advance(i/60);for(let i=1;i<=90;i++)b.advance(i/30);
  assert.ok(a.position.distanceTo(b.position)<1e-8);assert.ok(a.rotation.angleTo(b.rotation)<1e-6);
  const old=a.position.clone();a.advance(3);assert.equal(a.position.distanceTo(old),0);
  assert.ok(a.contacts>0);assert.ok(a.velocity.length()<.15);
  for(const value of [...a.position.toArray(),...a.rotation.toArray()])assert.ok(Number.isFinite(value));
});
test('rubber rebounds more than wet fruit, while both remain above the tabletop',()=>{
  const wet=body(.1),rubber=body(.65);for(let i=1;i<=95;i++){wet.advance(i/60);rubber.advance(i/60);}
  assert.ok(rubber.position.y>wet.position.y+.08);
  for(const item of [wet,rubber])for(const point of item.support)assert.ok(point.clone().applyQuaternion(item.rotation).y+item.position.y>=.0159);
});
test('the exposed cut has a crater, jagged tears and finite geometry instead of a flat disk',()=>{
  const geometry=makeTornSurface(0,1);const positions=geometry.attributes.position;let min=Infinity,max=-Infinity;
  for(let i=0;i<positions.count;i++){min=Math.min(min,positions.getZ(i));max=Math.max(max,positions.getZ(i));}
  assert.ok(max-min>.2);assert.ok(tornEdge(-.85)<-.1);
  for(const attr of ['position','normal','uv'])for(const value of geometry.attributes[attr].array)assert.ok(Number.isFinite(value));
  geometry.dispose();
});
