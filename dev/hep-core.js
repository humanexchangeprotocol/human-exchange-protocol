// ============================================================
// SHA3-256 — Pure JavaScript Keccak (SHA-3 padding)
// ============================================================
const SHA3=(()=>{
const RC=[0x0000000000000001n,0x0000000000008082n,0x800000000000808an,0x8000000080008000n,0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n];
const ROTC=[0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const PI=[0,10,20,5,15,16,1,11,21,6,7,17,2,12,22,23,8,18,3,13,14,24,9,19,4];
const M64=0xffffffffffffffffn;
function rot(x,n){n=n%64;if(n===0)return x;return((x<<BigInt(n))|(x>>BigInt(64-n)))&M64}
function kf(st){
  for(let rd=0;rd<24;rd++){
    const c=[];for(let x=0;x<5;x++)c[x]=st[x]^st[x+5]^st[x+10]^st[x+15]^st[x+20];
    for(let x=0;x<5;x++){const d=c[(x+4)%5]^rot(c[(x+1)%5],1);for(let y=0;y<25;y+=5)st[x+y]=(st[x+y]^d)&M64;}
    const t=new Array(25);for(let i=0;i<25;i++)t[PI[i]]=rot(st[i],ROTC[i]);
    for(let y=0;y<25;y+=5)for(let x=0;x<5;x++)st[y+x]=(t[y+x]^((~t[y+(x+1)%5])&M64&t[y+(x+2)%5]))&M64;
    st[0]=(st[0]^RC[rd])&M64;
  }
}
function hash256(input){
  if(typeof input==='string')input=new TextEncoder().encode(input);
  const rate=136,st=new Array(25).fill(0n);
  const bl=Math.floor(input.length/rate)+1;
  const pad=new Uint8Array(bl*rate);
  pad.set(input);pad[input.length]=0x06;pad[pad.length-1]|=0x80;
  for(let off=0;off<pad.length;off+=rate){
    for(let i=0;i<rate;i+=8){
      const li=i>>3;let v=0n;
      for(let b=0;b<8;b++)v|=BigInt(pad[off+i+b])<<BigInt(b*8);
      st[li]=(st[li]^v)&M64;
    }
    kf(st);
  }
  const out=new Uint8Array(32);
  for(let i=0;i<4;i++){let v=st[i];for(let b=0;b<8;b++){out[i*8+b]=Number(v&0xffn);v>>=8n;}}
  return Array.from(out).map(x=>x.toString(16).padStart(2,'0')).join('');
}
return{hash256}
})();

// ============================================================
// HEP PROTOCOL CORE ENGINE v2.0.0
// Backward compatible: verifies SV=1 records, creates SV=2
// ============================================================
const APP_VERSION='2.61.37';
const VERSION_CHECK_URL='version.json';
const DEFAULT_WITNESS_URL='https://witness.thesitefit.com';
const HCP=(()=>{'use strict';
const PV='2.0.0',SV=6,SV_LEGACY=1,SV_V2=2,SV_V3=3,SV_V4=4,SV_V5=5;
const SCALE_MAX=1000000;
const MAX_PHOTO_BYTES=100000;
const CURVE={name:'ECDSA',namedCurve:'P-256'},SALG={name:'ECDSA',hash:'SHA-256'},HALG='SHA-256';
const PBKDF_I=250000,AESN='AES-GCM',AESL=256,IVL=12,SLL=16;
const ET=['exchange'],ES=['provided','received'];
const COMMITMENT_TEXT='This protocol is free, will never require payment, and never restricts exchanges.';
const XP={SESSION:'session',QR:'qr',OFFLINE:'offline'}; // exchange_path values
const RT_PING='ping'; // record type for genesis ping (not an exchange)
const RT_GENESIS='genesis'; // record type for chain origin anchor
function isAct(r){return r.type!==RT_PING&&r.type!==RT_GENESIS;}
const u8=new TextEncoder(),u8d=new TextDecoder();
const bth=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
const htb=h=>{const a=new Uint8Array(h.length/2);for(let i=0;i<h.length;i+=2)a[i/2]=parseInt(h.substr(i,2),16);return a.buffer};
const btb=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const btf=s=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a.buffer};
const rb=n=>crypto.getRandomValues(new Uint8Array(n));
const now=()=>new Date().toISOString();

// --- Key management ---
async function gkp(){return await crypto.subtle.generateKey(CURVE,true,['sign','verify'])}
async function ek(k){return await crypto.subtle.exportKey('jwk',k)}
async function ipk(j){return await crypto.subtle.importKey('jwk',j,CURVE,true,['verify'])}
async function isk(j){return await crypto.subtle.importKey('jwk',j,CURVE,true,['sign'])}
async function ikp(p,s){return{publicKey:await ipk(p),privateKey:await isk(s)}}
async function kfp(j){const c=JSON.stringify({crv:j.crv,kty:j.kty,x:j.x,y:j.y});return bth(await crypto.subtle.digest(HALG,u8.encode(c))).substring(0,16)}

// --- Record creation ---
function cr(f){
  if(!ET.includes(f.type))throw new Error('Invalid type');
  if(typeof f.value!=='number'||f.value<0)throw new Error('Value must be non-negative');
  if(f.value>SCALE_MAX)throw new Error('Value exceeds SCALE_MAX ('+SCALE_MAX+')');
  if(!ES.includes(f.energyState))throw new Error('Invalid energyState');
  if(!f.counterparty)throw new Error('Counterparty required');
  const r={serVersion:SV,type:f.type,value:f.value,energyState:f.energyState,counterparty:f.counterparty,timestamp:f.timestamp||now(),seq:null,prevHash:null,prevHash3:null,signature:null};
  if(f.counterpartyName)r.counterpartyName=f.counterpartyName;
  if(typeof f.duration==='number'&&f.duration>=0)r.duration=f.duration;
  if(f.description)r.description=f.description;
  if(f.category)r.category=f.category;
  if(f.street)r.street=f.street;if(f.city)r.city=f.city;if(f.state)r.state=f.state;
  // Physical reality fields
  if(f.geo)r.geo=f.geo;
  if(f.device)r.device=f.device;
  if(f.sensorHash)r.sensorHash=f.sensorHash;
  if(f.entropyPrev)r.entropyPrev=f.entropyPrev;
  // Integrity fields
  if(f.exchangePath)r.exchangePath=f.exchangePath;
  if(typeof f.clockSkew==='number')r.clockSkew=f.clockSkew;
  if(f.chainMerkleRoot)r.chainMerkleRoot=f.chainMerkleRoot;
  if(f.counterpartyDeviceHash)r.counterpartyDeviceHash=f.counterpartyDeviceHash;
  // Proof of Human snapshot (null for regular records, populated on PoH ping)
  if(f.pohSnapshot)r.pohSnapshot=f.pohSnapshot;
  return r;
}

// --- Genesis record ---
async function cg(f){
  const r={serVersion:SV,type:RT_GENESIS,value:0,energyState:'none',counterparty:'',counterpartyName:'',timestamp:f.timestamp||now(),seq:null,prevHash:null,prevHash3:null,signature:null};
  r.protocolCommitment=bth(await crypto.subtle.digest(HALG,u8.encode(COMMITMENT_TEXT)));
  if(f.photoHash)r.photoHash=f.photoHash;
  if(f.photoData)r.photoData=f.photoData;
  if(f.sensorHash)r.sensorHash=f.sensorHash;
  if(f.device)r.device=f.device;
  if(f.geo)r.geo=f.geo;
  if(f.pohSnapshot)r.pohSnapshot=f.pohSnapshot;
  if(typeof f.connectivityAvailable==='boolean')r.connectivityAvailable=f.connectivityAvailable;
  return r;
}

// --- Ping record (proof-of-human heartbeat, no counterparty/value) ---
function cpr(f){
  const r={serVersion:SV,type:RT_PING,value:0,energyState:'none',counterparty:'',counterpartyName:'',timestamp:f.timestamp||now(),seq:null,prevHash:null,prevHash3:null,signature:null};
  if(f.geo)r.geo=f.geo;
  if(f.device)r.device=f.device;
  if(f.sensorHash)r.sensorHash=f.sensorHash;
  if(f.entropyPrev)r.entropyPrev=f.entropyPrev;
  if(f.exchangePath)r.exchangePath=f.exchangePath;
  if(f.chainMerkleRoot)r.chainMerkleRoot=f.chainMerkleRoot;
  if(f.photoHash)r.photoHash=f.photoHash;
  if(f.pohSnapshot)r.pohSnapshot=f.pohSnapshot;
  return r;
}

// --- Serialization (supports SV=1 legacy and SV=2) ---
function ser(r){
  if(r.serVersion===SV_LEGACY){
    return[`sv:${r.serVersion}`,`ty:${r.type}`,`va:${r.value}`,`es:${r.energyState}`,`cp:${r.counterparty}`,`cn:${r.counterpartyName||''}`,`du:${r.duration!==undefined?r.duration:''}`,`de:${r.description||''}`,`ca:${r.category||''}`,`st:${r.street||''}`,`ci:${r.city||''}`,`sa:${r.state||''}`,`ts:${r.timestamp}`,`sq:${r.seq}`,`ph:${r.prevHash||'genesis'}`].join('|');
  }
  if(r.serVersion===SV_V2){
    return[
      `sv:${r.serVersion}`,`ty:${r.type}`,`va:${r.value}`,`es:${r.energyState}`,
      `cp:${r.counterparty}`,`cn:${r.counterpartyName||''}`,
      `du:${r.duration!==undefined?r.duration:''}`,
      `de:${r.description||''}`,`ca:${r.category||''}`,
      `st:${r.street||''}`,`ci:${r.city||''}`,`sa:${r.state||''}`,
      `ts:${r.timestamp}`,`sq:${r.seq}`,
      `ph:${r.prevHash||'genesis'}`,
      `p3:${r.prevHash3||'genesis'}`,
      `ge:${r.geo?JSON.stringify(r.geo):''}`,
      `dv:${r.device?JSON.stringify(r.device):''}`,
      `sh:${r.sensorHash||''}`,
      `ep:${r.entropyPrev||''}`,
      `po:${r.pohSnapshot?JSON.stringify(r.pohSnapshot):''}`,
      `pc:${r.protocolCommitment||''}`
    ].join('|');
  }
  if(r.serVersion===SV_V3){
    return[
      `sv:${r.serVersion}`,`ty:${r.type}`,`va:${r.value}`,`es:${r.energyState}`,
      `cp:${r.counterparty}`,`cn:${r.counterpartyName||''}`,
      `du:${r.duration!==undefined?r.duration:''}`,
      `de:${r.description||''}`,`ca:${r.category||''}`,
      `st:${r.street||''}`,`ci:${r.city||''}`,`sa:${r.state||''}`,
      `ts:${r.timestamp}`,`sq:${r.seq}`,
      `ph:${r.prevHash||'genesis'}`,
      `p3:${r.prevHash3||'genesis'}`,
      `ge:${r.geo?JSON.stringify(r.geo):''}`,
      `dv:${r.device?JSON.stringify(r.device):''}`,
      `sh:${r.sensorHash||''}`,
      `ep:${r.entropyPrev||''}`,
      `xp:${r.exchangePath||''}`,
      `cs:${typeof r.clockSkew==='number'?r.clockSkew:''}`,
      `mr:${r.chainMerkleRoot||''}`,
      `po:${r.pohSnapshot?JSON.stringify(r.pohSnapshot):''}`,
      `pc:${r.protocolCommitment||''}`
    ].join('|');
  }
  if(r.serVersion===SV_V4){
    return[
      `sv:${r.serVersion}`,`ty:${r.type}`,`va:${r.value}`,`es:${r.energyState}`,
      `cp:${r.counterparty}`,`cn:${r.counterpartyName||''}`,
      `du:${r.duration!==undefined?r.duration:''}`,
      `de:${r.description||''}`,`ca:${r.category||''}`,
      `st:${r.street||''}`,`ci:${r.city||''}`,`sa:${r.state||''}`,
      `ts:${r.timestamp}`,`sq:${r.seq}`,
      `ph:${r.prevHash||'genesis'}`,
      `p3:${r.prevHash3||'genesis'}`,
      `ge:${r.geo?JSON.stringify(r.geo):''}`,
      `dv:${r.device?JSON.stringify(r.device):''}`,
      `sh:${r.sensorHash||''}`,
      `ep:${r.entropyPrev||''}`,
      `xp:${r.exchangePath||''}`,
      `cs:${typeof r.clockSkew==='number'?r.clockSkew:''}`,
      `mr:${r.chainMerkleRoot||''}`,
      `po:${r.pohSnapshot?JSON.stringify(r.pohSnapshot):''}`,
      `pc:${r.protocolCommitment||''}`,
      `pt:${r.photoHash||''}`,
      `co:${typeof r.connectivityAvailable==='boolean'?r.connectivityAvailable?1:0:''}`
    ].join('|');
  }
  if(r.serVersion===SV_V5){
    return[
      `sv:${r.serVersion}`,`ty:${r.type}`,`va:${r.value}`,`es:${r.energyState}`,
      `cp:${r.counterparty}`,`cn:${r.counterpartyName||''}`,
      `du:${r.duration!==undefined?r.duration:''}`,
      `de:${r.description||''}`,`ca:${r.category||''}`,
      `st:${r.street||''}`,`ci:${r.city||''}`,`sa:${r.state||''}`,
      `ts:${r.timestamp}`,`sq:${r.seq}`,
      `ph:${r.prevHash||'genesis'}`,
      `p3:${r.prevHash3||'genesis'}`,
      `ge:${r.geo?JSON.stringify(r.geo):''}`,
      `dv:${r.device?JSON.stringify(r.device):''}`,
      `sh:${r.sensorHash||''}`,
      `ep:${r.entropyPrev||''}`,
      `xp:${r.exchangePath||''}`,
      `cs:${typeof r.clockSkew==='number'?r.clockSkew:''}`,
      `mr:${r.chainMerkleRoot||''}`,
      `po:${r.pohSnapshot?JSON.stringify(r.pohSnapshot):''}`,
      `pc:${r.protocolCommitment||''}`,
      `pt:${r.photoHash||''}`,
      `co:${typeof r.connectivityAvailable==='boolean'?r.connectivityAvailable?1:0:''}`,
      `cd:${r.counterpartyDeviceHash||''}`
    ].join('|');
  }
  if(r.serVersion===SV){
    return[
      `sv:${r.serVersion}`,`ty:${r.type}`,`va:${r.value}`,`es:${r.energyState}`,
      `cp:${r.counterparty}`,`cn:${r.counterpartyName||''}`,
      `du:${r.duration!==undefined?r.duration:''}`,
      `de:${r.description||''}`,`ca:${r.category||''}`,
      `st:${r.street||''}`,`ci:${r.city||''}`,`sa:${r.state||''}`,
      `ts:${r.timestamp}`,`sq:${r.seq}`,
      `ph:${r.prevHash||'genesis'}`,
      `p3:${r.prevHash3||'genesis'}`,
      `ge:${r.geo?JSON.stringify(r.geo):''}`,
      `dv:${r.device?JSON.stringify(r.device):''}`,
      `sh:${r.sensorHash||''}`,
      `ep:${r.entropyPrev||''}`,
      `xp:${r.exchangePath||''}`,
      `cs:${typeof r.clockSkew==='number'?r.clockSkew:''}`,
      `mr:${r.chainMerkleRoot||''}`,
      `po:${r.pohSnapshot?JSON.stringify(r.pohSnapshot):''}`,
      `pc:${r.protocolCommitment||''}`,
      `pt:${r.photoHash||''}`,
      `co:${typeof r.connectivityAvailable==='boolean'?r.connectivityAvailable?1:0:''}`,
      `cd:${r.counterpartyDeviceHash||''}`,
      `pd:${r.photoData||''}`
    ].join('|');
  }
  throw new Error('Unsupported serVersion: '+r.serVersion);
}

// --- Hashing (dual: SHA-256 via Web Crypto + SHA3-256 via pure JS) ---
async function hr(r){return bth(await crypto.subtle.digest(HALG,u8.encode(ser(r))))}
function hr3(r){return SHA3.hash256(ser(r))}

// --- Signing and verification ---
async function sr(r,k){r.signature=btb(await crypto.subtle.sign(SALG,k,u8.encode(ser(r))));return r}
async function vr(r,k){if(!r.signature)return false;return await crypto.subtle.verify(SALG,k,btf(r.signature),u8.encode(ser(r)))}

// --- Chain Merkle root ---
async function cmr(c){
  if(c.length===0)return null;
  // Compute leaf hashes from each record's hash
  let nodes=[];
  for(let i=0;i<c.length;i++){
    nodes.push(await crypto.subtle.digest(HALG,u8.encode(await hr(c[i]))));
  }
  // Build tree: pair and hash until one root remains
  while(nodes.length>1){
    const next=[];
    for(let i=0;i<nodes.length;i+=2){
      const left=new Uint8Array(nodes[i]);
      const right=new Uint8Array(i+1<nodes.length?nodes[i+1]:nodes[i]); // duplicate last if odd
      const combined=new Uint8Array(left.length+right.length);
      combined.set(left,0);combined.set(right,left.length);
      next.push(await crypto.subtle.digest(HALG,combined));
    }
    nodes=next;
  }
  return bth(nodes[0]);
}

// --- Entropy chaining: hash previous record's sensor data ---
async function cep(c){
  if(c.length===0)return null;
  const prev=c[c.length-1];
  // Chain from previous record's sensor hash + pohSnapshot + geo
  const src=JSON.stringify({sh:prev.sensorHash||null,po:prev.pohSnapshot||null,ge:prev.geo||null});
  return bth(await crypto.subtle.digest(HALG,u8.encode(src)));
}

// --- Chain operations ---
function cc(){return[]}
async function atc(c,r,k){
  r.seq=c.length;
  if(c.length===0){
    r.prevHash=null;
    r.prevHash3=null;
  }else{
    r.prevHash=await hr(c[c.length-1]);
    r.prevHash3=hr3(c[c.length-1]);
  }
  await sr(r,k);
  c.push(r);
  return r;
}
async function vc(c,k){
  const e=[];
  for(let i=0;i<c.length;i++){
    if(c[i].seq!==i)e.push(`Record ${i}: seq mismatch`);
    if(i===0){
      if(c[i].prevHash!==null)e.push('Record 0: should be genesis');
    }else{
      if(c[i].prevHash!==await hr(c[i-1]))e.push(`Record ${i}: SHA-256 hash mismatch`);
      if((c[i].serVersion===SV||c[i].serVersion===SV_V5||c[i].serVersion===SV_V4||c[i].serVersion===SV_V3||c[i].serVersion===SV_V2)&&c[i].prevHash3){
        if(c[i].prevHash3!==hr3(c[i-1]))e.push(`Record ${i}: SHA3 hash mismatch`);
      }
    }
    if(!await vr(c[i],k))e.push(`Record ${i}: bad signature`);
    if(i===0&&c[i].protocolCommitment){
      const expected=bth(await crypto.subtle.digest(HALG,u8.encode(COMMITMENT_TEXT)));
      if(c[i].protocolCommitment!==expected)e.push('Record 0: protocol commitment mismatch');
    }
  }
  return{valid:e.length===0,errors:e};
}
function cd(c){const ex=c.filter(isAct);if(!ex.length)return 0;return ex.reduce((s,r)=>s+r.value,0)/ex.length}
function wb(c){let b=0;for(const r of c){if(!isAct(r))continue;if(r.energyState==='provided')b+=r.value;else if(r.energyState==='received')b-=r.value;}return b}
function er(a,b){const da=cd(a),db=cd(b);if(!db||!da)return 1;return da/db}
function grr(c){const ex=c.filter(isAct);if(!ex.length)return{provided:0,received:0,ratio:0};let p=0,r=0;for(const x of ex){if(x.energyState==='provided')p++;else if(x.energyState==='received')r++;}return{provided:p,received:r,ratio:p/(p+r||1)}}

// --- Encryption ---
async function dkp(pin,salt){const km=await crypto.subtle.importKey('raw',u8.encode(pin),'PBKDF2',false,['deriveKey']);return await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:PBKDF_I,hash:'SHA-256'},km,{name:AESN,length:AESL},false,['encrypt','decrypt'])}
async function ewp(data,pin){const salt=rb(SLL),iv=rb(IVL),key=await dkp(pin,salt),ct=await crypto.subtle.encrypt({name:AESN,iv},key,u8.encode(JSON.stringify(data)));return{salt:btb(salt),iv:btb(iv),ciphertext:btb(ct)}}
async function dwp(enc,pin){const key=await dkp(pin,new Uint8Array(btf(enc.salt)));return JSON.parse(u8d.decode(await crypto.subtle.decrypt({name:AESN,iv:new Uint8Array(btf(enc.iv))},key,btf(enc.ciphertext))))}

