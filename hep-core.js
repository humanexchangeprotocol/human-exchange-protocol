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
const APP_VERSION='2.40.0';
const VERSION_CHECK_URL='https://humanexchangeprotocol.github.io/human-exchange-protocol/version.json';
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
    if(!cats[k])cats[k]={n:0,tv:0,g:0,r:0,vals:[]};
    cats[k].n++;cats[k].tv+=rec.value;cats[k].vals.push(rec.value);
    if(rec.energyState==='provided')cats[k].g++;else if(rec.energyState==='received')cats[k].r++;
  });
  const catEntries=Object.entries(cats).sort(function(a,b){return b[1].n-a[1].n;});
  const catOut={},stabOut={};
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
  return{n:ex.length,d:+cd(c).toFixed(1),g:gr.provided,r:gr.received,cats:catOut,words:wordsOut,time:timeOut,stab:stabOut,t0:c[0].timestamp,t1:c[c.length-1].timestamp,pings:pc,integrity:integrity};
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