// --- Backup ---
async function xb(c,pj,sj,pin){return{hcpVersion:PV,serVersion:SV,exportedAt:now(),fingerprint:await kfp(pj),keys:await ewp({publicKey:pj,privateKey:sj},pin),chain:c,chainLength:c.length,balance:wb(c),density:cd(c)}}
async function ib(bk,pin){const keys=await dwp(bk.keys,pin),pk=await ipk(keys.publicKey),sk=await isk(keys.privateKey),v=await vc(bk.chain,pk);if(!v.valid)throw new Error('Chain verification failed');return{chain:bk.chain,publicKey:pk,privateKey:sk,publicKeyJwk:keys.publicKey,privateKeyJwk:keys.privateKey}}

// --- Handshake payloads ---
// --- Payload signing ---
async function spld(payloadObj,privKey){const canonical=JSON.stringify(payloadObj);const sig=btb(await crypto.subtle.sign(SALG,privKey,u8.encode(canonical)));payloadObj.sig=sig;return JSON.stringify(payloadObj)}
async function vpld(jsonStr,pubJwk){const d=JSON.parse(jsonStr);if(!d.sig)return{valid:false,payload:d,error:'no signature'};const sig=d.sig;delete d.sig;const canonical=JSON.stringify(d);const pk=await ipk(pubJwk);const valid=await crypto.subtle.verify(SALG,pk,btf(sig),u8.encode(canonical));d.sig=sig;return{valid,payload:d}}

// --- Handshake / Confirmation / Settlement payloads ---
async function ghp(pj,c,ex,privKey,witnesses,deviceHash){const snap=cs(c);const payload={h:PV,a:'hs',p:{c:pj.crv,k:pj.kty,x:pj.x,y:pj.y},f:await kfp(pj),d:cd(c),n:snap.n,e:{t:ex.type,v:ex.value,s:ex.energyState,d:ex.description||undefined,c:ex.category||undefined,u:ex.duration||undefined},s:snap,z:now()};if(witnesses&&witnesses.length)payload.w=witnesses;if(deviceHash)payload.dh=deviceHash;if(privKey)return await spld(payload,privKey);return JSON.stringify(payload)}
function php(j){const d=JSON.parse(j);if(d.a!=='hs'&&d.action!=='handshake')throw new Error('Not a handshake');const pub=d.p||d.pub;const fp=d.f||d.fp;const ex=d.e||d.exchange;if(!pub||!(pub.x))throw new Error('Missing key');const exNorm={type:ex.t||ex.type,value:ex.v!==undefined?ex.v:ex.value,energyState:ex.s||ex.energyState,description:ex.d||ex.description,category:ex.c||ex.category,duration:ex.u||ex.duration};if(typeof exNorm.value!=='number')throw new Error('Missing exchange');return{pub:{crv:pub.c||pub.crv,kty:pub.k||pub.kty,x:pub.x,y:pub.y},fp:fp,density:d.d!==undefined?d.d:d.density,chainLen:d.n!==undefined?d.n:d.chainLen,exchange:exNorm,snapshot:d.s||null,ts:d.z||d.ts,sig:d.sig||null,witnesses:d.w||[],deviceHash:d.dh||null}}
function rfh(h,l){let es=h.exchange.energyState;if(es==='provided')es='received';else if(es==='received')es='provided';return cr({type:h.exchange.type,value:h.exchange.value,energyState:es,counterparty:h.fp,counterpartyName:l.counterpartyName,duration:h.exchange.duration,description:h.exchange.description,category:h.exchange.category,street:l.street,city:l.city,state:l.state,counterpartyDeviceHash:h.deviceHash||undefined})}

// --- Attestation ---
function ga(c,mode='safe',red=null){return c.map(r=>{const a={serVersion:r.serVersion,type:r.type,value:r.value,energyState:r.energyState,timestamp:r.timestamp,seq:r.seq};if(r.duration!==undefined)a.duration=r.duration;if(r.description)a.description=r.description;if(r.category)a.category=r.category;const rd=mode==='safe'||(mode==='granular'&&red&&red.has(r.seq));if(rd){a.counterparty='[redacted]';}else{a.counterparty=r.counterparty;if(r.counterpartyName)a.counterpartyName=r.counterpartyName;if(r.street)a.street=r.street;if(r.city)a.city=r.city;if(r.state)r.state=r.state;}return a})}
function as(c){const ex=c.filter(isAct);const g=grr(c),cats={};for(const r of ex){const k=r.category||'uncategorized';cats[k]=(cats[k]||0)+1;}const pc=c.length-ex.length;return{actCount:ex.length,pingCount:pc,density:cd(c),balance:wb(c),giveReceiveRatio:g,categories:cats,firstAct:c.length?c[0].timestamp:null,lastAct:c.length?c[c.length-1].timestamp:null}}

// --- Chain snapshot ---
function cs(c){
  if(!c.length)return{n:0,d:0,g:0,r:0,cats:{},words:{},time:{},stab:{},t0:null,t1:null,pings:0};
  const ex=c.filter(isAct);
  const pc=c.filter(r=>r.type===RT_PING).length;
  const gr=grr(c);
  const cats={};
  ex.forEach(function(rec){
    const k=rec.category||'uncategorized';
    if(!cats[k])cats[k]={n:0,tv:0,g:0,r:0,vals:[],tl:[]};
    cats[k].n++;cats[k].tv+=rec.value;cats[k].vals.push(rec.value);
    if(rec.energyState==='provided')cats[k].g++;else if(rec.energyState==='received')cats[k].r++;
    // Per-category timeline entry: [timestamp_ms, value, role_char]. Role is
    // 'g' (gave/provided) or 'r' (received). Counterparty identity NOT captured —
    // this is the receiver's own chain's pricing-over-time signal, nothing more.
    var tms=new Date(rec.timestamp).getTime();
    if(!isNaN(tms)){
      cats[k].tl.push([tms,rec.value,rec.energyState==='provided'?'g':(rec.energyState==='received'?'r':'o')]);
    }
  });
  const catEntries=Object.entries(cats).sort(function(a,b){return b[1].n-a[1].n;});
  const catOut={},stabOut={},catsTimelineOut={};
  var otherCount=0,otherTotal=0,otherG=0,otherR=0;
  catEntries.forEach(function(e,i){
    const k=e[0],ct=e[1];
    if(i<20){catOut[k]={n:ct.n,avg:Math.round(ct.tv/ct.n),g:ct.g,r:ct.r};}
    else{otherCount+=ct.n;otherTotal+=ct.tv;otherG+=ct.g;otherR+=ct.r;}
    if(i<15){
      const avg=ct.tv/ct.n;
      const mn=Math.min.apply(null,ct.vals),mx=Math.max.apply(null,ct.vals);
      const variance=ct.vals.reduce(function(s,v){return s+(v-avg)*(v-avg);},0)/ct.vals.length;
      stabOut[k]=[mn,mx,Math.round(avg),Math.round(Math.sqrt(variance)*10)/10];
    }
    // Emit timelines for top 10 most-active categories only.
    // Sort chronologically (oldest first), cap at 30 most recent entries.
    // This keeps snapshot size bounded: 10 cats * 30 entries * ~30 bytes ≈ 9KB max.
    if(i<10 && ct.tl.length>0){
      var sorted=ct.tl.slice().sort(function(a,b){return a[0]-b[0];});
      if(sorted.length>30)sorted=sorted.slice(-30);
      catsTimelineOut[k]=sorted;
    }
  });
  if(otherCount>0)catOut['other']={n:otherCount,avg:otherTotal>0?Math.round(otherTotal/otherCount):0,g:otherG,r:otherR};
  const wordMap={};
  const stopWords=new Set(['the','a','an','and','or','of','to','in','for','on','at','is','it','my','by','with','from','this','that','was','but','are','be','has','had','do','did','not','so','if','no','up']);
  ex.forEach(function(rec){
    if(!rec.description)return;
    rec.description.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).forEach(function(w){
      if(w.length>2&&!stopWords.has(w)){wordMap[w]=(wordMap[w]||0)+1;}
    });
  });
  const wordsSorted=Object.entries(wordMap).sort(function(a,b){return b[1]-a[1];}).slice(0,20);
  const wordsOut={};wordsSorted.forEach(function(e){wordsOut[e[0]]=e[1];});
  const nowD=new Date();
  const cutoffYear=nowD.getFullYear(),cutoffMonth=nowD.getMonth()+1;
  const timeMonthly={},timeYearly={};
  ex.forEach(function(rec){
    const d=new Date(rec.timestamp);
    const y=d.getFullYear(),m=d.getMonth()+1;
    const monthsAgo=(cutoffYear-y)*12+(cutoffMonth-m);
    if(monthsAgo<12){const k=y+'-'+String(m).padStart(2,'0');timeMonthly[k]=(timeMonthly[k]||0)+1;}
    else{const k=String(y);timeYearly[k]=(timeYearly[k]||0)+1;}
  });
  const timeOut={};
  Object.keys(timeYearly).sort().forEach(function(k){timeOut[k]=timeYearly[k];});
  Object.keys(timeMonthly).sort().forEach(function(k){timeOut[k]=timeMonthly[k];});
  // Integrity summary for sharing
  var photoCamera=0,photoFile=0,sensorCount=0,deviceSet={},counterpartySet={},cpDeviceSet={};
  var genesisHasPhoto=false,genesisPhotoSource=null,pingTimestamps=[];
  var platformSet={};
  c.forEach(function(rec){
    if(rec.type===RT_GENESIS){
      if(rec.photoData)genesisHasPhoto=true;
      if(rec.pohSnapshot&&rec.pohSnapshot.photoSource)genesisPhotoSource=rec.pohSnapshot.photoSource;
    }
    if(rec.pohSnapshot){
      sensorCount++;
      if(rec.pohSnapshot.photoSource==='camera')photoCamera++;
      else if(rec.pohSnapshot.photoSource==='file')photoFile++;
    }
    if(rec.device){
      var devKey=typeof rec.device==='string'?rec.device:JSON.stringify(rec.device);
      deviceSet[devKey]=1;
      try{
        var devObj=typeof rec.device==='string'?JSON.parse(rec.device):rec.device;
        if(devObj.platform)platformSet[devObj.platform]=1;
      }catch(e){}
    }
    if(rec.type===RT_PING)pingTimestamps.push(new Date(rec.timestamp).getTime());
    if(isAct(rec)&&rec.counterparty)counterpartySet[rec.counterparty]=1;
    if(isAct(rec)&&rec.counterpartyDeviceHash)cpDeviceSet[rec.counterpartyDeviceHash]=1;
  });
  var avgPingGapDays=null;
  if(pingTimestamps.length>1){
    pingTimestamps.sort(function(a,b){return a-b;});
    var totalGap=0;
    for(var pi=1;pi<pingTimestamps.length;pi++)totalGap+=pingTimestamps[pi]-pingTimestamps[pi-1];
    avgPingGapDays=Math.round(totalGap/(pingTimestamps.length-1)/86400000*10)/10;
  }
  var integrity={
    genesisPhoto:genesisHasPhoto,
    genesisPhotoSource:genesisPhotoSource,
    photoSources:{camera:photoCamera,file:photoFile},
    sensorCoverage:c.length>0?Math.round(sensorCount/c.length*100):0,
    distinctDevices:Object.keys(deviceSet).length,
    platforms:Object.keys(platformSet),
    distinctCounterparties:Object.keys(counterpartySet).length,
    distinctCounterpartyDevices:Object.keys(cpDeviceSet).length,
    avgPingGapDays:avgPingGapDays
  };
  return{n:ex.length,d:+cd(c).toFixed(1),g:gr.provided,r:gr.received,cats:catOut,catsTimeline:catsTimelineOut,words:wordsOut,time:timeOut,stab:stabOut,t0:c[0].timestamp,t1:c[c.length-1].timestamp,pings:pc,integrity:integrity};
}

// --- Confirmation / Settlement payloads ---
async function gcp(pj,c,proposal,privKey,deviceHash){const ex=c.filter(isAct);const o={h:PV,a:'cf',p:{c:pj.crv,k:pj.kty,x:pj.x,y:pj.y},f:await kfp(pj),d:cd(c),n:ex.length,o:proposal.fp,z:now()};if(deviceHash)o.dh=deviceHash;if(privKey)return await spld(o,privKey);return JSON.stringify(o)}
function pcp(j){const d=JSON.parse(j);if(d.a!=='cf'&&d.action!=='confirmation')throw new Error('Not a confirmation');const pub=d.p||d.pub;if(!pub||!pub.x)throw new Error('Missing key');const origFp=d.o||d.originalFp;if(!origFp)throw new Error('Missing original fingerprint');return{pub:{crv:pub.c||pub.crv,kty:pub.k||pub.kty,x:pub.x,y:pub.y},fp:d.f||d.fp,density:d.d!==undefined?d.d:(d.density||0),chainLen:d.n!==undefined?d.n:(d.chainLen||0),originalFp:origFp,ts:d.z||d.ts,sig:d.sig||null,deviceHash:d.dh||null}}
async function gsp(pj,confirmFp,privKey){const o={h:PV,a:'st',f:await kfp(pj),o:confirmFp,z:now()};if(privKey)return await spld(o,privKey);return JSON.stringify(o)}
async function cmh(iPub,cPub,ts){const s=iPub.x+':'+iPub.y+':'+cPub.x+':'+cPub.y+':'+ts;return bth(await crypto.subtle.digest(HALG,u8.encode(s)))}
async function chi(iPub,cPub,ts){return await cmh(iPub,cPub,ts)}
function psp(j){const d=JSON.parse(j);if(d.a!=='st')throw new Error('Not a settlement');if(!d.f||!d.o)throw new Error('Missing fingerprints');return{fp:d.f,confirmFp:d.o,ts:d.z}}

// --- ECDH relay encryption ---
// Derives a shared AES-256-GCM key from two P-256 key pairs via ECDH.
// Same curve as ECDSA signing keys. Re-imports with ECDH algorithm.
async function dsk(myPrivJwk,theirPubJwk){
  const priv=await crypto.subtle.importKey('jwk',
    {kty:myPrivJwk.kty,crv:myPrivJwk.crv,x:myPrivJwk.x,y:myPrivJwk.y,d:myPrivJwk.d},
    {name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
  const pub=await crypto.subtle.importKey('jwk',
    {kty:theirPubJwk.kty,crv:theirPubJwk.crv,x:theirPubJwk.x,y:theirPubJwk.y},
    {name:'ECDH',namedCurve:'P-256'},true,[]);
  const bits=await crypto.subtle.deriveBits({name:'ECDH',public:pub},priv,256);
  return await crypto.subtle.importKey('raw',bits,{name:AESN},false,['encrypt','decrypt']);
}
// Encrypts a payload object for relay transport. Returns base64 string (IV + ciphertext).
async function erp(obj,sharedKey){
  const iv=rb(IVL);
  const ct=await crypto.subtle.encrypt({name:AESN,iv},sharedKey,u8.encode(JSON.stringify(obj)));
  const combined=new Uint8Array(IVL+ct.byteLength);
  combined.set(iv);combined.set(new Uint8Array(ct),IVL);
  return btb(combined);
}
// Decrypts a relay payload. Input is the base64 string from erp().
async function drp(b64,sharedKey){
  const raw=new Uint8Array(btf(b64));
  const iv=raw.slice(0,IVL);
  const ct=raw.slice(IVL);
  const plain=await crypto.subtle.decrypt({name:AESN,iv},sharedKey,ct);
  return JSON.parse(u8d.decode(plain));
}

return{PROTOCOL_VERSION:PV,SER_VERSION:SV,SER_VERSION_V2:SV_V2,SER_VERSION_V3:SV_V3,SER_VERSION_V4:SV_V4,SER_VERSION_V5:SV_V5,SER_VERSION_LEGACY:SV_LEGACY,SCALE_MAX:SCALE_MAX,MAX_PHOTO_BYTES:MAX_PHOTO_BYTES,EXCHANGE_TYPES:ET,ENERGY_STATES:ES,EXCHANGE_PATHS:XP,RECORD_TYPE_PING:RT_PING,RECORD_TYPE_GENESIS:RT_GENESIS,isAct:isAct,COMMITMENT_TEXT:COMMITMENT_TEXT,generateKeyPair:gkp,exportKey:ek,importPublicKey:ipk,importPrivateKey:isk,importKeyPair:ikp,keyFingerprint:kfp,createRecord:cr,createGenesis:cg,createPingRecord:cpr,serialize:ser,hashRecord:hr,hashRecord3:hr3,signRecord:sr,verifyRecord:vr,createChain:cc,appendToChain:atc,verifyChain:vc,chainDensity:cd,walletBalance:wb,encryptWithPIN:ewp,decryptWithPIN:dwp,exportBackup:xb,importBackup:ib,generateHandshakePayload:ghp,parseHandshakePayload:php,recordFromHandshake:rfh,generateConfirmationPayload:gcp,parseConfirmationPayload:pcp,generateSettlementPayload:gsp,parseSettlementPayload:psp,signPayload:spld,verifyPayload:vpld,computeMintHash:cmh,computeHandshakeId:chi,generateAttestation:ga,attestationSummary:as,chainSnapshot:cs,chainMerkleRoot:cmr,chainEntropyPrev:cep,bufToHex:bth,bufToB64:btb,b64ToBuf:btf,deriveSharedKey:dsk,encryptRelayPayload:erp,decryptRelayPayload:drp}
})();

// ============================================================
// POH SIGNAL REGISTRY
// Self-contained signal definitions for Proof of Human display layer.
// Each signal declares its own capture, device expectation, interpretation,
// and copy. The aggregate rollup iterates the registry and produces a
// verdict object the UI consumes without knowing anything specific.
//
// This module intentionally knows nothing about the DOM. It takes raw
// state (chain, current exchange, device capabilities) and returns data.
// Display logic lives in hep-app.js.
// ============================================================
const POH=(()=>{'use strict';

// --- Device class detection ---
// Returns one of: 'ios', 'android', 'pc', 'unknown'
// Used to resolve expectation for each signal.
function deviceClass() {
  try {
    var ua = (navigator.userAgent || '').toLowerCase();
    var touch = navigator.maxTouchPoints || 0;
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    // Treat zero-touch desktops and laptops as PC
    if (touch === 0 && /windows|mac|linux|cros/.test(ua)) return 'pc';
    // Touchscreen laptops still count as PC unless mobile keywords present
    if (/windows|mac|linux|cros/.test(ua)) return 'pc';
    return 'unknown';
  } catch(e) { return 'unknown'; }
}

// --- Weight tiers ---
// critical    = signal materially affects verdict (clock drift, sensor hash)
// supporting  = signal strengthens verdict if present but absence is tolerable
// enrichment  = signal adds texture, minor positive contribution
const WEIGHT = { CRITICAL: 3, SUPPORTING: 2, ENRICHMENT: 1 };

// --- Data source origins ---
// Every data source has an origin — where the data comes from.
// This replaces the signal-vs-sensor taxonomy with a single primitive: data.
//   device   — from the device's own hardware (barometer, GPS, battery)
//   external — from elsewhere (witness server, counterparty-shared data)
//   chain    — observed patterns in the chain over time
const ORIGIN = { DEVICE: 'device', EXTERNAL: 'external', CHAIN: 'chain' };

// --- Status codes for interpret() return ---
// presence:  'present' | 'absent'
// expected:  true | false              (given current device + user choice)
// behavior:  'normal' | 'worth-noting' | 'alarming' | 'n/a'
// contribution: number (positive = strengthens chain, negative = weakens)

// --- Data source registry ---
// Each entry is self-contained. Entries describe a data source — a place
// the chain draws information from. The UI treats all entries uniformly.
// To add a new source: add an entry. To retire: remove. No other changes.
const SIGNALS = {

  clockSkew: {
    id: 'clockSkew',
    humanName: 'Clock agreement',
    tier: WEIGHT.CRITICAL,
    origin: ORIGIN.CHAIN,
    expectedOn: ['ios', 'android', 'pc'], // universal
    // Reads clockSkew from every exchange record in the chain.
    // Each record stores (this device's time) minus (counterparty's time)
    // at the moment they exchanged. Aggregate shape over many exchanges
    // with many counterparties is the real signal.
    capture: function(ctx) {
      if (!ctx || !ctx.chain) return null;
      var samples = [];
      for (var i = 0; i < ctx.chain.length; i++) {
        var r = ctx.chain[i];
        if (r.type === 'ping' || r.type === 'genesis') continue;
        if (typeof r.clockSkew === 'number') samples.push(r.clockSkew);
      }
      if (samples.length === 0) return null;
      var sum = 0, sumAbs = 0, maxAbs = 0;
      for (var j = 0; j < samples.length; j++) {
        sum += samples[j];
        var abs = Math.abs(samples[j]);
        sumAbs += abs;
        if (abs > maxAbs) maxAbs = abs;
      }
      return {
        count: samples.length,
        meanMs: Math.round(sum / samples.length),
        meanAbsMs: Math.round(sumAbs / samples.length),
        maxAbsMs: maxAbs
      };
    },
    interpret: function(raw, deviceClassStr) {
      if (!raw || raw.count === 0) {
        return {
          presence: 'absent',
          expected: true,
          behavior: 'n/a',
          contribution: 0,
          summary: 'No exchanges yet — clock agreement cannot be measured'
        };
      }
      // Thresholds on mean absolute skew:
      //   < 3s  = normal (human clocks drift this much)
      //   < 30s = worth-noting (unusually large drift)
      //   > 30s = alarming (clock manipulation or severe misconfiguration)
      if (raw.meanAbsMs < 3000) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.CRITICAL,
          summary: 'Your clock agrees with counterparties across ' + raw.count + ' exchange' + (raw.count === 1 ? '' : 's')
        };
      } else if (raw.meanAbsMs < 30000) {
        return {
          presence: 'present', expected: true, behavior: 'worth-noting',
          contribution: Math.floor(WEIGHT.CRITICAL / 2),
          summary: 'Clock drifts somewhat from counterparties across ' + raw.count + ' exchange' + (raw.count === 1 ? '' : 's')
        };
      } else {
        return {
          presence: 'present', expected: true, behavior: 'alarming',
          contribution: -WEIGHT.CRITICAL,
          summary: 'Clock is far off from counterparties — possible time fabrication'
        };
      }
    },
    copy: {
      whatItMeans: 'Every device has a clock. When you record an exchange, your phone stamps the moment. So does theirs. A real device used by a real person has a clock that agrees with the people they meet — within seconds. Small drift is normal, two real clocks rarely match exactly. But if many people you exchange with show wildly different times, something is wrong.',
      whyItMatters: 'Time is cheap to fabricate alone, hard to fabricate across a network. A chain of exchanges where your clock consistently agrees with many counterparties is anchored in real time shared with real people. Fabrication attempts produce impossible drift patterns — too perfect, too random, or systematically shifted.'
    },
    visualize: function(raw, chainHistory) {
      if (!raw) return null;
      return {
        type: 'range',
        value: raw.meanAbsMs,
        unit: 'ms mean drift',
        normalRange: [0, 3000],
        observedRange: [0, Math.max(10000, raw.maxAbsMs)]
      };
    }
  },

  witnessRTT: {
    id: 'witnessRTT',
    humanName: 'Witness server response',
    tier: WEIGHT.SUPPORTING,
    origin: ORIGIN.EXTERNAL,
    expectedOn: ['ios', 'android', 'pc'],
    // Reads rtt_ms from witnessAttestation on records that were attested.
    // Witness attestation is optional — offline-first design means absence
    // is a sovereignty choice, not a failure.
    capture: function(ctx) {
      if (!ctx || !ctx.chain) return null;
      var samples = [];
      for (var i = 0; i < ctx.chain.length; i++) {
        var r = ctx.chain[i];
        if (r.witnessAttestation && typeof r.witnessAttestation.rtt_ms === 'number') {
          samples.push(r.witnessAttestation.rtt_ms);
        }
      }
      if (samples.length === 0) return null;
      var sum = 0, max = 0, min = Infinity;
      for (var j = 0; j < samples.length; j++) {
        sum += samples[j];
        if (samples[j] > max) max = samples[j];
        if (samples[j] < min) min = samples[j];
      }
      return {
        count: samples.length,
        meanMs: Math.round(sum / samples.length),
        minMs: min,
        maxMs: max
      };
    },
    interpret: function(raw, deviceClassStr) {
      if (!raw || raw.count === 0) {
        return {
          presence: 'absent',
          expected: true,
          behavior: 'n/a',
          contribution: 0,
          summary: 'No witness-attested records yet — this is optional'
        };
      }
      // Thresholds: <1500ms normal (reasonable network), <5000ms worth-noting (slow), >5000ms unusual
      if (raw.meanMs < 1500) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.SUPPORTING,
          summary: raw.count + ' witness attestation' + (raw.count === 1 ? '' : 's') + ' with healthy response times'
        };
      } else if (raw.meanMs < 5000) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: Math.floor(WEIGHT.SUPPORTING / 2),
          summary: 'Witness server responds, network is slow from your device'
        };
      } else {
        return {
          presence: 'present', expected: true, behavior: 'worth-noting',
          contribution: 0,
          summary: 'Witness response times are unusually long'
        };
      }
    },
    copy: {
      whatItMeans: 'When you send a record to the witness server, it responds with a signed attestation. The time that takes — from your phone to the server and back — is the round-trip time. A real network over real infrastructure has a predictable range. Very fast or perfectly uniform times can suggest a local loopback rather than a real distant server.',
      whyItMatters: 'The witness is optional in HEP — you can exchange entirely offline and never contact a server. But when you do, the network timing becomes another strand of evidence. A chain with attested records whose response times look realistic has been anchored to real internet infrastructure. A chain where every attestation took exactly the same 1ms suggests a controlled environment.'
    },
    visualize: function(raw) {
      if (!raw) return null;
      return { type: 'range', value: raw.meanMs, unit: 'ms', normalRange: [0, 1500], observedRange: [0, Math.max(3000, raw.maxMs)] };
    }
  },

  sensorHashMatch: {
    id: 'sensorHashMatch',
    humanName: 'Device consistency',
    tier: WEIGHT.CRITICAL,
    origin: ORIGIN.CHAIN,
    expectedOn: ['ios', 'android', 'pc'],
    // Reads sensorHash from every record and counts distinct values.
    // A chain from one device produces a small number of distinct hashes
    // over time as the device's sensor readings shift slightly. A chain
    // with every record showing a unique hash suggests fabrication across
    // many different devices or sessions.
    capture: function(ctx) {
      if (!ctx || !ctx.chain) return null;
      var hashes = {};
      var total = 0;
      var firstSeen = {};
      for (var i = 0; i < ctx.chain.length; i++) {
        var r = ctx.chain[i];
        if (typeof r.sensorHash === 'string' && r.sensorHash.length > 0) {
          total++;
          if (!hashes[r.sensorHash]) {
            hashes[r.sensorHash] = 1;
            firstSeen[r.sensorHash] = i;
          } else {
            hashes[r.sensorHash]++;
          }
        }
      }
      if (total === 0) return null;
      var distinct = Object.keys(hashes).length;
      // Find most common hash (the "primary" device fingerprint)
      var primaryCount = 0;
      for (var h in hashes) if (hashes[h] > primaryCount) primaryCount = hashes[h];
      return {
        total: total,
        distinct: distinct,
        primaryCount: primaryCount,
        primaryRatio: primaryCount / total
      };
    },
    interpret: function(raw, deviceClassStr) {
      if (!raw || raw.total === 0) {
        return {
          presence: 'absent',
          expected: true,
          behavior: 'n/a',
          contribution: 0,
          summary: 'No sensor fingerprints captured yet'
        };
      }
      // If one hash covers >80% of records, strong consistent device signal.
      // Many distinct hashes with no dominant one suggests device-hopping.
      if (raw.primaryRatio >= 0.8) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.CRITICAL,
          summary: 'Consistent device fingerprint across ' + raw.total + ' record' + (raw.total === 1 ? '' : 's')
        };
      } else if (raw.primaryRatio >= 0.5) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: Math.floor(WEIGHT.CRITICAL / 2),
          summary: 'Primary device recognizable but with some variation'
        };
      } else {
        return {
          presence: 'present', expected: true, behavior: 'worth-noting',
          contribution: 0,
          summary: 'Many distinct device fingerprints across this chain — unusual for one person'
        };
      }
    },
    copy: {
      whatItMeans: 'Every time you record an exchange, your phone captures a snapshot of its hardware and software characteristics — screen size, graphics renderer, installed fonts, available sensors — and hashes them together. That hash is a fingerprint of the device. A real person using one phone produces nearly the same hash for every exchange. Small shifts are normal over time as the device updates. Many wildly different hashes on one chain suggest the records came from many different devices.',
      whyItMatters: 'A single human body holds one phone most of the time. That physical constraint should show up as a consistent device fingerprint across a real chain. A chain made by one person pretending to be many will show a different fingerprint for each pretend identity — the same attacker cannot simultaneously simulate different device profiles across hundreds of exchanges without the inconsistency being visible. The chain reveals.'
    },
    visualize: function(raw) {
      if (!raw) return null;
      return { type: 'range', value: Math.round(raw.primaryRatio * 100), unit: '% primary device', normalRange: [80, 100], observedRange: [0, 100] };
    }
  },

  counterpartyGeo: {
    id: 'counterpartyGeo',
    humanName: 'Counterparty locations',
    tier: WEIGHT.SUPPORTING,
    origin: ORIGIN.EXTERNAL,
    expectedOn: ['ios', 'android', 'pc'], // measures others' devices, not yours
    // Counts exchanges where the counterparty shared a location.
    // This is about the counterparty's contribution to the exchange,
    // not your own location.
    capture: function(ctx) {
      if (!ctx || !ctx.chain) return null;
      var withGeo = 0, totalExchanges = 0;
      for (var i = 0; i < ctx.chain.length; i++) {
        var r = ctx.chain[i];
        if (r.type === 'ping' || r.type === 'genesis') continue;
        totalExchanges++;
        if (r.counterpartyGeo) withGeo++;
      }
      if (totalExchanges === 0) return null;
      return {
        total: totalExchanges,
        withGeo: withGeo,
        ratio: withGeo / totalExchanges
      };
    },
    interpret: function(raw, deviceClassStr) {
      if (!raw || raw.total === 0) {
        return {
          presence: 'absent',
          expected: true,
          behavior: 'n/a',
          contribution: 0,
          summary: 'No exchanges yet'
        };
      }
      if (raw.withGeo === 0) {
        return {
          presence: 'absent',
          expected: true,
          behavior: 'n/a',
          contribution: 0,
          summary: 'None of your counterparties shared their location'
        };
      }
      if (raw.ratio >= 0.5) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.SUPPORTING,
          summary: raw.withGeo + ' of ' + raw.total + ' counterparties shared location — anchored in real places'
        };
      } else {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: Math.floor(WEIGHT.SUPPORTING / 2),
          summary: 'Some counterparties shared location'
        };
      }
    },
    copy: {
      whatItMeans: 'When you exchange with another person, their phone may share its approximate location along with the record. This is separate from your own location. If half the people you meet have shared where they were, your chain is populated with real places and real people who were willing to anchor their presence.',
      whyItMatters: 'Your chain is a story about cooperation between real people at real times in real places. When counterparties share their location, that story becomes verifiable from multiple sides. A fabricator controlling both ends of exchanges has to simulate realistic counterparty locations distinct from their own, which is much harder than faking just one location.'
    },
    visualize: function(raw) {
      if (!raw) return null;
      return { type: 'range', value: Math.round(raw.ratio * 100), unit: '% with location', normalRange: [50, 100], observedRange: [0, 100] };
    }
  },

  connectivity: {
    id: 'connectivity',
    humanName: 'Online/offline mix',
    tier: WEIGHT.ENRICHMENT,
    origin: ORIGIN.CHAIN,
    expectedOn: ['ios', 'android', 'pc'],
    // Counts how many exchanges happened while online vs offline.
    // Real phones go through both states. All-online or all-offline
    // both tell a story, but mix is most natural.
    capture: function(ctx) {
      if (!ctx || !ctx.chain) return null;
      var online = 0, offline = 0, total = 0;
      for (var i = 0; i < ctx.chain.length; i++) {
        var r = ctx.chain[i];
        if (r.type === 'genesis') continue;
        if (typeof r.connectivityAvailable !== 'boolean') continue;
        total++;
        if (r.connectivityAvailable) online++;
        else offline++;
      }
      if (total === 0) return null;
      return {
        total: total,
        online: online,
        offline: offline,
        onlineRatio: online / total
      };
    },
    interpret: function(raw, deviceClassStr) {
      if (!raw || raw.total === 0) {
        return {
          presence: 'absent',
          expected: true,
          behavior: 'n/a',
          contribution: 0,
          summary: 'No records with connectivity data yet'
        };
      }
      if (raw.online > 0 && raw.offline > 0) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.ENRICHMENT,
          summary: 'Mix of online and offline exchanges — natural phone usage'
        };
      } else if (raw.online > 0) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.ENRICHMENT,
          summary: 'All exchanges happened while online'
        };
      } else {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.ENRICHMENT,
          summary: 'All exchanges happened while offline — offline-first usage'
        };
      }
    },
    copy: {
      whatItMeans: 'Your phone records whether it had a network connection at the moment of each exchange. A phone used through a normal day passes through both states — connected at home, offline in a basement, connected on the train. A chain made by a simulator running in a data center will typically show one constant state.',
      whyItMatters: 'Offline-first usage is not weaker than online usage in HEP. Both are real and intentional. What matters is that the pattern reflects a phone moving through real conditions. An all-one-state chain is a minor signal on its own, but combined with other constants it can point to an artificial environment.'
    },
    visualize: function(raw) {
      if (!raw) return null;
      return { type: 'breakdown', parts: [
        { label: 'Online', value: raw.online, color: 'green' },
        { label: 'Offline', value: raw.offline, color: 'amber' }
      ], total: raw.total };
    }
  },

  exchangePath: {
    id: 'exchangePath',
    humanName: 'Exchange method mix',
    tier: WEIGHT.SUPPORTING,
    origin: ORIGIN.CHAIN,
    expectedOn: ['ios', 'android', 'pc'],
    // Reads exchangePath from every exchange record and counts the mix.
    // Values: 'session' (live co-present), 'qr' (scan code, usually in-person),
    // 'offline' (deferred/indirect).
    capture: function(ctx) {
      if (!ctx || !ctx.chain) return null;
      var counts = { session: 0, qr: 0, offline: 0, unknown: 0 };
      var total = 0;
      for (var i = 0; i < ctx.chain.length; i++) {
        var r = ctx.chain[i];
        if (r.type === 'ping' || r.type === 'genesis') continue;
        total++;
        var p = r.exchangePath;
        if (p === 'session') counts.session++;
        else if (p === 'qr') counts.qr++;
        else if (p === 'offline') counts.offline++;
        else counts.unknown++;
      }
      if (total === 0) return null;
      return {
        total: total,
        session: counts.session,
        qr: counts.qr,
        offline: counts.offline,
        unknown: counts.unknown,
        coPresentCount: counts.session + counts.qr, // both methods require real co-presence
        coPresentRatio: (counts.session + counts.qr) / total
      };
    },
    interpret: function(raw, deviceClassStr) {
      if (!raw || raw.total === 0) {
        return {
          presence: 'absent',
          expected: true,
          behavior: 'n/a',
          contribution: 0,
          summary: 'No exchanges yet to measure method mix'
        };
      }
      // Co-present exchanges (session + qr) are strongest signal of real meeting.
      // A healthy chain has some co-present exchanges. All-offline is worth noting.
      if (raw.coPresentRatio >= 0.5) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.SUPPORTING,
          summary: 'Most exchanges happened in-person or in live sessions'
        };
      } else if (raw.coPresentCount > 0) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: Math.floor(WEIGHT.SUPPORTING / 2),
          summary: 'Some exchanges in-person, some deferred through the network'
        };
      } else {
        return {
          presence: 'present', expected: true, behavior: 'worth-noting',
          contribution: 0,
          summary: 'All exchanges happened offline or through deferred relay'
        };
      }
    },
    copy: {
      whatItMeans: 'Exchanges can happen three ways. Two people can meet live on a session (both phones connected at once). They can scan each other\'s QR codes in-person. Or one can leave a record for the other to pick up later through the network, without ever meeting. The first two require co-presence in time, and usually in place. The third does not.',
      whyItMatters: 'Co-present exchanges are the strongest proof of cooperation because two real people had to be together. A chain made entirely of deferred exchanges is possible to fabricate with one person operating two accounts. A mix of methods is normal — some of your cooperation happens in person, some does not. A chain with zero co-present exchanges is worth looking at.'
    },
    visualize: function(raw, chainHistory) {
      if (!raw) return null;
      return {
        type: 'breakdown',
        parts: [
          { label: 'Live session', value: raw.session, color: 'green' },
          { label: 'In-person QR', value: raw.qr, color: 'green' },
          { label: 'Deferred', value: raw.offline, color: 'amber' }
        ],
        total: raw.total
      };
    }
  },

  batteryDetails: {
    id: 'batteryDetails',
    humanName: 'Battery variation pattern',
    tier: WEIGHT.ENRICHMENT,
    origin: ORIGIN.CHAIN,
    expectedOn: ['ios', 'android'], // Battery Status API limited/absent on PC
    // Reads batteryState from pohSnapshot on records that captured it.
    // Real devices show realistic battery variation over time —
    // levels drift down during use, jump up on charging, etc.
    capture: function(ctx) {
      if (!ctx || !ctx.chain) return null;
      var levels = [];
      var chargingSeen = false, notChargingSeen = false;
      for (var i = 0; i < ctx.chain.length; i++) {
        var r = ctx.chain[i];
        var b = null;
        if (r.pohSnapshot && r.pohSnapshot.batteryState) b = r.pohSnapshot.batteryState;
        else if (r.batteryState) b = r.batteryState;
        if (!b) continue;
        if (typeof b.level === 'number') levels.push(b.level);
        if (b.charging === true) chargingSeen = true;
        if (b.charging === false) notChargingSeen = true;
      }
      if (levels.length === 0 && !chargingSeen && !notChargingSeen) return null;
      var min = levels.length ? Math.min.apply(null, levels) : null;
      var max = levels.length ? Math.max.apply(null, levels) : null;
      return {
        samples: levels.length,
        minLevel: min,
        maxLevel: max,
        rangeLevel: (min !== null && max !== null) ? max - min : null,
        chargingSeen: chargingSeen,
        notChargingSeen: notChargingSeen
      };
    },
    interpret: function(raw, deviceClassStr) {
      if (!raw) {
        return {
          presence: 'absent',
          expected: (deviceClassStr !== 'pc'),
          behavior: 'n/a',
          contribution: 0,
          summary: deviceClassStr === 'pc' ? 'Desktop devices rarely expose battery data' : 'No battery data captured yet'
        };
      }
      // Expect battery level variation over many samples. A range > 0.1 (10%)
      // shows realistic use. Both charging and not-charging states are positive.
      var stateVariety = (raw.chargingSeen && raw.notChargingSeen);
      if (raw.samples >= 3 && (raw.rangeLevel === null || raw.rangeLevel > 0.1) && stateVariety) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.ENRICHMENT,
          summary: 'Battery varies across charging states — natural phone usage'
        };
      } else if (raw.samples >= 1) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: Math.floor(WEIGHT.ENRICHMENT / 2),
          summary: 'Battery data present but limited variation so far'
        };
      }
      return {
        presence: 'absent',
        expected: true,
        behavior: 'n/a',
        contribution: 0,
        summary: 'Battery data not available'
      };
    },
    copy: {
      whatItMeans: 'Your phone knows whether it is plugged in and how much charge it has left. When you record an exchange, the app captures that state. Over many exchanges, a real phone shows the rhythm of daily use — draining during the day, charging overnight, sometimes plugged in, sometimes not.',
      whyItMatters: 'A simulator running on a server has no real battery — it reports a constant value, or the same pattern on every exchange. A phone belonging to a real person shows irregular drops, occasional charging spikes, and natural randomness. The battery signature is one of the simplest signals to fabricate in a single moment but one of the hardest to fabricate plausibly over hundreds of exchanges.'
    },
    visualize: function(raw) {
      if (!raw || raw.samples === 0) return null;
      var pct = raw.rangeLevel !== null ? Math.round(raw.rangeLevel * 100) : 0;
      return { type: 'range', value: pct, unit: '% range', normalRange: [10, 100], observedRange: [0, 100] };
    }
  },

  merkleRoot: {
    id: 'merkleRoot',
    humanName: 'Chain integrity',
    tier: WEIGHT.CRITICAL,
    origin: ORIGIN.CHAIN,
    expectedOn: ['ios', 'android', 'pc'],
    // Counts records carrying a chainMerkleRoot field. Merkle roots on
    // each record commit to the entire chain state at that point.
    // A record with a merkle root cannot be silently re-ordered or altered.
    //
    // Legacy handling: chainMerkleRoot was introduced at SV_V3 (version 3).
    // Records at SV_LEGACY (1) or SV_V2 (2) never carried this field —
    // they are excluded from the denominator to avoid penalizing chains
    // that began before the field existed. For users starting today
    // (all records at current SV), the ratio naturally reaches 100%.
    capture: function(ctx) {
      if (!ctx || !ctx.chain) return null;
      var total = 0, withRoot = 0, legacySkipped = 0;
      for (var i = 0; i < ctx.chain.length; i++) {
        var r = ctx.chain[i];
        if (r.type === 'genesis') continue;
        // Skip records whose serialization predates this field
        var sv = r.serVersion || 1;
        if (sv < 3) { legacySkipped++; continue; }
        total++;
        if (typeof r.chainMerkleRoot === 'string' && r.chainMerkleRoot.length > 0) withRoot++;
      }
      if (total === 0 && legacySkipped === 0) return null;
      return {
        total: total,
        withRoot: withRoot,
        legacySkipped: legacySkipped,
        ratio: total > 0 ? withRoot / total : 1
      };
    },
    interpret: function(raw, deviceClassStr) {
      if (!raw || (raw.total === 0 && raw.legacySkipped === 0)) {
        return {
          presence: 'absent',
          expected: true,
          behavior: 'n/a',
          contribution: 0,
          summary: 'No non-genesis records yet to anchor'
        };
      }
      if (raw.total === 0 && raw.legacySkipped > 0) {
        return {
          presence: 'present',
          expected: true,
          behavior: 'normal',
          contribution: 0,
          summary: 'All records predate this feature — no action needed'
        };
      }
      if (raw.ratio >= 0.99) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.CRITICAL,
          summary: 'Every eligible record anchored by a Merkle root — chain integrity intact'
        };
      } else if (raw.ratio >= 0.9) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: Math.floor(WEIGHT.CRITICAL / 2),
          summary: 'Most eligible records anchored by Merkle root'
        };
      } else {
        return {
          presence: 'present', expected: true, behavior: 'worth-noting',
          contribution: 0,
          summary: Math.round((1 - raw.ratio) * 100) + '% of eligible records missing their Merkle root'
        };
      }
    },
    copy: {
      whatItMeans: 'Every record on your chain carries a small hash that summarizes the entire chain up to that point — called a Merkle root. If any earlier record were quietly changed or reordered, every later record\'s Merkle root would no longer match. The chain defends itself by folding its own history into every new record.',
      whyItMatters: 'Without Merkle roots, a chain is just a list that could be edited silently. With them, the chain becomes tamper-evident — any change anywhere shows up everywhere after that point. This is the same mechanism that anchors Bitcoin and most other chain-based systems. It is what turns "a list of records" into "a history that cannot be quietly rewritten."'
    },
    visualize: function(raw) {
      if (!raw) return null;
      return { type: 'range', value: Math.round(raw.ratio * 100), unit: '% anchored', normalRange: [99, 100], observedRange: [0, 100] };
    }
  },

  entropyChain: {
    id: 'entropyChain',
    humanName: 'Entropy continuity',
    tier: WEIGHT.SUPPORTING,
    origin: ORIGIN.CHAIN,
    expectedOn: ['ios', 'android', 'pc'],
    // Counts records carrying an entropyPrev field, which links each
    // record to unpredictable randomness from the previous one.
    //
    // Legacy handling: entropyPrev was introduced at SV_V2 (version 2).
    // Records at SV_LEGACY (1) predate the field and are excluded from
    // the denominator.
    capture: function(ctx) {
      if (!ctx || !ctx.chain) return null;
      var total = 0, withEntropy = 0, legacySkipped = 0;
      for (var i = 0; i < ctx.chain.length; i++) {
        var r = ctx.chain[i];
        if (r.type === 'genesis') continue;
        var sv = r.serVersion || 1;
        if (sv < 2) { legacySkipped++; continue; }
        total++;
        if (typeof r.entropyPrev === 'string' && r.entropyPrev.length > 0) withEntropy++;
      }
      if (total === 0 && legacySkipped === 0) return null;
      return {
        total: total,
        withEntropy: withEntropy,
        legacySkipped: legacySkipped,
        ratio: total > 0 ? withEntropy / total : 1
      };
    },
    interpret: function(raw, deviceClassStr) {
      if (!raw || (raw.total === 0 && raw.legacySkipped === 0)) {
        return {
          presence: 'absent',
          expected: true,
          behavior: 'n/a',
          contribution: 0,
          summary: 'No non-genesis records yet'
        };
      }
      if (raw.total === 0 && raw.legacySkipped > 0) {
        return {
          presence: 'present',
          expected: true,
          behavior: 'normal',
          contribution: 0,
          summary: 'All records predate this feature — no action needed'
        };
      }
      if (raw.ratio >= 0.99) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: WEIGHT.SUPPORTING,
          summary: 'Entropy chain unbroken across ' + raw.total + ' eligible record' + (raw.total === 1 ? '' : 's')
        };
      } else if (raw.ratio >= 0.9) {
        return {
          presence: 'present', expected: true, behavior: 'normal',
          contribution: Math.floor(WEIGHT.SUPPORTING / 2),
          summary: 'Entropy chain present on most eligible records'
        };
      } else {
        return {
          presence: 'present', expected: true, behavior: 'worth-noting',
          contribution: 0,
          summary: 'Entropy chain broken on ' + Math.round((1 - raw.ratio) * 100) + '% of eligible records'
        };
      }
    },
    copy: {
      whatItMeans: 'Each record carries a small piece of random data pulled from the previous record. This forms an unbroken chain of entropy — one record feeds the next. Because the randomness cannot be predicted in advance, nobody can pre-compute records to insert later. Each new record has to be built with the real previous record in hand.',
      whyItMatters: 'Entropy continuity is a defense against pre-fabrication. An attacker cannot create a chain of realistic-looking records in advance because they cannot know what entropy the next record will need until the previous one exists. This turns chain-building into a sequential process bounded by real time.'
    },
    visualize: function(raw) {
      if (!raw) return null;
      return { type: 'range', value: Math.round(raw.ratio * 100), unit: '% linked', normalRange: [99, 100], observedRange: [0, 100] };
    }
  },

  // ==================================================================
  // DEVICE-ORIGIN DATA SOURCES
  // Each entry describes one piece of hardware on the device.
  // The capture function reads ctx.deviceCapabilities (passed from the app)
  // plus the chain to determine availability, enabled state, and
  // how many records this source has contributed to.
  // ==================================================================

  locationSensor: {
    id: 'locationSensor',
    humanName: 'Location',
    tier: WEIGHT.SUPPORTING,
    origin: ORIGIN.DEVICE,
    expectedOn: ['ios', 'android', 'pc'], // browser geolocation works everywhere, accuracy varies
    capture: function(ctx) {
      if (!ctx) return null;
      var cap = ctx.deviceCapabilities || {};
      var hardwareAvailable = cap.hasGeolocation !== false; // default true unless explicitly false
      var enabled = !!cap.locationEnabled;
      // Count records carrying geo
      var contributed = 0, total = 0;
      if (ctx.chain) {
        for (var i = 0; i < ctx.chain.length; i++) {
          var r = ctx.chain[i];
          if (r.type === 'genesis') continue;
          total++;
          if (r.geo) contributed++;
        }
      }
      return {
        hardwareAvailable: hardwareAvailable,
        enabled: enabled,
        liveReading: cap.liveGeo || null,
        contributed: contributed,
        total: total
      };
    },
    interpret: function(raw, dClass) {
      if (!raw) return { presence: 'absent', expected: true, behavior: 'n/a', contribution: 0, summary: 'Unknown' };
      if (!raw.hardwareAvailable) {
        return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Location is not available on this device' };
      }
      if (!raw.enabled) {
        return { presence: 'absent', expected: true, behavior: 'worth-noting', contribution: 0, summary: 'Available but not enabled — turn on to strengthen chain' };
      }
      if (raw.total === 0) {
        return { presence: 'present', expected: true, behavior: 'normal', contribution: WEIGHT.ENRICHMENT, summary: 'Enabled — will contribute to your first exchange' };
      }
      if (raw.contributed > 0) {
        return { presence: 'present', expected: true, behavior: 'normal', contribution: WEIGHT.SUPPORTING, summary: 'Location attached to ' + raw.contributed + ' of ' + raw.total + ' records' };
      }
      return { presence: 'present', expected: true, behavior: 'normal', contribution: Math.floor(WEIGHT.SUPPORTING / 2), summary: 'Enabled but not yet captured on any records' };
    },
    copy: {
      whatItMeans: 'Your phone can figure out roughly where it is, using GPS, wifi, and cellular signals. When you enable location, a coarse approximation gets attached to each exchange you record. This becomes part of the permanent evidence that your chain happened in real places.',
      whyItMatters: 'A chain made by someone moving through real cities, towns, and neighborhoods leaves a geographic pattern that is hard to fabricate. An attacker simulating many accounts from one basement cannot produce a convincing spread of locations across time. Location data is not required to cooperate, but chains that carry it are stronger evidence of real movement through a real world.'
    },
    visualize: function(raw) { return null; }
  },

  motionSensor: {
    id: 'motionSensor',
    humanName: 'Motion sensors',
    tier: WEIGHT.SUPPORTING,
    origin: ORIGIN.DEVICE,
    expectedOn: ['ios', 'android'], // desktops rarely have accelerometer/gyroscope
    capture: function(ctx) {
      if (!ctx) return null;
      var cap = ctx.deviceCapabilities || {};
      return {
        hardwareAvailable: !!cap.hasMotion,
        enabled: !!cap.motionEnabled,
        accelLive: cap.liveAccel || null,
        gyroLive: cap.liveGyro || null
      };
    },
    interpret: function(raw, dClass) {
      if (!raw) return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Unknown' };
      if (!raw.hardwareAvailable) {
        return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Motion sensors are not available on this device' };
      }
      if (!raw.enabled) {
        return { presence: 'absent', expected: true, behavior: 'worth-noting', contribution: 0, summary: 'Available but not enabled — turn on to prove a real hand holds your phone' };
      }
      var hasLiveAccel = !!raw.accelLive;
      var hasLiveGyro = !!raw.gyroLive;
      if (hasLiveAccel || hasLiveGyro) {
        return { presence: 'present', expected: true, behavior: 'normal', contribution: WEIGHT.SUPPORTING, summary: 'Active — accelerometer' + (hasLiveAccel ? ' ✓' : ' –') + ' / gyroscope' + (hasLiveGyro ? ' ✓' : ' –') };
      }
      return { presence: 'present', expected: true, behavior: 'normal', contribution: Math.floor(WEIGHT.SUPPORTING / 2), summary: 'Enabled — waiting for motion readings' };
    },
    copy: {
      whatItMeans: 'A phone held by a person is never perfectly still. The accelerometer senses tilt and movement. The gyroscope senses rotation. These constant tiny readings get folded into your device fingerprint. A phone sitting on a desk produces one kind of pattern. A phone in a pocket produces another. A simulator running in a data center produces neither.',
      whyItMatters: 'Motion is one of the cheapest ways for a real phone to prove itself, and one of the hardest to fabricate. A simulator can declare any motion values, but it cannot match the micro-chaos of a real hand over thousands of readings. The pattern of a phone\'s movement is as individual as a fingerprint.'
    },
    visualize: function(raw) { return null; }
  },

  batterySensor: {
    id: 'batterySensor',
    humanName: 'Battery',
    tier: WEIGHT.ENRICHMENT,
    origin: ORIGIN.DEVICE,
    expectedOn: ['ios', 'android'], // Battery Status API sparse on PC
    capture: function(ctx) {
      if (!ctx) return null;
      var cap = ctx.deviceCapabilities || {};
      return {
        hardwareAvailable: !!cap.hasBattery,
        liveReading: cap.liveBattery || null
      };
    },
    interpret: function(raw, dClass) {
      if (!raw) return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Unknown' };
      if (!raw.hardwareAvailable) {
        return { presence: 'absent', expected: (dClass !== 'pc'), behavior: 'n/a', contribution: 0, summary: dClass === 'pc' ? 'Desktop devices rarely expose battery data' : 'Battery data not available' };
      }
      if (raw.liveReading) {
        var pct = Math.round((raw.liveReading.level || 0) * 100);
        var state = raw.liveReading.charging ? 'charging' : 'not charging';
        return { presence: 'present', expected: true, behavior: 'normal', contribution: WEIGHT.ENRICHMENT, summary: 'Level ' + pct + '%, ' + state };
      }
      return { presence: 'present', expected: true, behavior: 'normal', contribution: 0, summary: 'Available, no live reading yet' };
    },
    copy: {
      whatItMeans: 'Your phone reports its current battery level and whether it is plugged in. Each time you record an exchange, this snapshot joins the record. Over time the chain carries a story of daily charge and discharge cycles.',
      whyItMatters: 'Battery is the simplest kind of hardware signal, and one of the first a fabricator will forget to vary. A real phone shows a charge arc during the day. A simulator reports the same value on every exchange. One sample is weak evidence. A hundred samples that reflect a real person\'s charging rhythm is strong evidence.'
    },
    visualize: function(raw) { return null; }
  },

  networkSensor: {
    id: 'networkSensor',
    humanName: 'Network type',
    tier: WEIGHT.ENRICHMENT,
    origin: ORIGIN.DEVICE,
    expectedOn: ['ios', 'android', 'pc'],
    capture: function(ctx) {
      if (!ctx) return null;
      var cap = ctx.deviceCapabilities || {};
      return {
        hardwareAvailable: !!cap.hasNetworkInfo,
        liveReading: cap.liveNetwork || null
      };
    },
    interpret: function(raw, dClass) {
      if (!raw) return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Unknown' };
      if (!raw.hardwareAvailable) {
        return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Network type info not exposed by this browser' };
      }
      if (raw.liveReading) {
        // NetworkInformation.effectiveType reports the *speed tier*
        // ('slow-2g' | '2g' | '3g' | '4g'), not the physical medium.
        // A wired desktop on gigabit ethernet gets reported as '4g'
        // because that's the top tier in the API's schema. Wording
        // clarifies this is a speed read, not a device-type claim.
        var t = raw.liveReading.effectiveType || raw.liveReading.type || 'unknown';
        var summary;
        if (t === '4g') summary = 'Fast connection (4g speed tier)';
        else if (t === '3g') summary = 'Moderate connection (3g speed tier)';
        else if (t === '2g') summary = 'Slow connection (2g speed tier)';
        else if (t === 'slow-2g') summary = 'Very slow connection';
        else summary = 'Connected (' + t + ')';
        return { presence: 'present', expected: true, behavior: 'normal', contribution: WEIGHT.ENRICHMENT, summary: summary };
      }
      return { presence: 'present', expected: true, behavior: 'normal', contribution: 0, summary: 'Available, no live reading yet' };
    },
    copy: {
      whatItMeans: 'Your phone knows what kind of connection it has — 4G, 5G, wifi, or offline. This changes throughout a real day: cell signal on the street, wifi at home, no connection on the subway. The type of network you are on when you record each exchange adds another layer of context to the chain.',
      whyItMatters: 'Network type on its own says little. Combined with location, time, and the pattern of other exchanges, it contributes to the overall plausibility of a chain. A phone that was on 4G at 3pm in one city and wifi at 8pm in another city tells a consistent story about a person moving through a real day.'
    },
    visualize: function(raw) { return null; }
  },

  ambientLightSensor: {
    id: 'ambientLightSensor',
    humanName: 'Ambient light',
    tier: WEIGHT.ENRICHMENT,
    origin: ORIGIN.DEVICE,
    expectedOn: ['android'], // Chrome on Android; rare on iOS and PC browsers
    capture: function(ctx) {
      if (!ctx) return null;
      var cap = ctx.deviceCapabilities || {};
      return {
        hardwareAvailable: !!cap.hasAmbientLight,
        liveReading: (typeof cap.liveLight === 'number') ? cap.liveLight : null
      };
    },
    interpret: function(raw, dClass) {
      if (!raw) return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Unknown' };
      if (!raw.hardwareAvailable) {
        return { presence: 'absent', expected: (dClass === 'android'), behavior: 'n/a', contribution: 0, summary: 'Ambient light sensor not accessible on this device or browser' };
      }
      if (raw.liveReading !== null) {
        return { presence: 'present', expected: true, behavior: 'normal', contribution: WEIGHT.ENRICHMENT, summary: 'Active — ' + raw.liveReading + ' lux' };
      }
      return { presence: 'present', expected: true, behavior: 'normal', contribution: 0, summary: 'Sensor present, awaiting reading' };
    },
    copy: {
      whatItMeans: 'A small sensor on the front of the phone measures how bright the room is. Under a desk lamp, in a pocket, on a sunny street — the light value changes. When this sensor is active, its reading becomes part of each record.',
      whyItMatters: 'Ambient light is a bonus signal. Most devices do not expose it to the browser. When it is present, it is strong evidence of real hardware — and a source that simulators rarely bother to fake because it is rare to begin with.'
    },
    visualize: function(raw) { return null; }
  },

  pressureSensor: {
    id: 'pressureSensor',
    humanName: 'Barometric pressure',
    tier: WEIGHT.ENRICHMENT,
    origin: ORIGIN.DEVICE,
    expectedOn: ['android'], // Pressure API very rare; Android Chrome most likely
    capture: function(ctx) {
      if (!ctx) return null;
      var cap = ctx.deviceCapabilities || {};
      return {
        hardwareAvailable: !!cap.hasPressure,
        liveReading: (typeof cap.livePressure === 'number') ? cap.livePressure : null
      };
    },
    interpret: function(raw, dClass) {
      if (!raw) return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Unknown' };
      if (!raw.hardwareAvailable) {
        return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Barometer not accessible on this device or browser' };
      }
      if (raw.liveReading !== null) {
        return { presence: 'present', expected: true, behavior: 'normal', contribution: WEIGHT.ENRICHMENT, summary: 'Active — ' + raw.liveReading + ' hPa' };
      }
      return { presence: 'present', expected: true, behavior: 'normal', contribution: 0, summary: 'Sensor present, awaiting reading' };
    },
    copy: {
      whatItMeans: 'Many modern phones have a barometer that measures air pressure. Pressure changes with altitude and weather. A phone at ground level on a clear day reads one value; the same phone on a mountain or during a storm reads another. When your device exposes this sensor, its readings become part of the record.',
      whyItMatters: 'Barometric pressure is an unusual signal to fabricate because it correlates with weather systems and elevation in ways a simulator rarely attempts. When present across a chain, it adds another physical constraint to the overall pattern of reality.'
    },
    visualize: function(raw) { return null; }
  },

  webglRenderer: {
    id: 'webglRenderer',
    humanName: 'Graphics renderer',
    tier: WEIGHT.ENRICHMENT,
    origin: ORIGIN.DEVICE,
    expectedOn: ['ios', 'android', 'pc'],
    capture: function(ctx) {
      if (!ctx) return null;
      var cap = ctx.deviceCapabilities || {};
      return {
        hardwareAvailable: !!cap.hasWebGL,
        liveReading: cap.liveWebGL || null
      };
    },
    interpret: function(raw, dClass) {
      if (!raw) return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Unknown' };
      if (!raw.hardwareAvailable) {
        return { presence: 'absent', expected: true, behavior: 'worth-noting', contribution: 0, summary: 'WebGL blocked — unusual and worth checking' };
      }
      return { presence: 'present', expected: true, behavior: 'normal', contribution: WEIGHT.ENRICHMENT, summary: 'Active — renders ' + (raw.liveReading ? '(' + raw.liveReading.substring(0, 32) + '…)' : 'hash only') };
    },
    copy: {
      whatItMeans: 'Every device has a graphics chip. When your browser renders a small test pattern using that chip, the exact image that comes back depends on the specific hardware and drivers — down to tiny rounding differences. A hash of that pattern becomes part of your device fingerprint.',
      whyItMatters: 'Graphics rendering is one of the most distinctive hardware fingerprints available to a browser. It is very hard for a simulator to fake convincingly because it requires matching the actual floating-point behavior of a specific GPU and driver combination. A chain with a stable WebGL signature over many records strongly suggests one consistent piece of hardware.'
    },
    visualize: function(raw) { return null; }
  },

  canvasRenderer: {
    id: 'canvasRenderer',
    humanName: '2D canvas rendering',
    tier: WEIGHT.ENRICHMENT,
    origin: ORIGIN.DEVICE,
    expectedOn: ['ios', 'android', 'pc'],
    capture: function(ctx) {
      if (!ctx) return null;
      var cap = ctx.deviceCapabilities || {};
      return {
        hardwareAvailable: !!cap.hasCanvas,
        liveReading: cap.liveCanvas || null
      };
    },
    interpret: function(raw, dClass) {
      if (!raw) return { presence: 'absent', expected: false, behavior: 'n/a', contribution: 0, summary: 'Unknown' };
      if (!raw.hardwareAvailable) {
        return { presence: 'absent', expected: true, behavior: 'worth-noting', contribution: 0, summary: 'Canvas rendering blocked — unusual' };
      }
      return { presence: 'present', expected: true, behavior: 'normal', contribution: WEIGHT.ENRICHMENT, summary: 'Active — rendering hash captured' };
    },
    copy: {
      whatItMeans: 'Your browser can draw shapes and text into a hidden canvas. The exact pixel result depends on your operating system, installed fonts, graphics drivers, and color profile. A hash of that result is another part of your device fingerprint.',
      whyItMatters: 'Canvas rendering is a quieter cousin of WebGL. It is less variable but harder to fake across platforms. Together with WebGL and other fingerprints, it helps confirm that the chain comes from one consistent device rather than a shifting simulation.'
    },
    visualize: function(raw) { return null; }
  }

};

// --- Aggregate rollup ---
// Given chain + optional specific exchange + device class, runs every
// signal and produces a verdict object the UI consumes.
function rollup(ctx) {
  ctx = ctx || {};
  var dClass = ctx.deviceClass || deviceClass();
  var signalResults = [];
  var countStrong = 0;       // normal + present + expected
  var countWorthNoting = 0;
  var countAlarming = 0;
  var countExpected = 0;     // how many sources should contribute on this device
  var countPresentExpected = 0;
  var countBonus = 0;        // present AND not-expected (device went above baseline)
  var totalContribution = 0;
  var maxContribution = 0;   // theoretical max if every expected source were normal

  // Per-origin counts for the top-of-card summary
  var byOrigin = {
    device:   { expected: 0, contributing: 0, total: 0 },
    external: { expected: 0, contributing: 0, total: 0 },
    chain:    { expected: 0, contributing: 0, total: 0 }
  };

  var ids = Object.keys(SIGNALS);
  for (var i = 0; i < ids.length; i++) {
    var sig = SIGNALS[ids[i]];
    var expected = sig.expectedOn.indexOf(dClass) !== -1;
    var raw = null;
    try { raw = sig.capture(ctx); } catch(e) { raw = null; }
    var interp = sig.interpret(raw, dClass);
    var origin = sig.origin || 'chain'; // default for older entries

    // Track counts
    if (expected) {
      countExpected++;
      maxContribution += sig.tier;
      if (interp.presence === 'present') countPresentExpected++;
    } else if (interp.presence === 'present') {
      countBonus++;
      totalContribution += sig.tier;
    }

    if (interp.behavior === 'normal' && interp.presence === 'present') countStrong++;
    else if (interp.behavior === 'worth-noting') countWorthNoting++;
    else if (interp.behavior === 'alarming') countAlarming++;

    totalContribution += (interp.contribution || 0);

    // Origin bucket counts — only count sources that are expected on this device
    if (byOrigin[origin]) {
      byOrigin[origin].total++;
      if (expected) {
        byOrigin[origin].expected++;
        if (interp.presence === 'present') byOrigin[origin].contributing++;
      } else if (interp.presence === 'present') {
        // Bonus from unexpected origin still counts as contributing
        byOrigin[origin].contributing++;
      }
    }

    signalResults.push({
      id: sig.id,
      humanName: sig.humanName,
      tier: sig.tier,
      origin: origin,
      expected: expected,
      presence: interp.presence,
      behavior: interp.behavior,
      contribution: interp.contribution,
      summary: interp.summary,
      raw: raw,
      copy: sig.copy,
      visualize: sig.visualize
    });
  }

  // Verdict statement based on overall picture.
  var statement;
  var statementTone;
  if (countAlarming > 0) {
    statement = 'Some signals look wrong on this chain';
    statementTone = 'alarming';
  } else if (countStrong >= countExpected) {
    statement = 'Strong proof-of-human across available data';
    statementTone = 'strong';
  } else if (countStrong >= Math.ceil(countExpected / 2)) {
    statement = 'Partial proof-of-human — more data would strengthen this chain';
    statementTone = 'partial';
  } else {
    statement = 'Limited data so far — chain is still forming';
    statementTone = 'weak';
  }

  // Total across all origins — "X of Y available data sources"
  var totalContributing = byOrigin.device.contributing + byOrigin.external.contributing + byOrigin.chain.contributing;
  var totalAvailable = byOrigin.device.expected + byOrigin.external.expected + byOrigin.chain.expected;

  return {
    deviceClass: dClass,
    statement: statement,
    tone: statementTone,
    countStrong: countStrong,
    countWorthNoting: countWorthNoting,
    countAlarming: countAlarming,
    countExpected: countExpected,
    countPresentExpected: countPresentExpected,
    countBonus: countBonus,
    totalContribution: totalContribution,
    maxContribution: maxContribution,
    totalContributing: totalContributing,
    totalAvailable: totalAvailable,
    byOrigin: byOrigin,
    signals: signalResults
  };
}

return {
  deviceClass: deviceClass,
  WEIGHT: WEIGHT,
  ORIGIN: ORIGIN,
  SIGNALS: SIGNALS,
  rollup: rollup,
  rollupForBroadcast: rollupForBroadcast
};

// --- Broadcast-safe rollup ---
// Runs rollup() and returns a JSON-safe subset for transmission in
// thread_snapshot. Strips non-serializable fields (capture/interpret/visualize
// are functions), strips raw device data (device-private, varies per device),
// strips copy (lookup-able from receiver's own registry by signal.id).
// Receiver reconstructs rendering by looking up copy/visualize in their own
// POH.SIGNALS registry keyed by id. If an id isn't present in the receiver's
// registry (counterparty on newer version), the row degrades gracefully to
// just the shipped humanName + summary.
function rollupForBroadcast(ctx) {
  var v = rollup(ctx);
  if (!v) return null;
  return {
    deviceClass: v.deviceClass,
    statement: v.statement,
    tone: v.tone,
    countStrong: v.countStrong,
    countWorthNoting: v.countWorthNoting,
    countAlarming: v.countAlarming,
    countExpected: v.countExpected,
    countPresentExpected: v.countPresentExpected,
    countBonus: v.countBonus,
    totalContributing: v.totalContributing,
    totalAvailable: v.totalAvailable,
    byOrigin: v.byOrigin,
    signals: (v.signals || []).map(function(s) {
      return {
        id: s.id,
        humanName: s.humanName,
        tier: s.tier,
        origin: s.origin,
        expected: s.expected,
        presence: s.presence,
        behavior: s.behavior,
        contribution: s.contribution,
        summary: s.summary
      };
    })
  };
}

})();

// ============================================================
// MINIMAL QR ENCODER
// ============================================================
const QR = {
  _data: {},
  render: function(text, canvas, size) {
    size = size || 300;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const count = qr.getModuleCount();
      const ctx = canvas.getContext('2d');
      const pad = Math.floor(size * 0.06);
      canvas.width = size;
      canvas.height = size;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#000000';
      const cs = (size - pad * 2) / count;
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(pad + c * cs, pad + r * cs, cs + 0.5, cs + 0.5);
          }
        }
      }
    } catch(e) {
      console.error('QR generation failed:', e);
    }
  },
  generate: function(text, canvas, size) {
    const id = canvas.id.replace('-qr', '');
    this._data[id] = text;
    this.render(text, canvas, size);
  }
};
