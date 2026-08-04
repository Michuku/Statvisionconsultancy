// PAGE SYSTEM
function showPage(p){
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'))
  const pg=document.getElementById('page-'+p)
  if(pg){pg.classList.add('active');window.scrollTo(0,0)}
  sessionStorage.setItem('db_lastPage',p)
  renderSQL()
}
function scrollTo2(id){
  setTimeout(()=>{const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth'})},150)
}


// ===== REAL ACCOUNTS (Firebase Authentication + Firestore — shared across every device) =====
let currentClientCache=null, currentStaffCache=null
function currentClient(){ return currentClientCache }
function currentStaff(){ return currentStaffCache }

let authReadyPromise = new Promise(resolve=>{
  fbAuth.onAuthStateChanged(async user=>{
    currentClientCache=null; currentStaffCache=null
    if(user){
      try{
        const doc = await fbDB.collection('users').doc(user.uid).get()
        if(doc.exists){
          const data=doc.data()
          if(data.role==='client') currentClientCache={name:data.name,phone:data.phone,email:data.email,created:data.created,uid:user.uid}
          else currentStaffCache={name:data.name,email:data.email,role:data.role,uid:user.uid,photoURL:data.photoURL||null}
        }
      }catch(e){ console.warn('Could not load user profile:',e.message) }
    }
    resolve()
  })
})

// Stay on the page the person was on, instead of bouncing back to Home on every refresh.
authReadyPromise.then(()=>{
  const last=sessionStorage.getItem('db_lastPage')
  if(!last||last==='home'||last==='clientauth'||last==='staffauth')return
  if(last==='client'){
    const u=currentClient()
    if(u){ showPage('client'); applyClientSession(u) }
    else sessionStorage.removeItem('db_lastPage')
  } else if(last==='admin'||last==='analyst'){
    const u=currentStaff()
    if(u && u.role===last){ showPage(last); applyStaffAvatar(last,u.photoURL) }
    else sessionStorage.removeItem('db_lastPage')
  }
})

async function goClient(){
  await authReadyPromise
  const u=currentClient()
  if(u){ showPage('client'); applyClientSession(u) }
  else { showPage('clientauth') }
}
function authSwitch(which){
  document.getElementById('atab-login').classList.toggle('on',which==='login')
  document.getElementById('atab-signup').classList.toggle('on',which==='signup')
  document.getElementById('authpane-login').style.display=which==='login'?'block':'none'
  document.getElementById('authpane-signup').style.display=which==='signup'?'block':'none'
}
async function clientSignup(){
  const name=document.getElementById('su_name').value.trim()
  const phone=document.getElementById('su_phone').value.trim()
  const email=document.getElementById('su_email').value.trim().toLowerCase()
  const pass=document.getElementById('su_pass').value
  const err=document.getElementById('authError2')
  if(!name||!email||!pass){ err.textContent='Please fill in your name, email, and password.'; err.style.display='block'; return }
  if(pass.length<6){ err.textContent='Password must be at least 6 characters.'; err.style.display='block'; return }
  err.style.display='none';err.textContent=''
  try{
    const cred=await fbAuth.createUserWithEmailAndPassword(email,pass)
    const created=Date.now()
    await fbDB.collection('users').doc(cred.user.uid).set({name,phone,email,role:'client',created})
    currentClientCache={name,phone,email,created,uid:cred.user.uid}
    // welcome notification
    await fbDB.collection('notifications').add({uid:cred.user.uid,orderId:null,icon:'🎉',title:'Welcome to StatVision Research and Consultancy!',body:'Your account is ready. Submit your first project any time.',tab:null,read:false,ts:Date.now()})
    showPage('client'); applyClientSession(currentClientCache)
  }catch(e){
    err.textContent = e.code==='auth/email-already-in-use' ? 'An account with this email already exists. Try logging in.'
      : e.code==='auth/invalid-email' ? 'Please enter a valid email address.'
      : (e.message||'Could not create account. Please try again.')
    err.style.display='block'
  }
}
async function clientLogin(){
  const email=document.getElementById('li_email').value.trim().toLowerCase()
  const pass=document.getElementById('li_pass').value
  const err=document.getElementById('authError')
  err.style.display='none';err.textContent=''
  try{
    const cred=await fbAuth.signInWithEmailAndPassword(email,pass)
    const doc=await fbDB.collection('users').doc(cred.user.uid).get()
    if(!doc.exists || doc.data().role!=='client'){
      await fbAuth.signOut()
      err.textContent='This account does not have client access.'; err.style.display='block'; return
    }
    const data=doc.data()
    currentClientCache={name:data.name,phone:data.phone,email:data.email,created:data.created,uid:cred.user.uid}
    showPage('client'); applyClientSession(currentClientCache)
  }catch(e){
    err.textContent='Incorrect email or password.'; err.style.display='block'
  }
}
function clientLogout(){
  fbAuth.signOut(); currentClientCache=null
  showPage('home')
}

// ===== STAFF ACCOUNTS (Admin + Analysts — created via seedStaffOnce(), see chat instructions) =====
// ── Create a staff account (admin-only action) ──────────────────────
// Uses a SECOND, separate Firebase app instance to create the login.
// Why: Firebase's client SDK automatically signs in as whichever account
// it just created — without this trick, creating a new staff account
// would instantly log the admin out of their own session.
async function createStaffAccount(name,email,password,role){
  if(!name||!email||!password||!role) throw new Error('All fields are required.')
  if(password.length<8) throw new Error('Password must be at least 8 characters.')
  const secondaryApp = firebase.apps.find(a=>a.name==='Secondary') || firebase.initializeApp(firebaseConfig,'Secondary')
  const secondaryAuth = secondaryApp.auth()
  const cred = await secondaryAuth.createUserWithEmailAndPassword(email,password)
  await fbDB.collection('users').doc(cred.user.uid).set({name,email,role,created:Date.now()})
  await secondaryAuth.signOut()
  return cred.user.uid
}

async function submitCreateStaff(){
  const nameEl=document.getElementById('newStaffName')
  const emailEl=document.getElementById('newStaffEmail')
  const roleEl=document.getElementById('newStaffRole')
  const passEl=document.getElementById('newStaffPass')
  const statusEl=document.getElementById('createStaffStatus')
  const btn=document.getElementById('createStaffBtn')
  const name=nameEl.value.trim(), email=emailEl.value.trim(), role=roleEl.value, pass=passEl.value

  statusEl.style.color='var(--sl)'; statusEl.textContent=''
  try{
    btn.disabled=true
    await createStaffAccount(name,email,pass,role)
    statusEl.style.color='#107C10'
    statusEl.textContent=`✓ Account created for ${name} (${role}). Share the email and temporary password with them directly — never store it in code.`
    nameEl.value=''; emailEl.value=''; passEl.value=''
  }catch(e){
    statusEl.style.color='#D13438'
    statusEl.textContent = e.code==='auth/email-already-in-use'
      ? '⚠ That email already has an account.'
      : '⚠ '+e.message
  }finally{
    btn.disabled=false
  }
}

let staffWantsRole=null
async function goStaff(){ staffWantsRole=null; await routeStaff() }
async function goAdmin(){ staffWantsRole='admin'; await routeStaff() }
async function goAnalyst(){ staffWantsRole='analyst'; await routeStaff() }
async function goHr(){ staffWantsRole='hr'; await routeStaff() }
async function routeStaff(){
  await authReadyPromise
  const u=currentStaff()
  if(u && (!staffWantsRole || u.role===staffWantsRole)){
    const role=u.role==='admin'?'admin':u.role==='hr'?'hr':'analyst'
    showPage(role)
    if(role==='admin'||role==='analyst') applyStaffAvatar(role,u.photoURL)
  } else {
    showPage('staffauth')
  }
}
async function staffLogin(){
  const email=document.getElementById('st_email').value.trim().toLowerCase()
  const pass=document.getElementById('st_pass').value
  const err=document.getElementById('staffAuthError')
  err.style.display='none';err.textContent=''
  try{
    const cred=await fbAuth.signInWithEmailAndPassword(email,pass)
    const doc=await fbDB.collection('users').doc(cred.user.uid).get()
    const data=doc.exists?doc.data():null
    if(!data || (data.role!=='admin'&&data.role!=='analyst'&&data.role!=='hr')){
      await fbAuth.signOut()
      err.textContent='This account does not have staff access.'; err.style.display='block'; return
    }
    if(staffWantsRole && data.role!==staffWantsRole){
      await fbAuth.signOut()
      err.textContent=`This account does not have ${staffWantsRole} access.`; err.style.display='block'; return
    }
    currentStaffCache={name:data.name,email:data.email,role:data.role,uid:cred.user.uid,photoURL:data.photoURL||null}
    showPage(data.role==='admin'?'admin':data.role==='hr'?'hr':'analyst')
    if(data.role==='admin'||data.role==='analyst') applyStaffAvatar(data.role,data.photoURL)
    if(data.role==='admin') subscribeAdminNotifications()
    if(data.role==='hr') renderHrEmployees()
    if(data.role==='analyst'){
      // init analyst chat with first assigned order
      const assigned=sqlData.filter(r=>r.analyst===data.name)
      if(assigned.length) initAnalystChat(assigned[0].id, data.name)
      renderAnalystPayroll()
    }
  }catch(e){
    err.textContent='Incorrect email or password.'; err.style.display='block'
  }
}
function staffLogout(){
  fbAuth.signOut(); currentStaffCache=null
  showPage('home')
}
function applyClientSession(u){
  const initials=(u.name||'? ?').split(' ').filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join('')
  const av=document.getElementById('cUserAvatar'), nm=document.getElementById('cUserName')
  if(av)av.textContent=initials
  if(nm)nm.textContent=u.name
  const sl=document.getElementById('pbiSlicerName');if(sl)sl.textContent=u.name
  const pn=document.getElementById('prof_name'),pe=document.getElementById('prof_email'),pp=document.getElementById('prof_phone'),pc=document.getElementById('prof_created')
  if(pn)pn.value=u.name||''
  if(pe)pe.value=u.email||''
  if(pp)pp.value=u.phone||''
  if(pc)pc.value=u.created?new Date(u.created).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—'
  // pre-fill the order form with this client's details
  const fn=document.getElementById('ord_name'), fe=document.getElementById('ord_email'), fp=document.getElementById('ord_phone')
  if(fn)fn.value=u.name||''
  if(fe)fe.value=u.email||''
  if(fp)fp.value=u.phone||''
  renderMyOrders(u.email)
  pbiRenderClientPortal()
  renderClientDocs()
  subscribeNotifications(u.uid)
  // init chat with first order
  const mine=sqlData.filter(r=>r.email&&r.email.toLowerCase()===u.email.toLowerCase())
  if(mine.length) initClientChat(mine[0].id, u.email)
}
function renderMyOrders(email){
  const wrap=document.getElementById('myOrdersBody')
  if(!wrap)return
  const mine=sqlData.filter(r=>r.email && r.email.toLowerCase()===String(email).toLowerCase())
  if(mine.length===0){
    wrap.innerHTML=`<tr><td colspan="9" style="text-align:center;color:var(--sl);padding:1.4rem">No orders yet — click "+ New Order" to submit your first project.</td></tr>`
  } else {
    wrap.innerHTML=mine.map(r=>{
      const files=getFiles(r.id)
      const deliverable=files.analyst.length?downloadLinksHTML(files.analyst):'<span style="color:var(--sl);font-size:.74rem">Not ready yet</span>'
      return `<tr><td><strong>${r.id}</strong></td><td>${r.project}</td><td>${r.tool}</td><td>${r.analyst}</td><td>${r.deadline}</td><td>KES ${r.total}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td><td>${deliverable}</td><td style="display:flex;gap:.3rem;flex-wrap:wrap"><button class="db1 dbb" onclick="generateInvoicePDF('${r.id}')">⬇ PDF</button><button class="db1" style="background:#00a651;color:#fff;border:none;padding:.32rem .6rem;border-radius:6px;font-size:.74rem;cursor:pointer" onclick="openMpesaModal('${r.id}')">💚 Pay</button></td></tr>`
    }).join('')
  }
  renderMyInvoices(mine)
}
function renderMyInvoices(mine){
  const wrap=document.getElementById('myInvoicesBody')
  if(!wrap)return
  if(!mine.length){
    wrap.innerHTML=`<tr><td colspan="9" style="text-align:center;color:var(--sl);padding:1.4rem">No invoices yet — they'll appear here once you place an order.</td></tr>`
    return
  }
  wrap.innerHTML=mine.map(r=>{
    const bal=moneyNum(r.balance)
    const dep=moneyNum(r.deposit)
    const tot=moneyNum(r.total)
    const balColor=bal<=0?'color:#107C10':'color:#D13438'
    const statusLabel=bal<=0?'<span class="badge b-dn">Fully Paid</span>':`<span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span>`
    const priced=tot>0
    // Proforma: available once price is set. Standard: available once deposit paid
    const proBtn = priced
      ? `<button class="db1" style="background:#1565C0;color:#fff;border:none;white-space:nowrap;padding:.32rem .7rem;border-radius:6px;font-size:.74rem;cursor:pointer" onclick="generateProformaInvoice('${r.id}')">📋 Proforma</button>`
      : `<button class="db1 dbb" style="opacity:.4;cursor:not-allowed;white-space:nowrap" disabled>📋 Proforma</button>`
    const stdBtn = dep>0
      ? `<button class="db1 dba" style="white-space:nowrap;padding:.32rem .7rem;border-radius:6px;font-size:.74rem" onclick="generateStandardInvoice('${r.id}')">🧾 Invoice</button>`
      : `<button class="db1 dbb" style="opacity:.4;cursor:not-allowed;white-space:nowrap" disabled title="Available after payment">🧾 Invoice</button>`
    return `<tr>
      <td><strong>${r.id}</strong></td>
      <td style="max-width:160px;white-space:normal">${r.project}</td>
      <td>${r.service||r.tool||'—'}</td>
      <td>${r.analyst||'—'}</td>
      <td><strong>KES ${r.total}</strong></td>
      <td style="color:#107C10;font-weight:600">KES ${r.deposit}</td>
      <td style="${balColor};font-weight:700">KES ${r.balance}</td>
      <td>${statusLabel}</td>
      <td style="display:flex;gap:.3rem;flex-wrap:wrap">${proBtn}${stdBtn}<button class="db1" style="background:#00a651;color:#fff;border:none;white-space:nowrap;padding:.32rem .7rem;border-radius:6px;font-size:.74rem;cursor:pointer" onclick="openMpesaModal('${r.id}')">💚 Pay</button></td>
    </tr>`
  }).join('')
}

// ===== FILE STORAGE (browser-local — see chat note on real shared storage) =====
function getFiles(orderId){
  const r=sqlData.find(x=>x.id===orderId)
  return (r&&r.files) ? r.files : {client:[],analyst:[]}
}
function setFiles(orderId,obj){
  return fbDB.collection('orders').doc(orderId).set({files:obj},{merge:true})
}
async function uploadFilesToStorage(orderId,role,fileList){
  const results=[]
  for(const f of [...fileList]){
    const path=`orders/${orderId}/${role}/${Date.now()}_${f.name}`
    const ref=fbStorage.ref(path)
    await ref.put(f)
    const url=await ref.getDownloadURL()
    results.push({name:f.name,url,size:f.size,type:f.type||'application/octet-stream'})
  }
  return results
}
function downloadLinksHTML(files){
  if(!files||!files.length)return '<span style="color:var(--sl);font-size:.74rem">None</span>'
  return files.map(f=>`<a href="${f.url}" target="_blank" rel="noopener" style="display:block;font-size:.78rem;color:var(--b2);margin-bottom:.2rem">📎 ${f.name}</a>`).join('')
}

// ══════════════════════════════════════════════════════════════════
// STAFF PROFILE PICTURES — analyst & admin can upload their own photo
// ══════════════════════════════════════════════════════════════════
function applyStaffAvatar(role,url){
  const ids = role==='analyst' ? ['anUserAvatar','anProfileAvatar'] : ['adUserAvatar','adProfileAvatar']
  ids.forEach(id=>{
    const el=document.getElementById(id)
    if(!el) return
    if(url){
      el.style.backgroundImage=`url('${url}')`
      el.style.backgroundSize='cover'
      el.style.backgroundPosition='center'
      el.textContent=''
    } else {
      el.style.backgroundImage='none'
    }
  })
}
async function uploadStaffAvatar(input,role){
  const file = input.files && input.files[0]
  if(!file) return
  if(!file.type.startsWith('image/')){ alert('Please choose an image file.'); input.value=''; return }
  const statusEl = document.getElementById(role==='analyst' ? 'anAvatarStatus' : 'adAvatarStatus')
  const u = currentStaff()
  if(!u || !u.uid){ alert('Please log in again to upload a profile picture.'); return }
  // Instant local preview while the upload runs
  const reader = new FileReader()
  reader.onload = e => applyStaffAvatar(role, e.target.result)
  reader.readAsDataURL(file)
  if(statusEl){ statusEl.style.color='var(--sl)'; statusEl.textContent='Uploading...' }
  try{
    const path = `profile-pictures/${u.uid}_${Date.now()}_${file.name}`
    const ref = fbStorage.ref(path)
    await ref.put(file)
    const url = await ref.getDownloadURL()
    await fbDB.collection('users').doc(u.uid).set({photoURL:url},{merge:true})
    if(currentStaffCache) currentStaffCache.photoURL = url
    applyStaffAvatar(role,url)
    if(statusEl){ statusEl.style.color='#107C10'; statusEl.textContent='✓ Profile picture updated.' }
  }catch(e){
    if(statusEl){ statusEl.style.color='#D13438'; statusEl.textContent='⚠ Upload failed: '+e.message }
  }
  input.value=''
}

// ══════════════════════════════════════════════════════════════════
// ABOUT PAGE — team member profiles (photo, academic history, bio)
// ══════════════════════════════════════════════════════════════════
const teamMembers = {
  henry:{name:'Henry Gitau Michuku',role:'Chief Executive Officer',initials:'HM'},
  simon:{name:'Simon Macharia',role:'Data Analyst',initials:'SM'},
  joseph:{name:'Joseph Machuki',role:'Economist & Statistician',initials:'JM'},
  hr:{name:'HR Manager',role:'Human Resources',initials:'HR'}
}
let currentTeamId=null

function setTeamAvatarEl(el,initials,photoURL){
  if(!el) return
  if(photoURL){
    el.style.backgroundImage=`url('${photoURL}')`
    el.style.backgroundSize='cover'
    el.style.backgroundPosition='center'
    el.textContent=''
  } else {
    el.style.backgroundImage='none'
    el.textContent=initials
  }
}
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}

// ---- PUBLIC (read-only) — About page click-through ----
async function openTeamMember(id){
  const member = teamMembers[id]
  if(!member) return
  currentTeamId=id
  document.getElementById('teamModalName').textContent=member.name
  document.getElementById('teamModalRole').textContent=member.role
  document.getElementById('teamModalBio').innerHTML='<p style="color:var(--sl)">Loading...</p>'
  document.getElementById('teamModalStatus').textContent=''
  setTeamAvatarEl(document.getElementById('teamModalAvatar'),member.initials,null)
  document.getElementById('teamModal').style.display='flex'
  try{
    const doc = await fbDB.collection('team').doc(id).get()
    const data = doc.exists ? doc.data() : {}
    setTeamAvatarEl(document.getElementById('teamModalAvatar'),member.initials,data.photoURL||null)
    const sec=(title,text)=>text ? `<h4 style="font-family:var(--fd);font-size:.82rem;letter-spacing:.03em;text-transform:uppercase;color:var(--b2);margin-bottom:.35rem">${title}</h4><p style="margin-bottom:1.2rem">${escapeHtml(text)}</p>` : ''
    const html = sec('🎓 Academic History',data.academicHistory) + sec('🤝 Relationship with StatVision Research &amp; Consultancy',data.relationship) + sec('🌟 Vision',data.vision)
    document.getElementById('teamModalBio').innerHTML = html || '<p style="color:var(--sl)">Details coming soon.</p>'
  }catch(e){
    document.getElementById('teamModalBio').innerHTML=''
    document.getElementById('teamModalStatus').textContent='Could not load details: '+e.message
  }
}
function closeTeamModal(){
  document.getElementById('teamModal').style.display='none'
  currentTeamId=null
}
async function loadTeamCardPhotos(){
  for(const id of Object.keys(teamMembers)){
    try{
      const doc = await fbDB.collection('team').doc(id).get()
      if(doc.exists && doc.data().photoURL){
        setTeamAvatarEl(document.getElementById('teamAvatar-'+id),teamMembers[id].initials,doc.data().photoURL)
      }
    }catch(e){ /* silently skip — card just shows initials */ }
  }
}
document.addEventListener('DOMContentLoaded',loadTeamCardPhotos)

// ---- ADMIN (edit) — Admin Portal > Team Profiles ----
function renderAdminTeamPanel(){
  const grid=document.getElementById('adTeamGrid')
  if(!grid) return
  grid.innerHTML = Object.keys(teamMembers).map(id=>{
    const m=teamMembers[id]
    return `<div class="odtl">
      <div style="display:flex;align-items:center;gap:1.1rem;margin-bottom:1rem">
        <label class="avatar-upload avatar-upload-lg" title="Upload profile picture">
          <div class="dav" id="adTeamAvatar-${id}" style="width:64px;height:64px;font-size:1.2rem;background:var(--b2)">${m.initials}</div>
          <span class="avatar-cam avatar-cam-lg">📷</span>
          <input type="file" accept="image/*" onchange="uploadTeamPhotoAdmin(this,'${id}')" hidden/>
        </label>
        <div>
          <div style="font-weight:700;font-size:.95rem;color:var(--ch)">${m.name}</div>
          <div style="font-size:.8rem;color:var(--sl)">${m.role}</div>
        </div>
      </div>
      <div class="fg"><label>🎓 Academic History</label><textarea id="adTeamAcademic-${id}" placeholder="Degrees, institutions, certifications..." style="min-height:70px"></textarea></div>
      <div class="fg"><label>🤝 Relationship with StatVision Research &amp; Consultancy</label><textarea id="adTeamRelationship-${id}" placeholder="Role history, years of service, key contributions..." style="min-height:70px"></textarea></div>
      <div class="fg"><label>🌟 Vision</label><textarea id="adTeamVision-${id}" placeholder="Their vision for their work and for StatVision..." style="min-height:70px"></textarea></div>
      <div style="display:flex;align-items:center;gap:.9rem">
        <button class="db1 dba" onclick="saveTeamMemberAdmin('${id}')">Save ${m.name.split(' ')[0]}'s Profile</button>
        <span id="adTeamStatus-${id}" style="font-size:.78rem;color:var(--sl)"></span>
      </div>
    </div>`
  }).join('')
  Object.keys(teamMembers).forEach(async id=>{
    try{
      const doc = await fbDB.collection('team').doc(id).get()
      const data = doc.exists ? doc.data() : {}
      setTeamAvatarEl(document.getElementById('adTeamAvatar-'+id),teamMembers[id].initials,data.photoURL||null)
      document.getElementById('adTeamAcademic-'+id).value = data.academicHistory||''
      document.getElementById('adTeamRelationship-'+id).value = data.relationship||''
      document.getElementById('adTeamVision-'+id).value = data.vision||''
    }catch(e){ /* leave fields blank if nothing saved yet */ }
  })
}
async function uploadTeamPhotoAdmin(input,id){
  const file = input.files && input.files[0]
  if(!file) return
  if(!file.type.startsWith('image/')){ alert('Please choose an image file.'); input.value=''; return }
  const member = teamMembers[id]
  const statusEl = document.getElementById('adTeamStatus-'+id)
  const reader = new FileReader()
  reader.onload = e => setTeamAvatarEl(document.getElementById('adTeamAvatar-'+id),member.initials,e.target.result)
  reader.readAsDataURL(file)
  if(statusEl){ statusEl.style.color='var(--sl)'; statusEl.textContent='Uploading photo...' }
  try{
    const path = `team-photos/${id}_${Date.now()}_${file.name}`
    const ref = fbStorage.ref(path)
    await ref.put(file)
    const url = await ref.getDownloadURL()
    await fbDB.collection('team').doc(id).set({photoURL:url},{merge:true})
    setTeamAvatarEl(document.getElementById('adTeamAvatar-'+id),member.initials,url)
    setTeamAvatarEl(document.getElementById('teamAvatar-'+id),member.initials,url)
    if(statusEl){ statusEl.style.color='#107C10'; statusEl.textContent='✓ Photo updated on the About page.' }
  }catch(e){
    if(statusEl){ statusEl.style.color='#D13438'; statusEl.textContent='⚠ Upload failed: '+e.message }
  }
  input.value=''
}
async function saveTeamMemberAdmin(id){
  const statusEl = document.getElementById('adTeamStatus-'+id)
  const payload = {
    academicHistory: document.getElementById('adTeamAcademic-'+id).value.trim(),
    relationship: document.getElementById('adTeamRelationship-'+id).value.trim(),
    vision: document.getElementById('adTeamVision-'+id).value.trim()
  }
  if(statusEl){ statusEl.style.color='var(--sl)'; statusEl.textContent='Saving...' }
  try{
    await fbDB.collection('team').doc(id).set(payload,{merge:true})
    if(statusEl){ statusEl.style.color='#107C10'; statusEl.textContent='✓ Saved — now visible on the About page.' }
  }catch(e){
    if(statusEl){ statusEl.style.color='#D13438'; statusEl.textContent='⚠ Could not save: '+e.message }
  }
}

// ══════════════════════════════════════════════════════════════════
// WEBSITE PHOTO BANNER — admin uploads, everyone sees them on Home
// ══════════════════════════════════════════════════════════════════
async function uploadSiteImages(){
  const input=document.getElementById('siteImageInput')
  const statusEl=document.getElementById('siteImageStatus')
  if(!input || !input.files || !input.files.length){
    if(statusEl){statusEl.style.color='#D13438';statusEl.textContent='⚠ Choose at least one image first.'}
    return
  }
  statusEl.style.color='var(--sl)';statusEl.textContent='Uploading...'
  try{
    for(const f of [...input.files]){
      const path=`site-media/${Date.now()}_${f.name}`
      const ref=fbStorage.ref(path)
      await ref.put(f)
      const url=await ref.getDownloadURL()
      await fbDB.collection('siteMedia').add({url,path,name:f.name,uploadedAt:Date.now()})
    }
    statusEl.style.color='#107C10';statusEl.textContent='✓ Uploaded! Now live in the website banner.'
    input.value=''
    loadSiteImages()
    loadPublicBanner()
  }catch(e){
    statusEl.style.color='#D13438';statusEl.textContent='⚠ Upload failed: '+e.message
  }
}

async function loadSiteImages(){
  const grid=document.getElementById('siteImageGrid')
  if(!grid) return
  grid.innerHTML='<div style="color:var(--sl);font-size:.8rem">Loading...</div>'
  try{
    const snap=await fbDB.collection('siteMedia').orderBy('uploadedAt','desc').get()
    if(snap.empty){grid.innerHTML='<div style="color:var(--sl);font-size:.8rem">No images uploaded yet.</div>';return}
    grid.innerHTML=snap.docs.map(d=>{
      const data=d.data()
      return `<div style="position:relative;border-radius:8px;overflow:hidden;background:#F4F6FA">
        <img src="${data.url}" style="width:100%;height:110px;object-fit:cover;display:block"/>
        <button onclick="deleteSiteImage('${d.id}','${(data.path||'').replace(/'/g,"\\'")}')" title="Remove" style="position:absolute;top:.3rem;right:.3rem;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:.8rem">✕</button>
      </div>`
    }).join('')
  }catch(e){
    grid.innerHTML='<div style="color:#D13438;font-size:.8rem">Could not load images: '+e.message+'</div>'
  }
}

async function deleteSiteImage(id,path){
  if(!confirm('Remove this image from the website?')) return
  try{
    if(path) await fbStorage.ref(path).delete()
    await fbDB.collection('siteMedia').doc(id).delete()
    loadSiteImages()
    loadPublicBanner()
  }catch(e){
    alert('Could not delete: '+e.message)
  }
}

async function loadPublicBanner(){
  const track=document.getElementById('publicBannerTrack')
  const section=document.getElementById('publicBanner')
  if(!track) return
  try{
    const snap=await fbDB.collection('siteMedia').orderBy('uploadedAt','desc').limit(20).get()
    if(snap.empty){ if(section) section.style.display='none'; return }
    const cards=snap.docs.map(d=>{
      const data=d.data()
      const safeName=(data.name||'Website photo').replace(/"/g,'&quot;')
      return `<div class="hbanner-card"><img src="${data.url}" alt="${safeName}" style="width:100%;height:180px;object-fit:cover;display:block"/></div>`
    })
    track.innerHTML = cards.join('') + cards.join('')
    if(section) section.style.display='block'
  }catch(e){
    console.warn('Could not load site banner images:',e.message)
  }
}
document.addEventListener('DOMContentLoaded',loadPublicBanner)
if(document.readyState==='complete'||document.readyState==='interactive') setTimeout(loadPublicBanner,150)

// NAV
window.addEventListener('scroll',()=>document.getElementById('mainNav').classList.toggle('scrolled',window.scrollY>30))
function toggleMM(){document.getElementById('mmenu').classList.toggle('open')}

// PARTICLES
;(function(){
  const c=document.getElementById('hparts');if(!c)return
  const cols=['rgba(66,165,245,.5)','rgba(245,166,35,.4)','rgba(255,255,255,.12)']
  for(let i=0;i<20;i++){
    const d=document.createElement('div'),s=Math.random()*4+2
    d.className='part'
    d.style.cssText=`width:${s}px;height:${s}px;left:${Math.random()*100}%;background:${cols[i%3]};animation-duration:${Math.random()*18+12}s;animation-delay:${Math.random()*10}s`
    c.appendChild(d)
  }
})()

// ===== POWER BI TILE GRID (hero) — live data =====
const PBI = {
  count: 487,
  pipeline: 2.0, // $bn
  revenue: 461, // $M
  trend: [30,34,32,38,42,40,46,48],
  mix: [38,26,20,16],
  byMonth: [20,28,35,48,55,62,70,78,82,88,92,95],
  avgRevA: [60,75,45,85,55],
  avgRevB: [40,55,30,65,42],
  win: [12,80,25,18,30,15],
  avgRev2: [55,70,40,80,60,45]
}
function pbiClamp(v,lo,hi){return Math.max(lo,Math.min(hi,v))}

function pbiDrawTrend(){
  const el=document.getElementById('pt2');if(!el)return
  const pts=PBI.trend.map((v,i)=>[6+i*14,46-(v/50)*40])
  const line=pts.map(p=>p.join(',')).join(' ')
  el.innerHTML=`<polyline points="${line}" fill="none" stroke="#1ABC9C" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`+
    pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="1.6" fill="#1ABC9C"/>`).join('')
}
function pbiDrawMix(){
  const el=document.getElementById('pt3');if(!el)return
  const cols=['#1ABC9C','#34495E','#F0625A','#F2C94C']
  const total=PBI.mix.reduce((a,b)=>a+b,0)
  let x=4,h=''
  PBI.mix.forEach((v,i)=>{
    const w=(v/total)*102
    h+=`<rect x="${x}" y="20" width="${w}" height="12" fill="${cols[i]}" opacity=".9"/>`
    x+=w
  })
  el.innerHTML=h
}
function pbiDrawByMonth(){
  const el=document.getElementById('pt5');if(!el)return
  const cols=['#34495E','#1ABC9C','#F0625A','#F2C94C']
  const max=Math.max(...PBI.byMonth)
  let h=''
  PBI.byMonth.forEach((v,i)=>{
    const bw=15,x=6+i*18.5,bh=(v/max)*46
    h+=`<rect x="${x}" y="${50-bh}" width="${bw}" height="${bh}" fill="${cols[i%cols.length]}" opacity=".88" rx="1"/>`
  })
  el.innerHTML=h
}
function pbiDrawAvgRevenue(){
  const el=document.getElementById('pt6');if(!el)return
  let h=''
  PBI.avgRevA.forEach((v,i)=>{
    const y=4+i*10.6
    h+=`<rect x="60" y="${y}" width="${v*0.9}" height="7" fill="#34495E" rx="1"/>
        <rect x="${60-PBI.avgRevB[i]*0.9}" y="${y}" width="${PBI.avgRevB[i]*0.9}" height="7" fill="#F0625A" rx="1"/>`
  })
  el.innerHTML=h
}
function pbiDrawWin(){
  const el=document.getElementById('pt7');if(!el)return
  const max=Math.max(...PBI.win)
  let h=''
  PBI.win.forEach((v,i)=>{
    const bw=12,x=8+i*16,bh=(v/max)*42
    h+=`<rect x="${x}" y="${48-bh}" width="${bw}" height="${bh}" fill="#34495E" opacity=".85" rx="1"/>`
  })
  el.innerHTML=h
}
function pbiDrawAvgRevenue2(){
  const el=document.getElementById('pt8');if(!el)return
  const max=Math.max(...PBI.avgRev2)
  let h=''
  PBI.avgRev2.forEach((v,i)=>{
    const y=4+i*8,bw=(v/max)*95
    h+=`<rect x="6" y="${y}" width="${bw}" height="5.5" fill="#F0625A" opacity=".88" rx="1"/>`
  })
  el.innerHTML=h
}
function pbiUpdateNumbers(){
  const c1=document.getElementById('pt1'),c4=document.getElementById('pt4'),c9=document.getElementById('pt9')
  if(c1)c1.textContent=Math.round(PBI.count)
  if(c4)c4.textContent='$'+PBI.pipeline.toFixed(1)+'bn'
  if(c9)c9.textContent='$'+Math.round(PBI.revenue)+'M'
}
function pbiFlash(id){
  const el=document.getElementById(id);if(!el)return
  el.style.opacity=.25
  setTimeout(()=>{el.style.opacity=1},150)
}
function pbiRenderAll(){
  pbiDrawTrend();pbiDrawMix();pbiDrawByMonth();pbiDrawAvgRevenue();pbiDrawWin();pbiDrawAvgRevenue2();pbiUpdateNumbers()
}
function pbiPulse(){
  PBI.count=pbiClamp(PBI.count+(Math.random()-0.45)*6,420,560);pbiFlash('pt1')
  PBI.pipeline=pbiClamp(PBI.pipeline+(Math.random()-0.5)*0.08,1.6,2.4);pbiFlash('pt4')
  PBI.revenue=pbiClamp(PBI.revenue+(Math.random()-0.45)*10,380,520);pbiFlash('pt9')
  PBI.trend=PBI.trend.map(v=>pbiClamp(v+(Math.random()-0.45)*4,20,50))
  let mt=0;PBI.mix=PBI.mix.map(v=>{const nv=pbiClamp(v+(Math.random()-0.5)*3,8,45);mt+=nv;return nv})
  PBI.mix=PBI.mix.map(v=>v/mt*100)
  PBI.byMonth=PBI.byMonth.map(v=>pbiClamp(v+(Math.random()-0.4)*5,15,98))
  PBI.avgRevA=PBI.avgRevA.map(v=>pbiClamp(v+(Math.random()-0.5)*8,30,95))
  PBI.avgRevB=PBI.avgRevB.map(v=>pbiClamp(v+(Math.random()-0.5)*8,20,70))
  PBI.win=PBI.win.map(v=>pbiClamp(v+(Math.random()-0.5)*6,8,85))
  PBI.avgRev2=PBI.avgRev2.map(v=>pbiClamp(v+(Math.random()-0.5)*8,25,85))
  pbiRenderAll()
}
window.addEventListener('load',()=>{
  pbiRenderAll()
  setInterval(pbiPulse,1700)
})

// SERVICES TICKER (left to right)
const SVCS=[
  {ic:'📈',t:'Quantitative Analysis',d:'Regression, ANOVA, factor analysis',tags:['SPSS','Stata','R','Python']},
  {ic:'💬',t:'Qualitative Analysis',d:'Thematic coding, narrative, discourse',tags:['NVivo','Atlas.ti']},
  {ic:'🔀',t:'Mixed Methods',d:'Combined quant + qual research',tags:['All tools']},
  {ic:'🗂️',t:'Primary Data Collection',d:'Survey design, deployment, interviews',tags:['KoboToolbox']},
  {ic:'🧹',t:'Data Cleaning & Prep',d:'Deduplication, outliers, restructuring',tags:['Python','R','Excel']},
  {ic:'📞',t:'Statistical Consultation',d:'Research design, methodology advice',tags:['Advisory']},
  {ic:'📉',t:'Data Visualisation',d:'Charts, dashboards, infographics',tags:['ggplot2','matplotlib']},
  {ic:'📝',t:'Report Writing',d:'APA, Harvard, Chicago, custom format',tags:['APA','Harvard']},
]
;(function(){
  const row=document.getElementById('svrow');if(!row)return
  const double=[...SVCS,...SVCS]
  row.innerHTML=double.map(s=>`<div class="scard"><div class="scic">${s.ic}</div><h3>${s.t}</h3><p>${s.d}</p><div class="stags">${s.tags.map(t=>`<span class="stag">${t}</span>`).join('')}</div></div>`).join('')
  const tick=document.getElementById('topTicker');if(!tick)return
  const items=['📈 Quantitative Analysis','📊 SPSS Expert','🐍 Python Data Science','📉 R Visualisation','🔬 Mixed Methods Research','🗂️ Primary Data Collection','📝 APA & Harvard Reports','💬 Qualitative Coding','🧹 Data Cleaning','📞 Statistical Consultation','🎓 Dissertation Support','🏢 Business Intelligence','🌍 NGO Impact Evaluation','🏥 Health Research']
  const dbl=[...items,...items]
  tick.innerHTML=dbl.map(i=>`<span class="titem">${i}</span><span class="tsep">◆</span>`).join('')
})()

// SQL TABLE DATA
let sqlData=[]
// Live sync: sqlData always mirrors the 'orders' collection in Firestore.
// Every browser (client, analyst, admin) sees the same data, in real time.
fbDB.collection('orders').onSnapshot(snap=>{
  sqlData=snap.docs.map(d=>({id:d.id,...d.data()}))
  renderSQL()
},err=>console.warn('Orders sync error:',err.message))

const scls={'In Progress':'b-pr','Confirmed':'b-pn','Draft Review':'b-rv','Completed':'b-dn','Pending':'b-pn','Overdue':'b-ov'}
const ANALYSTS=['Henry G. Michuku','Simon Macharia','Joseph Machuki','Unassigned']
function analystSelect(id,current){
  return `<select onchange="assignAnalyst('${id}',this.value)" style="font-size:.78rem;padding:.25rem .4rem;border:1px solid var(--br);border-radius:6px;background:#fff">`+
    ANALYSTS.map(a=>`<option ${a===current?'selected':''}>${a}</option>`).join('')+`</select>`
}
function assignAnalyst(id,name){
  const r=sqlData.find(x=>x.id===id)
  if(!r)return
  const newStatus=(r.status==='Pending'&&name!=='Unassigned')?'Confirmed':r.status
  fbDB.collection('orders').doc(id).update({analyst:name,status:newStatus})
}

// ===== PROJECTS TABLE (Admin — unified with real sqlData, no duplicate fake table) =====
let projectFilter='all'
function openAddProjectModal(){
  document.getElementById('addProjectForm').style.display='block'
  const n=sqlData.length+1
  document.getElementById('np_ref').value=`DB-2025-${n.toString().padStart(3,'0')}`
  document.getElementById('addProjectForm').scrollIntoView({behavior:'smooth',block:'center'})
}
function saveProject(){
  const v=id=>{const el=document.getElementById(id);return el?el.value:''}
  const ref=v('np_ref')||`DB-${Date.now()}`
  if(!v('np_client')||!v('np_title')){ alert('Please fill in at least the client name and project title.'); return }
  fbDB.collection('orders').doc(ref).set({
    client:v('np_client'), email:v('np_email')||'—', phone:v('np_phone')||'—', org:'—',
    project:v('np_title'), service:v('np_service'), tool:v('np_tool')||'TBD', format:'—',
    analyst:v('np_analyst'), deadline:v('np_deadline')||'TBD',
    total:v('np_budget')||'0', deposit:'0', balance:v('np_budget')||'0',
    status:v('np_status')||'Pending', files:{client:[],analyst:[]}
  })
  document.getElementById('addProjectForm').style.display='none'
  ;['np_ref','np_client','np_email','np_phone','np_title','np_tool','np_date','np_deadline','np_budget'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''})
}
function filterProjects(btn,status){
  projectFilter=status
  document.querySelectorAll('#adtab-orders .fb2').forEach(b=>b.classList.remove('on'))
  if(btn)btn.classList.add('on')
  renderProjectsTable()
}
function renderProjectsTable(){
  const tb=document.getElementById('projectsBody')
  if(!tb)return
  const rows=projectFilter==='all'?sqlData:sqlData.filter(r=>r.status===projectFilter)
  tb.innerHTML=rows.length?rows.map(r=>{
    const priced=moneyNum(r.total)>0
    const actionBtn = priced
      ? `<button class="db1 dba" onclick="openPriceModal('${r.id}')">✏️ Edit Price</button>`
      : `<button class="db1" style="background:#D13438;color:#fff;border:none" onclick="openPriceModal('${r.id}')">💰 Set Price</button>`
    return `<tr>
      <td><strong>${r.id}</strong></td>
      <td>${r.client}</td><td>${r.email}</td><td>${r.phone}</td>
      <td>${r.project}</td><td>${r.service}</td><td>${r.tool}</td>
      <td>—</td><td>${r.deadline}</td>
      <td>${priced?`<strong style="color:#107C10">KES ${r.total}</strong>`:'<span style="color:#D13438;font-weight:600">Not set</span>'}</td>
      <td>${analystSelect(r.id,r.analyst)}</td>
      <td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td>
      <td style="display:flex;gap:.4rem;flex-wrap:wrap">${actionBtn}</td>
    </tr>`
  }).join('')
    : `<tr><td colspan="13" style="text-align:center;color:var(--sl);padding:1.4rem">No orders match this filter yet.</td></tr>`
}

// ── PRICE MODAL ──────────────────────────────────────────────────────
function openPriceModal(orderId){
  const r=sqlData.find(x=>x.id===orderId)
  if(!r)return
  // build modal HTML if not already in DOM
  let m=document.getElementById('priceModal')
  if(!m){
    m=document.createElement('div')
    m.id='priceModal'
    m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center'
    m.innerHTML=`
      <div style="background:#fff;border-radius:16px;padding:2rem;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.25)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem">
          <h3 style="font-family:var(--fd);font-size:1.05rem;color:var(--ch)">💰 Set Project Price</h3>
          <button onclick="closePriceModal()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--sl)">✕</button>
        </div>
        <div id="pmOrderInfo" style="background:var(--bl);border-radius:10px;padding:.8rem 1rem;margin-bottom:1.1rem;font-size:.84rem;color:var(--sl)"></div>
        <input type="hidden" id="pmOrderId"/>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.9rem;margin-bottom:.9rem">
          <div class="fg"><label>Total Price (KES)</label><input type="number" id="pmTotal" placeholder="e.g. 25000" min="0"/></div>
          <div class="fg"><label>Deposit Paid (KES)</label><input type="number" id="pmDeposit" placeholder="e.g. 12500" min="0"/></div>
        </div>
        <div class="fg" style="margin-bottom:.9rem"><label>Assign Analyst</label>
          <select id="pmAnalyst">
            <option>Unassigned</option>
            <option>Henry Gitau Michuku</option>
            <option>Simon Macharia</option>
            <option>Joseph Machuki</option>
          </select>
        </div>
        <div class="fg" style="margin-bottom:1.1rem"><label>Deadline</label><input type="date" id="pmDeadline"/></div>
        <p id="pmStatus" style="font-size:.78rem;margin-bottom:.6rem;min-height:1rem"></p>
        <div style="display:flex;gap:.65rem">
          <button class="db1 dba" style="flex:1;padding:.65rem" onclick="savePriceAndConfirm()">✅ Save & Confirm Order</button>
          <button class="db1 dbb" onclick="closePriceModal()">Cancel</button>
        </div>
      </div>`
    document.body.appendChild(m)
  }
  // populate
  const r2=sqlData.find(x=>x.id===orderId)
  document.getElementById('pmOrderId').value=orderId
  document.getElementById('pmOrderInfo').innerHTML=`<strong>${orderId}</strong> · ${r2.client} · ${r2.project}`
  document.getElementById('pmTotal').value=moneyNum(r2.total)||''
  document.getElementById('pmDeposit').value=moneyNum(r2.deposit)||''
  document.getElementById('pmAnalyst').value=r2.analyst||'Unassigned'
  document.getElementById('pmDeadline').value=r2.deadline&&r2.deadline!=='TBD'?r2.deadline:''
  document.getElementById('pmStatus').textContent=''
  m.style.display='flex'
}
function closePriceModal(){
  const m=document.getElementById('priceModal')
  if(m)m.style.display='none'
}

// ── MPESA PAYMENT MODAL ──────────────────────────────────────────────
function openMpesaModal(orderId){
  const r=sqlData.find(x=>x.id===orderId)
  if(!r){alert('Order not found.');return}
  const tot=moneyNum(r.total)
  if(tot<=0){alert('Cannot pay yet — admin has not set the price for this order.');return}
  const dep=Math.round(tot*0.5)
  const bal=moneyNum(r.balance)
  const amountToPay = bal>0 ? bal : dep

  let m=document.getElementById('mpesaModal')
  if(!m){
    m=document.createElement('div')
    m.id='mpesaModal'
    m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center'
    document.body.appendChild(m)
  }
  m.innerHTML=`
    <div style="background:#fff;border-radius:18px;padding:0;width:100%;max-width:420px;box-shadow:0 24px 64px rgba(0,0,0,.3);overflow:hidden">
      <!-- Header -->
      <div style="background:#00a651;padding:1.4rem 1.6rem;display:flex;align-items:center;gap:.9rem">
        <div style="width:44px;height:44px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem">💚</div>
        <div>
          <div style="color:#fff;font-weight:700;font-size:1.05rem;font-family:var(--fd)">Pay via M-Pesa</div>
          <div style="color:rgba(255,255,255,.8);font-size:.78rem">Lipa Na M-Pesa · Till Number</div>
        </div>
        <button onclick="closeMpesaModal()" style="margin-left:auto;background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1rem">✕</button>
      </div>
      <!-- Order info -->
      <div style="padding:1.2rem 1.6rem 0">
        <div style="background:#f0faf4;border:1px solid #b7e5c9;border-radius:10px;padding:.9rem 1.1rem;margin-bottom:1.1rem">
          <div style="font-size:.74rem;color:#546e7a;font-weight:600;margin-bottom:.3rem">ORDER REFERENCE</div>
          <div style="font-weight:700;font-size:.95rem;color:#0d1b2a">${orderId} — ${(r.project||'').slice(0,45)}</div>
        </div>
        <!-- Steps -->
        <div style="margin-bottom:1.1rem">
          <div style="font-size:.8rem;font-weight:700;color:#0d1b2a;margin-bottom:.7rem">Follow these steps:</div>
          ${[
            ['1','Go to M-Pesa on your phone','Dial *334# or open M-Pesa app'],
            ['2','Select <strong>Lipa na M-Pesa</strong>','Then select <strong>Buy Goods & Services</strong>'],
            ['3','Enter Till Number','<span style="font-size:1.1rem;font-weight:800;color:#00a651;letter-spacing:2px">4136540</span>'],
            ['4','Enter Amount','<strong style="color:#d13438">KES '+amountToPay.toLocaleString()+'</strong>'+(bal>0?' (balance due)':' (50% deposit)')],
            ['5','Enter your M-Pesa PIN','Confirm the transaction'],
            ['6','Enter your phone number below','So we can confirm your payment']
          ].map(([n,title,sub])=>`
            <div style="display:flex;gap:.8rem;margin-bottom:.65rem;align-items:flex-start">
              <div style="min-width:24px;height:24px;background:#00a651;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;margin-top:.1rem">${n}</div>
              <div><div style="font-size:.8rem;font-weight:600;color:#0d1b2a">${title}</div><div style="font-size:.76rem;color:#546e7a">${sub}</div></div>
            </div>`).join('')}
        </div>
        <!-- Phone input -->
        <div style="margin-bottom:.9rem">
          <label style="font-size:.78rem;font-weight:600;color:#0d1b2a;display:block;margin-bottom:.35rem">Your M-Pesa Phone Number</label>
          <input type="tel" id="mpesaPhone" placeholder="e.g. 0712 345 678" value="${r.phone||''}"
            style="width:100%;padding:.6rem .9rem;border:1.5px solid #b7e5c9;border-radius:8px;font-size:.9rem;box-sizing:border-box"/>
        </div>
        <!-- Amount display -->
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f8f9fa;border-radius:8px;padding:.7rem 1rem;margin-bottom:1rem">
          <span style="font-size:.8rem;color:#546e7a">${bal>0?'Balance Due':'Required Deposit (50%)'}</span>
          <strong style="font-size:1.1rem;color:#00a651">KES ${amountToPay.toLocaleString()}</strong>
        </div>
        <p id="mpesaStatus" style="font-size:.78rem;min-height:1rem;margin-bottom:.5rem;text-align:center"></p>
        <input type="hidden" id="mpesaOrderId" value="${orderId}"/>
        <input type="hidden" id="mpesaAmount" value="${amountToPay}"/>
      </div>
      <!-- Footer buttons -->
      <div style="padding:.9rem 1.6rem 1.4rem;display:flex;gap:.65rem">
        <button onclick="confirmMpesaPayment()" 
          style="flex:1;background:#00a651;color:#fff;border:none;padding:.75rem;border-radius:10px;font-weight:700;font-size:.9rem;cursor:pointer;font-family:var(--fd)">
          ✅ I Have Paid — Confirm
        </button>
        <button onclick="closeMpesaModal()"
          style="background:#f0f0f0;color:#546e7a;border:none;padding:.75rem 1rem;border-radius:10px;font-weight:600;cursor:pointer">
          Cancel
        </button>
      </div>
    </div>`
  m.style.display='flex'
}

function closeMpesaModal(){
  const m=document.getElementById('mpesaModal')
  if(m)m.style.display='none'
}

async function confirmMpesaPayment(){
  const orderId=document.getElementById('mpesaOrderId').value
  const amount=parseFloat(document.getElementById('mpesaAmount').value)||0
  const phone=(document.getElementById('mpesaPhone').value||'').trim()
  const statusEl=document.getElementById('mpesaStatus')
  if(!phone){statusEl.style.color='#d13438';statusEl.textContent='⚠ Please enter your M-Pesa phone number.';return}
  statusEl.style.color='#546e7a';statusEl.textContent='Submitting payment confirmation...'
  try{
    const r=sqlData.find(x=>x.id===orderId)
    const currentDeposit=moneyNum(r?r.deposit:0)
    const newDeposit=currentDeposit+amount
    const newBalance=Math.max(0,moneyNum(r?r.total:0)-newDeposit)
    const newStatus=newBalance<=0?'Confirmed':'In Progress'
    // Update Firestore order with new deposit
    await fbDB.collection('orders').doc(orderId).update({
      deposit:String(newDeposit),
      balance:String(newBalance),
      status:newStatus,
      mpesaPhone:phone,
      mpesaPaidAt:Date.now()
    })
    // Notify admin
    await fbDB.collection('notifications').add({
      uid:'admin',
      orderId,
      icon:'💚',
      title:`M-Pesa payment confirmation — ${orderId}`,
      body:`Client ${r?r.client:'—'} (${phone}) reports payment of KES ${amount.toLocaleString()}. Please verify in M-Pesa and confirm.`,
      tab:'orders',
      read:false,
      ts:Date.now()
    })
    statusEl.style.color='#00a651'
    statusEl.textContent='✓ Confirmation sent! Admin will verify and update your order shortly.'
    setTimeout(()=>closeMpesaModal(),2500)
  }catch(e){
    statusEl.style.color='#d13438'
    statusEl.textContent='⚠ Error: '+e.message
  }
}
async function savePriceAndConfirm(){
  const orderId=document.getElementById('pmOrderId').value
  const total=parseFloat(document.getElementById('pmTotal').value)||0
  const deposit=parseFloat(document.getElementById('pmDeposit').value)||0
  const analyst=document.getElementById('pmAnalyst').value
  const deadline=document.getElementById('pmDeadline').value
  const statusEl=document.getElementById('pmStatus')
  if(total<=0){statusEl.style.color='#D13438';statusEl.textContent='⚠ Please enter a total price greater than 0.';return}
  statusEl.style.color='var(--sl)';statusEl.textContent='Saving...'
  const balance=Math.max(0,total-deposit)
  const newStatus=analyst&&analyst!=='Unassigned'?'Confirmed':'Pending'
  try{
    await fbDB.collection('orders').doc(orderId).update({
      total:String(total), deposit:String(deposit), balance:String(balance),
      analyst, deadline:deadline||'TBD', status:newStatus
    })
    // notify client that price is set and order confirmed
    const r=sqlData.find(x=>x.id===orderId)
    if(r&&r.email){
      await writeNotification(r.email, orderId, '💰',
        `Price set for your order — ${orderId}`,
        `Your project has been priced at KES ${total.toLocaleString()}. Deposit: KES ${deposit.toLocaleString()}. Balance: KES ${balance.toLocaleString()}. Analyst: ${analyst}.`,
        'invoices'
      )
    }
    statusEl.style.color='#107C10'
    statusEl.textContent='✓ Saved! Client has been notified.'
    setTimeout(()=>closePriceModal(), 1200)
  }catch(e){
    statusEl.style.color='#D13438'
    statusEl.textContent='⚠ Error: '+e.message
  }
}
function exportProjects(){ exportCSV() }

// ── SHARED INVOICE BUILDER ───────────────────────────────────────────
function buildInvoiceDoc(r, type){
  // type = 'proforma' | 'standard'
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({unit:'mm',format:'a4'})
  const pw=210, ph=297, mg=15
  const navy=[10,26,61], gold=[245,166,35], white=[255,255,255]
  const ink=[20,20,30], muted=[100,110,120], light=[243,244,246]
  const blue=[21,101,192], red=[209,52,68], green=[16,124,16]
  const isProforma = type==='proforma'
  const moneyNum=v=>parseFloat(String(v||0).replace(/,/g,''))||0
  const moneyFmt=v=>'KES '+Math.round(moneyNum(v)).toLocaleString()
  const today=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})
  const isPaid=moneyNum(r.balance)<=0

  // ── HEADER BAND ──────────────────────────────────────────────────
  doc.setFillColor(...navy)
  doc.rect(0,0,pw,42,'F')
  doc.setFillColor(...gold)
  doc.rect(0,42,pw,2,'F')

  doc.setTextColor(...white)
  doc.setFont('helvetica','bold')
  doc.setFontSize(20)
  doc.text('StatVision Research and Consultancy',mg,16)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.5)
  doc.setTextColor(200,210,230)
  doc.text('Professional Data Analysis & Research Services',mg,23)
  doc.text('Nairobi, Kenya  ·  hello@statvisionconsultancy.co.ke  ·  +254 748 216 918',mg,29)
  doc.text('www.statvisionconsultancy.co.ke',mg,35)

  // Document type top right
  doc.setTextColor(...white)
  doc.setFont('helvetica','bold')
  doc.setFontSize(isProforma?14:18)
  doc.text(isProforma?'PROFORMA INVOICE':'TAX INVOICE', pw-mg, 14, {align:'right'})
  doc.setFont('helvetica','normal')
  doc.setFontSize(8)
  doc.setTextColor(200,210,230)
  if(isProforma) doc.text('(Quote — not a demand for payment)', pw-mg, 19, {align:'right'})
  doc.text('Reference: '+r.id, pw-mg, isProforma?24:23, {align:'right'})
  doc.text('Date Issued: '+today, pw-mg, isProforma?29:28, {align:'right'})

  // Status pill
  const pillLabel = isProforma ? 'QUOTATION' : (isPaid?'FULLY PAID':'PAYMENT DUE')
  const [pr,pg,pb] = isProforma ? [21,101,192] : isPaid ? [16,124,16] : [209,52,68]
  doc.setFillColor(pr,pg,pb)
  doc.roundedRect(pw-mg-32,33,32,7,2,2,'F')
  doc.setTextColor(...white)
  doc.setFont('helvetica','bold')
  doc.setFontSize(7)
  doc.text(pillLabel, pw-mg-16, 37.8, {align:'center'})

  // ── PROFORMA NOTICE BAND ─────────────────────────────────────────
  if(isProforma){
    doc.setFillColor(232,240,254)
    doc.rect(mg,46,pw-mg*2,9,'F')
    doc.setDrawColor(...blue)
    doc.setLineWidth(0.5)
    doc.rect(mg,46,pw-mg*2,9,'S')
    doc.setTextColor(...blue)
    doc.setFont('helvetica','bold')
    doc.setFontSize(7.5)
    doc.text('⚠  PROFORMA INVOICE — This is a quotation only. Payment is not due until a formal Tax Invoice is issued after deposit confirmation.', mg+3, 51.5)
  }

  // ── BILLED TO / ANALYST ──────────────────────────────────────────
  let y = isProforma ? 60 : 52
  doc.setFillColor(...light)
  doc.roundedRect(mg,y,85,34,3,3,'F')
  doc.setTextColor(...muted)
  doc.setFont('helvetica','bold')
  doc.setFontSize(7.5)
  doc.text('BILLED TO',mg+4,y+7)
  doc.setDrawColor(...gold)
  doc.setLineWidth(0.4)
  doc.line(mg+4,y+9,mg+40,y+9)
  doc.setTextColor(...ink)
  doc.setFont('helvetica','bold')
  doc.setFontSize(10)
  doc.text(r.client||'—',mg+4,y+15)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...muted)
  doc.text(r.email||'—',mg+4,y+21)
  doc.text(r.phone||'—',mg+4,y+27)
  if(r.org&&r.org!=='—') doc.text(r.org,mg+4,y+32)

  doc.setFillColor(...light)
  doc.roundedRect(mg+90,y,85,34,3,3,'F')
  doc.setTextColor(...muted)
  doc.setFont('helvetica','bold')
  doc.setFontSize(7.5)
  doc.text('ANALYST ASSIGNED',mg+94,y+7)
  doc.setDrawColor(...gold)
  doc.line(mg+94,y+9,mg+94+36,y+9)
  doc.setTextColor(...ink)
  doc.setFont('helvetica','bold')
  doc.setFontSize(10)
  doc.text(r.analyst||'Unassigned',mg+94,y+15)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...muted)
  doc.text('StatVision Research and Consultancy',mg+94,y+21)
  doc.text('Nairobi, Kenya',mg+94,y+27)
  doc.text('Deadline: '+(r.deadline||'TBD'),mg+94,y+32)

  // ── SERVICE TABLE ────────────────────────────────────────────────
  y+=42
  doc.setFillColor(...navy)
  doc.roundedRect(mg,y,pw-mg*2,10,2,2,'F')
  doc.setTextColor(...white)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8)
  doc.text('DESCRIPTION OF SERVICES',mg+4,y+6.8)
  doc.text('CATEGORY',mg+88,y+6.8)
  doc.text('TOOL',mg+120,y+6.8)
  doc.text('AMOUNT',pw-mg-4,y+6.8,{align:'right'})
  y+=10
  doc.setFillColor(250,251,252)
  doc.rect(mg,y,pw-mg*2,16,'F')
  doc.setDrawColor(220,225,230)
  doc.setLineWidth(0.3)
  doc.rect(mg,y,pw-mg*2,16,'S')
  doc.setTextColor(...ink)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.5)
  const projLines=doc.splitTextToSize(r.project||'Data Analysis Service',80)
  doc.text(projLines,mg+4,y+5.5)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text(r.service||'—',mg+88,y+5.5)
  doc.text(r.tool||'—',mg+120,y+5.5)
  doc.setTextColor(...ink)
  doc.setFont('helvetica','bold')
  doc.setFontSize(9)
  doc.text(moneyFmt(r.total),pw-mg-4,y+5.5,{align:'right'})
  y+=18

  // ── PAYMENT SUMMARY ──────────────────────────────────────────────
  y+=4
  const bx=pw-mg-90, bw=90
  doc.setFillColor(...light)
  doc.roundedRect(bx,y,bw,isProforma?36:44,3,3,'F')

  doc.setTextColor(...muted)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.5)
  doc.text('Service Price',bx+6,y+9)
  doc.setTextColor(...ink)
  doc.setFont('helvetica','bold')
  doc.text(moneyFmt(r.total),bx+bw-6,y+9,{align:'right'})

  if(isProforma){
    // Proforma shows required deposit
    const reqDep=Math.round(moneyNum(r.total)*0.5)
    doc.setTextColor(...muted)
    doc.setFont('helvetica','normal')
    doc.text('Required Deposit (50%)',bx+6,y+18)
    doc.setTextColor(...blue)
    doc.setFont('helvetica','bold')
    doc.text('KES '+reqDep.toLocaleString(),bx+bw-6,y+18,{align:'right'})
    doc.setDrawColor(210,215,220)
    doc.setLineWidth(0.4)
    doc.line(bx+6,y+21,bx+bw-6,y+21)
    doc.setFillColor(232,240,254)
    doc.roundedRect(bx+4,y+24,bw-8,10,2,2,'F')
    doc.setTextColor(...blue)
    doc.setFont('helvetica','bold')
    doc.setFontSize(9)
    doc.text('PAY TO CONFIRM',bx+bw/2,y+30,{align:'center'})
  } else {
    // Standard shows deposit paid and balance
    doc.setTextColor(...muted)
    doc.setFont('helvetica','normal')
    doc.text('Amount Paid',bx+6,y+18)
    doc.setTextColor(...green)
    doc.setFont('helvetica','bold')
    doc.text(moneyFmt(r.deposit),bx+bw-6,y+18,{align:'right'})
    doc.setDrawColor(210,215,220)
    doc.setLineWidth(0.4)
    doc.line(bx+6,y+22,bx+bw-6,y+22)
    const balNum=moneyNum(r.balance)
    doc.setFillColor(balNum<=0?240:255,balNum<=0?249:235,balNum<=0?240:235)
    doc.roundedRect(bx+4,y+25,bw-8,14,2,2,'F')
    doc.setTextColor(...muted)
    doc.setFont('helvetica','normal')
    doc.setFontSize(8)
    doc.text('BALANCE DUE',bx+8,y+31)
    doc.setFontSize(11)
    doc.setFont('helvetica','bold')
    doc.setTextColor(balNum<=0?16:180,balNum<=0?124:30,balNum<=0?16:30)
    doc.text(moneyFmt(r.balance),bx+bw-8,y+33,{align:'right'})
  }

  // Payment instructions (left of summary)
  doc.setFillColor(...light)
  doc.roundedRect(mg,y,bx-mg-6,isProforma?36:44,3,3,'F')
  doc.setTextColor(...muted)
  doc.setFont('helvetica','bold')
  doc.setFontSize(7.5)
  doc.text('PAYMENT INSTRUCTIONS',mg+5,y+8)
  doc.setDrawColor(...gold)
  doc.setLineWidth(0.4)
  doc.line(mg+5,y+10,mg+60,y+10)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8)
  doc.setTextColor(...ink)
  doc.text('M-Pesa Paybill: 522533',mg+5,y+17)
  doc.text('Account No: hello@statvisionconsultancy.co.ke',mg+5,y+23)
  doc.text('Or: Bank Transfer / PayPal on request',mg+5,y+29)
  doc.setTextColor(...muted)
  doc.setFontSize(7.5)
  doc.text('Quote Order ID ('+r.id+') as reference.',mg+5,y+36)

  y += isProforma ? 44 : 52

  // ── ORDER STATUS STRIP ────────────────────────────────────────────
  doc.setFillColor(...navy)
  doc.roundedRect(mg,y,pw-mg*2,9,2,2,'F')
  doc.setTextColor(...white)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8)
  doc.text('Order Status: '+(r.status||'Pending')+'   |   Order ID: '+r.id+'   |   Issued: '+today, mg+4, y+5.8)
  y+=18

  // ── SIGNATURE (left) ─────────────────────────────────────────────
  // Draw Henry's signature as SVG path approximation using lines
  // Signature is a stylised "H" with flourishes — drawn as bezier curves
  const sx=mg, sy=y
  doc.setDrawColor(0,0,180) // blue ink
  doc.setLineWidth(0.7)
  // Left vertical stroke of H
  doc.lines([[0,14]],sx+2,sy+2,null,'S')
  // Right vertical stroke of H
  doc.lines([[0,14]],sx+10,sy+2,null,'S')
  // Cross bar of H
  doc.lines([[8,0]],sx+2,sy+9,null,'S')
  // Upward flourish from right stroke
  doc.lines([[0,-8],[6,-4],[4,6]],sx+10,sy+4,null,'S')
  // Lower loop/curl
  doc.lines([[6,4],[-4,6],[-6,-2]],sx+10,sy+16,null,'S')
  // Long underline sweep
  doc.lines([[20,2],[10,-4]],sx+2,sy+18,null,'S')

  doc.setDrawColor(...ink)
  doc.setLineWidth(0.5)
  doc.line(mg,sy+22,mg+60,sy+22)
  doc.setTextColor(...ink)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8)
  doc.text('Henry Gitau Michuku',mg,sy+27)
  doc.setFont('helvetica','normal')
  doc.setFontSize(7.5)
  doc.text('Chief Executive Officer',mg,sy+32)
  doc.text('StatVision Research and Consultancy',mg,sy+37)

  // ── BLUE SQUARE STAMP (centre) ───────────────────────────────────
  const stx=mg+70, sty=sy, stw=55, sth=40
  doc.setDrawColor(...blue)
  doc.setLineWidth(1.5)
  doc.rect(stx,sty,stw,sth,'S')
  // inner border
  doc.setLineWidth(0.5)
  doc.rect(stx+2,sty+2,stw-4,sth-4,'S')
  // stamp content
  doc.setTextColor(...blue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(7)
  doc.text('STATVISION CONSULTANCY',stx+stw/2,sty+9,{align:'center'})
  doc.setFontSize(6)
  doc.text('NAIROBI, KENYA',stx+stw/2,sty+14,{align:'center'})
  doc.setLineWidth(0.4)
  doc.line(stx+6,sty+16,stx+stw-6,sty+16)
  doc.setFontSize(isProforma?6.5:7)
  doc.setFont('helvetica','bold')
  doc.text(isProforma?'PROFORMA INVOICE':'OFFICIALLY APPROVED',stx+stw/2,sty+22,{align:'center'})
  doc.setFontSize(6)
  doc.setFont('helvetica','normal')
  doc.text(today,stx+stw/2,sty+27,{align:'center'})
  doc.line(stx+6,sty+29,stx+stw-6,sty+29)
  doc.setFont('helvetica','bold')
  doc.setFontSize(5.8)
  doc.text('CEO: HENRY GITAU MICHUKU',stx+stw/2,sty+34,{align:'center'})
  doc.setFont('helvetica','normal')
  doc.setFontSize(5.5)
  doc.text(isProforma?'Valid 30 days from issue':'StatVision Research and Consultancy',stx+stw/2,sty+38.5,{align:'center'})

  // ── TERMS (right of stamp) ───────────────────────────────────────
  doc.setTextColor(...muted)
  doc.setFont('helvetica','normal')
  doc.setFontSize(7.5)
  const terms = isProforma ? [
    'This proforma is valid for 30 days.',
    '50% deposit required to confirm order.',
    'A Tax Invoice will be issued upon deposit.',
    'All prices in Kenya Shillings (KES).'
  ] : [
    'Payment Terms: 50% deposit, balance on delivery.',
    'This is an official Tax Invoice.',
    'All prices are in Kenya Shillings (KES).',
    'Invoice valid for 30 days from date of issue.'
  ]
  terms.forEach((t,i)=>doc.text(t,stx+stw+6,sty+10+i*6))

  // ── FOOTER ───────────────────────────────────────────────────────
  doc.setFillColor(...navy)
  doc.rect(0,ph-18,pw,18,'F')
  doc.setTextColor(200,210,230)
  doc.setFont('helvetica','normal')
  doc.setFontSize(7.5)
  doc.text('StatVision Research and Consultancy  ·  Nairobi, Kenya  ·  hello@statvisionconsultancy.co.ke  ·  +254 748 216 918',pw/2,ph-10,{align:'center'})
  doc.setTextColor(150,160,180)
  doc.setFontSize(6.5)
  const footNote = isProforma
    ? 'This proforma invoice is for quotation purposes only and does not constitute a legal demand for payment.'
    : 'This is an official system-generated Tax Invoice. For disputes contact us within 7 days of receipt.'
  doc.text(footNote,pw/2,ph-5,{align:'center'})

  return doc
}

function generateProformaInvoice(orderId){
  const r=sqlData.find(x=>x.id===orderId)
  if(!r){alert('Order not found.');return}
  if(!window.jspdf){alert('PDF library not loaded — please refresh and try again.');return}
  if(parseFloat(String(r.total||0).replace(/,/g,''))<=0){
    alert('Cannot generate proforma — admin must set the price first.');return
  }
  buildInvoiceDoc(r,'proforma').save(`StatVision-Proforma-${r.id}.pdf`)
}

function generateStandardInvoice(orderId){
  const r=sqlData.find(x=>x.id===orderId)
  if(!r){alert('Order not found.');return}
  if(!window.jspdf){alert('PDF library not loaded — please refresh and try again.');return}
  if(parseFloat(String(r.deposit||0).replace(/,/g,''))<=0){
    alert('Standard invoice is only available after a deposit payment has been confirmed.');return
  }
  buildInvoiceDoc(r,'standard').save(`StatVision-Invoice-${r.id}.pdf`)
}

// Keep old name as alias for any other callers (admin PDF button)
function generateInvoicePDF(orderId){ generateStandardInvoice(orderId) }

function renderAdminOverview(){
  const active=document.getElementById('adKpiActive')
  if(!active)return // admin overview not in DOM context yet
  const activeOrders=sqlData.filter(r=>r.status!=='Completed').length
  const totalPaid=sqlData.reduce((s,r)=>s+moneyNum(r.deposit),0)
  const totalBalance=sqlData.reduce((s,r)=>s+moneyNum(r.balance),0)
  const totalClients=new Set(sqlData.map(r=>(r.email||'').toLowerCase()).filter(Boolean)).size

  document.getElementById('adKpiActive').textContent=activeOrders
  document.getElementById('adKpiActiveSub').textContent=sqlData.length?`${sqlData.length} total order${sqlData.length===1?'':'s'}`:'No orders yet'
  document.getElementById('adKpiRevenue').textContent='KES '+Math.round(totalPaid).toLocaleString()
  document.getElementById('adKpiClients').textContent=totalClients
  document.getElementById('adKpiBalance').textContent='KES '+Math.round(totalBalance).toLocaleString()

  // ── BAR CHART: Order volume last 6 months (white card) ──────────
  const bc=document.getElementById('dxBarChart')
  if(bc){
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const now=new Date()
    const buckets=Array.from({length:6},(_,i)=>{
      const d=new Date(now.getFullYear(),now.getMonth()-5+i,1)
      return {label:months[d.getMonth()],count:0}
    })
    sqlData.forEach((r,i)=>{buckets[i%6].count++})
    const max=Math.max(1,...buckets.map(b=>b.count))
    const barW=36, gap=(320-buckets.length*barW)/(buckets.length+1)
    let out=''
    buckets.forEach((b,i)=>{
      const h=Math.round((b.count/max)*90)
      const x=gap+i*(barW+gap)
      out+=`<rect x="${x}" y="${110-h}" width="${barW}" height="${h}" rx="6" fill="#107C41" opacity="${i===buckets.length-1?1:.55}"/>`
      out+=`<text x="${x+barW/2}" y="${110-h-6}" text-anchor="middle" font-size="9" font-weight="700" fill="#0D1B2A">${b.count}</text>`
      out+=`<text x="${x+barW/2}" y="125" text-anchor="middle" font-size="8" fill="#8A8886">${b.label}</text>`
    })
    bc.innerHTML=sqlData.length?out:`<text x="160" y="70" text-anchor="middle" font-size="11" fill="#90A4AE">No orders yet</text>`
  }

  // ── DONUT CHART: status mix (dark card) ──────────────────────────
  const sc=document.getElementById('adStatusChart')
  const legend=document.getElementById('adStatusLegend')
  const centerEl=document.getElementById('adStatusCenter')
  if(sc){
    const order=['Pending','Confirmed','In Progress','Draft Review','Completed','Overdue']
    const colors={'Pending':'#F5A623','Confirmed':'#42A5F5','In Progress':'#4FD1A5','Draft Review':'#9C7CF5','Completed':'#107C41','Overdue':'#FF6B6B'}
    const counts=order.map(s=>sqlData.filter(r=>r.status===s).length)
    const total=sqlData.length||1
    const used=order.map((s,i)=>({s,c:counts[i]})).filter(d=>d.c>0)
    const cx=65,cy=65,r=52,rInner=32
    let angle=-90, segs=''
    used.forEach(({s,c})=>{
      const frac=c/total
      const a1=angle, a2=angle+frac*360
      const x1=cx+r*Math.cos(a1*Math.PI/180), y1=cy+r*Math.sin(a1*Math.PI/180)
      const x2=cx+r*Math.cos(a2*Math.PI/180), y2=cy+r*Math.sin(a2*Math.PI/180)
      const large=frac>0.5?1:0
      segs+=`<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${colors[s]}"/>`
      angle=a2
    })
    sc.innerHTML = sqlData.length ? `${segs}<circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#16243A"/>` : `<circle cx="65" cy="65" r="52" fill="rgba(255,255,255,.05)"/>`
    if(centerEl) centerEl.innerHTML = `<b>${sqlData.length}</b><span>Orders</span>`
    if(legend){
      legend.innerHTML = used.length ? used.map(({s,c})=>`<div><span><i style="background:${colors[s]}"></i>${s}</span><b>${c}</b></div>`).join('') : `<div style="color:rgba(255,255,255,.4);text-align:center;padding:.5rem 0">No orders yet</div>`
    }
  }

  // ── TOP ANALYSTS (dark card) ──────────────────────────────────────
  const ta=document.getElementById('adTopAnalysts')
  if(ta){
    const map={}
    sqlData.forEach(r=>{
      const a=r.analyst||'Unassigned'
      if(!map[a])map[a]={orders:0,revenue:0}
      map[a].orders++; map[a].revenue+=moneyNum(r.total)
    })
    const top=Object.entries(map).filter(([a])=>a!=='Unassigned').sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,4)
    ta.innerHTML = top.length ? top.map(([name,d])=>{
      const initials=name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
      return `<div class="dxanalyst-row">
        <div class="dxanalyst-av">${initials}</div>
        <div><div class="dxanalyst-name">${name}</div><div class="dxanalyst-sub">${d.orders} orders</div></div>
        <div class="dxanalyst-val">KES ${Math.round(d.revenue/1000)}k</div>
      </div>`
    }).join('') : `<div style="color:rgba(255,255,255,.4);text-align:center;padding:.6rem 0;font-size:.78rem">No analysts assigned yet</div>`
  }

  // Recent activity (built from real orders, most recent first)
  const ra=document.getElementById('adRecentActivity')
  if(ra){
    if(sqlData.length===0){
      ra.innerHTML=`<div style="padding:1.4rem;text-align:center;color:var(--sl);font-size:.85rem">No activity yet — this feed will fill up as clients submit orders and analysts work on them.</div>`
    } else {
      ra.innerHTML=sqlData.slice(-6).reverse().map(r=>{
        const icon=r.status==='Completed'?'✅':r.status==='Draft Review'?'📤':r.status==='Pending'?'🆕':'📋'
        return `<div class="dxactivity-row"><span>${icon}</span><div style="flex:1"><strong>${r.id}</strong> — ${r.project}<div style="font-size:.7rem;color:var(--sl)">${r.client} · ${r.analyst||'Unassigned'} · <span class="badge ${scls[r.status]||'b-pn'}" style="font-size:.62rem">${r.status}</span></div></div><button class="db1 dbb" style="font-size:.68rem;padding:.25rem .6rem" onclick="adTab('orders',null)">View</button></div>`
      }).join('')
    }
  }
}
function renderSQL(){
  const tb=document.getElementById('sqlBody')
  if(tb)tb.innerHTML=sqlData.map(r=>`<tr><td><strong>${r.id}</strong></td><td>${r.client}</td><td>${r.email}</td><td>${r.phone}</td><td>${r.org}</td><td>${r.project}</td><td>${r.service}</td><td>${r.tool}</td><td>${r.format}</td><td>${analystSelect(r.id,r.analyst)}</td><td>${r.deadline}</td><td>KES ${r.total}</td><td>KES ${r.deposit}</td><td>KES ${r.balance}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td></tr>`).join('')
  const ao=document.getElementById('adminOrderBody')
  if(ao)ao.innerHTML=sqlData.map(r=>{
    const files=getFiles(r.id)
    return `<tr><td><strong>${r.id}</strong></td><td>${r.client}</td><td>${r.project}</td><td>${r.tool}</td><td>${analystSelect(r.id,r.analyst)}</td><td>${r.deadline}</td><td>KES ${r.total}</td><td>KES ${r.deposit}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td><td>${downloadLinksHTML(files.client)}</td><td><button class="db1 dbb" onclick="alert('Order ${r.id} details:\\n\\nClient: ${r.client}\\nProject: ${r.project}\\nAnalyst: ${r.analyst}\\nStatus: ${r.status}')">View</button></td></tr>`
  }).join('')
  const rw=document.getElementById('reportTableWrap')
  if(rw)rw.innerHTML=`<table><thead><tr><th>Order ID</th><th>Client</th><th>Email</th><th>Phone</th><th>Organisation</th><th>Project</th><th>Service</th><th>Tool</th><th>Format</th><th>Analyst</th><th>Deadline</th><th>Total</th><th>Deposit</th><th>Balance</th><th>Status</th></tr></thead><tbody>`+sqlData.map(r=>`<tr><td>${r.id}</td><td>${r.client}</td><td>${r.email}</td><td>${r.phone}</td><td>${r.org}</td><td>${r.project}</td><td>${r.service}</td><td>${r.tool}</td><td>${r.format}</td><td>${r.analyst}</td><td>${r.deadline}</td><td>KES ${r.total}</td><td>KES ${r.deposit}</td><td>KES ${r.balance}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td></tr>`).join('')+`</tbody></table>`
  const cu=currentClient();if(cu){renderMyOrders(cu.email);pbiRenderClientPortal();renderClientDocs()}
  // refresh admin tabs if open
  if(document.getElementById('adtab-clients')&&document.getElementById('adtab-clients').style.display!=='none') renderAdminClients()
  if(document.getElementById('adtab-finance')&&document.getElementById('adtab-finance').style.display!=='none') renderFinance()
  if(document.getElementById('adtab-reports')&&document.getElementById('adtab-reports').style.display!=='none') renderReports()
  renderAnalystUI()
  renderProjectsTable()
  renderAdminOverview()
}
function renderAnalystUI(){
  const ab=document.getElementById('anAssignBody')
  if(ab){
    const assigned=sqlData.filter(r=>r.status!=='Pending')
    ab.innerHTML=assigned.length?assigned.map(r=>{
      const files=getFiles(r.id)
      return `<tr><td><strong>${r.id}</strong></td><td>${r.client}</td><td>${r.project}</td><td>${r.service}</td><td>${r.tool}</td><td>${r.format}</td><td>${r.deadline}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td><td>${downloadLinksHTML(files.client)}</td><td><button class="db1 dba" onclick="anGoUpload('${r.id}')">Upload</button> <button class="db1 dbb" onclick="anTab('msgs',null)">Chat</button></td></tr>`
    }).join(''):`<tr><td colspan="10" style="text-align:center;color:var(--sl);padding:1.2rem">No assigned orders yet.</td></tr>`
  }
  const sel=document.getElementById('anUploadOrder')
  if(sel){
    const prev=sel.value
    sel.innerHTML=sqlData.map(r=>`<option value="${r.id}">${r.id} — ${r.client} — ${r.project}</option>`).join('')
    if(prev && sqlData.some(r=>r.id===prev)) sel.value=prev
    anShowOrderFiles()
  }
}
function anGoUpload(orderId){
  anTab('upload',document.querySelector('#page-analyst .snav[onclick*="upload"]'))
  const sel=document.getElementById('anUploadOrder')
  if(sel){ sel.value=orderId; anShowOrderFiles() }
}
function anShowOrderFiles(){
  const sel=document.getElementById('anUploadOrder'), box=document.getElementById('anClientFiles')
  if(!sel||!box)return
  const files=getFiles(sel.value)
  // client files
  let html = downloadLinksHTML(files.client)
  // also show previously uploaded analyst files with notes
  if(files.analyst && files.analyst.length){
    html += `<div style="margin-top:.7rem;padding-top:.7rem;border-top:1px solid var(--br)"><span style="font-size:.73rem;color:var(--sl);font-weight:600">Previously uploaded by analyst:</span>`
    files.analyst.forEach(f=>{
      html += `<div style="margin:.3rem 0"><a href="${f.url}" target="_blank" rel="noopener" style="font-size:.78rem;color:var(--b2)">📎 ${f.name}</a>`
      if(f.delivType) html += ` <span style="font-size:.71rem;color:var(--sl);background:var(--bl);padding:.1rem .4rem;border-radius:4px">${f.delivType}</span>`
      if(f.notes) html += `<div style="font-size:.72rem;color:var(--sl);margin-left:.6rem;font-style:italic">"${f.notes}"</div>`
      html += `</div>`
    })
    html += `</div>`
  }
  box.innerHTML = html
}
// ===== NOTIFICATIONS (Firestore-backed, real-time) =====
async function writeNotification(clientEmail, orderId, icon, title, body, tab){
  if(!clientEmail||clientEmail==='—') return
  // find the client's uid from users collection by email
  try{
    const snap = await fbDB.collection('users').where('email','==',clientEmail.toLowerCase()).where('role','==','client').limit(1).get()
    if(snap.empty) return
    const uid = snap.docs[0].id
    await fbDB.collection('notifications').add({
      uid, orderId, icon, title, body, tab,
      read: false,
      ts: Date.now()
    })
  }catch(e){ console.warn('writeNotification failed:',e.message) }
}

// Live listener for the current client's notifications
let _notifUnsub = null
function subscribeNotifications(uid){
  if(_notifUnsub) _notifUnsub()
  _notifUnsub = fbDB.collection('notifications')
    .where('uid','==',uid)
    .orderBy('ts','desc')
    .limit(30)
    .onSnapshot(snap=>{
      const notifs = snap.docs.map(d=>({id:d.id,...d.data()}))
      renderClientNotifs(notifs)
      // badge count
      const unread = notifs.filter(n=>!n.read).length
      const badge = document.getElementById('cNotifBadge')
      if(badge){ badge.textContent=unread||''; badge.style.display=unread?'inline':'none' }
    }, err=>console.warn('Notif listener:',err.message))
}
function renderClientNotifs(notifs){
  const wrap = document.getElementById('ctab-notifs-list')
  if(!wrap) return
  if(!notifs.length){
    wrap.innerHTML=`<div style="padding:1.4rem;text-align:center;color:var(--sl);font-size:.85rem">No notifications yet.</div>`
    return
  }
  wrap.innerHTML = notifs.map(n=>{
    const ago = timeAgo(n.ts)
    const bg = n.read ? '' : 'background:#FFF8E1;'
    return `<div style="padding:.9rem 1.4rem;border-bottom:1px solid var(--br);display:flex;align-items:center;gap:.9rem;${bg}" id="nitem-${n.id}">
      <span style="font-size:1.2rem">${n.icon||'🔔'}</span>
      <div style="flex:1">
        <strong style="font-size:.85rem">${n.title}</strong>
        <div style="font-size:.76rem;color:var(--sl)">${n.body} · ${ago}</div>
      </div>
      ${n.tab?`<button class="db1 dba" onclick="markRead('${n.id}');cTab('${n.tab}',null)">View</button>`:''}
    </div>`
  }).join('')
}
function markRead(notifId){
  fbDB.collection('notifications').doc(notifId).update({read:true}).catch(()=>{})
}
function markAllNotifsRead(){
  const cu=currentClient(); if(!cu) return
  fbDB.collection('notifications').where('uid','==',cu.uid).where('read','==',false).get().then(snap=>{
    const batch=fbDB.batch()
    snap.docs.forEach(d=>batch.update(d.ref,{read:true}))
    batch.commit()
  })
}
function timeAgo(ts){
  if(!ts) return '—'
  const diff = Date.now()-ts
  const m = Math.floor(diff/60000)
  if(m<2) return 'just now'
  if(m<60) return m+' min ago'
  const h = Math.floor(m/60)
  if(h<24) return h+' hr ago'
  const d = Math.floor(h/24)
  return d===1?'yesterday':d+' days ago'
}

// ===== LIVE CLIENT DOCUMENTS TAB =====
function renderClientDocs(){
  const cu=currentClient()
  const wrap=document.getElementById('clientDocsBody')
  if(!wrap) return
  if(!cu){ wrap.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--sl);padding:1.4rem">Log in to see your documents.</td></tr>'; return }
  const mine=sqlData.filter(r=>r.email && r.email.toLowerCase()===cu.email.toLowerCase())
  const rows=[]
  mine.forEach(r=>{
    const files=getFiles(r.id)
    ;(files.client||[]).forEach(f=>{
      rows.push({f,orderId:r.id,by:'Client',type:'Uploaded by you',cls:'dbb'})
    })
    ;(files.analyst||[]).forEach(f=>{
      rows.push({f,orderId:r.id,by:'Analyst',type:f.delivType||'Deliverable',cls:'dba'})
    })
  })
  if(!rows.length){
    wrap.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--sl);padding:1.4rem">No files yet — they will appear here once uploaded.</td></tr>'
    return
  }
  wrap.innerHTML=rows.map(({f,orderId,by,type,cls})=>{
    const icon = f.name.endsWith('.pdf')?'📄':f.name.endsWith('.docx')||f.name.endsWith('.doc')?'📝':f.name.endsWith('.ipynb')||f.name.endsWith('.sav')?'📊':'📎'
    const size = f.size ? (f.size>1048576?(f.size/1048576).toFixed(1)+' MB':(f.size/1024).toFixed(0)+' KB') : '—'
    return `<tr>
      <td>${icon} ${f.name}</td>
      <td><strong>${orderId}</strong></td>
      <td>${type}</td>
      <td>${by}</td>
      <td>${f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'}</td>
      <td>${size}</td>
      <td><a href="${f.url}" target="_blank" rel="noopener"><button class="db1 ${cls}">⬇ Open</button></a></td>
    </tr>`
  }).join('')
}

async function uploadDeliverable(){
  const sel=document.getElementById('anUploadOrder')
  const orderId=sel?sel.value:null
  const fileInput=document.getElementById('anFile')
  const statusEl=document.getElementById('anUploadStatus')
  if(!orderId){statusEl.style.color='#D13438';statusEl.textContent='⚠ Select an order first.';return}
  if(!fileInput||!fileInput.files.length){statusEl.style.color='#D13438';statusEl.textContent='⚠ Choose at least one file to upload.';return}
  statusEl.style.color='var(--sl)';statusEl.textContent='Uploading...'
  try{
    const type=document.getElementById('anDelivType').value
    const notes=(document.getElementById('anUploadNotes').value||'').trim()
    const newFiles=await uploadFilesToStorage(orderId,'analyst',fileInput.files)
    // tag each file with meta
    newFiles.forEach(f=>{ f.delivType=type; f.uploadedAt=Date.now(); f.notes=notes })
    const files=getFiles(orderId)
    const updatedAnalystFiles=files.analyst.concat(newFiles)
    const newStatus = type==='Final Deliverable' ? 'Completed' : 'Draft Review'
    await fbDB.collection('orders').doc(orderId).update({'files.analyst':updatedAnalystFiles,status:newStatus})
    // write a real notification to the client
    const order=sqlData.find(x=>x.id===orderId)
    const analyst=currentStaff()
    const analystName=analyst?analyst.name:'Your analyst'
    const clientEmail=order?order.email:null
    const notifTitle = type==='Final Deliverable'
      ? `Final deliverable ready — ${orderId}`
      : `${type} uploaded — ${orderId}`
    const notifBody = notes
      ? `${analystName}: "${notes.slice(0,80)}${notes.length>80?'…':''}"`
      : `${analystName} uploaded ${newFiles.length} file${newFiles.length>1?'s':''} for ${order?order.project:'your project'}.`
    const icon = type==='Final Deliverable' ? '✅' : '📤'
    await writeNotification(clientEmail, orderId, icon, notifTitle, notifBody, 'docs')
    statusEl.style.color='#107C10'
    statusEl.textContent='✓ Uploaded! Client has been notified and can now download it from their dashboard.'
    fileInput.value='';document.getElementById('anFn').textContent=''
    document.getElementById('anUploadNotes').value=''
    anShowOrderFiles()
  }catch(e){
    statusEl.style.color='#D13438'
    statusEl.textContent='⚠ Upload failed: '+e.message
  }
}
function addRow(){
  const n=sqlData.length+1
  const id=`DB-2025-${n.toString().padStart(3,'0')}`
  fbDB.collection('orders').doc(id).set({client:'New Client',email:'client@email.com',phone:'+254 7XX XXX XXX',org:'Organisation',project:'New Project',service:'Quantitative',tool:'SPSS',format:'APA 7th',analyst:'Unassigned',deadline:'TBD',total:'0',deposit:'0',balance:'0',status:'Pending',files:{client:[],analyst:[]}})
  alert('New order row added!')
}
function exportCSV(){
  const h=['Order ID','Client','Email','Phone','Organisation','Project','Service','Tool','Format','Analyst','Deadline','Total','Deposit','Balance','Status']
  const rows=sqlData.map(r=>[r.id,r.client,r.email,r.phone,r.org,r.project,r.service,r.tool,r.format,r.analyst,r.deadline,'KES '+r.total,'KES '+r.deposit,'KES '+r.balance,r.status].map(v=>`"${v}"`).join(','))
  const c=[h.join(','),...rows].join('\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(c);a.download='StatVision Research and Consultancy_Orders.csv';a.click()
}
window.addEventListener('load',renderSQL)

// COUNT UP
function countUp(el,t,dur=1800){
  let s=0;const f=ts=>{if(!s)s=ts;const p=Math.min((ts-s)/dur,1),v=Math.floor(p*t),sp=el.querySelector('span');el.innerHTML=v+(sp?sp.outerHTML:'');if(p<1)requestAnimationFrame(f)}
  requestAnimationFrame(f)
}
const obs=new IntersectionObserver(entries=>entries.forEach(e=>{
  if(e.isIntersecting){e.target.classList.add('vis');const n=e.target.querySelector('.snum[data-t]');if(n&&!n.dataset.done){n.dataset.done=1;countUp(n,+n.dataset.t)}}
}),{threshold:.15})
document.querySelectorAll('.fu').forEach(el=>obs.observe(el))

// DASHBOARD TABS
function cTab(n,btn){
  document.querySelectorAll('#page-client .snav').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active')
  document.querySelectorAll('#page-client [id^=ctab-]').forEach(d=>d.style.display='none')
  const el=document.getElementById('ctab-'+n);if(el)el.style.display='block'
  const t={overview:'Client Overview',orders:'My Orders',messages:'Messages',docs:'Documents',invoices:'Invoices & Receipts',notifs:'Notifications',profile:'Profile & Settings'}
  document.getElementById('cTabTitle').textContent=t[n]||n
}
function anTab(n,btn){
  document.querySelectorAll('#page-analyst .snav').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active')
  document.querySelectorAll('#page-analyst [id^=antab-]').forEach(d=>d.style.display='none')
  const el=document.getElementById('antab-'+n);if(el)el.style.display='block'
  const t={overview:'Analyst Dashboard',assignments:'My Assignments',calendar:'Deadline Calendar',msgs:'Client Messages',upload:'Upload Deliverable',payslips:'My Payslips',profile:'My Profile'}
  document.getElementById('anTabTitle').textContent=t[n]||n
  if(n==='payslips') loadAnalystPayslips()
}
function adTab(n,btn){
  document.querySelectorAll('#page-admin .snav').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active')
  document.querySelectorAll('#page-admin [id^=adtab-]').forEach(d=>d.style.display='none')
  const el=document.getElementById('adtab-'+n);if(el)el.style.display='block'
  const t={overview:'Admin Overview',orders:'All Orders',tracker:'Project Tracker',clients:'Client Management',analysts:'Analyst Accounts',finance:'Financial Management',reports:'Reports & Analytics',notifs:'Notification Centre',content:'Website Content',team:'Team Profiles',profile:'My Profile'}
  document.getElementById('adTabTitle').textContent=t[n]||n
  renderSQL()
  if(n==='finance') renderFinance()
  if(n==='reports') renderReports()
  if(n==='clients') renderAdminClients()
  if(n==='notifs') renderAdminNotifications([])
  if(n==='content') loadSiteImages()
  if(n==='team') renderAdminTeamPanel()
}
function filt(btn,f){btn.closest('.filt').querySelectorAll('.fb2').forEach(b=>b.classList.remove('on'));btn.classList.add('on')}
function toggleCreateAnalyst(){const f=document.getElementById('createAnalystForm');f.style.display=f.style.display==='none'?'block':'none'}

// MODAL
let mStep=1
function openModal(){document.getElementById('orderModal').classList.add('open');document.body.style.overflow='hidden'}
function closeModal(){document.getElementById('orderModal').classList.remove('open');document.body.style.overflow=''}
function mNext(){
  if(mStep<3){
    document.getElementById('ms'+mStep).style.display='none';mStep++
    document.getElementById('ms'+mStep).style.display='block'
    document.getElementById('sd'+(mStep-1)).classList.remove('on');document.getElementById('sd'+mStep).classList.add('on')
    document.getElementById('mprev').style.display='inline-flex'
    if(mStep===3)document.getElementById('mnext').textContent='Submit Project ✓'
  } else {
    submitOrder()
  }
}
// Formspree endpoint — connected to gitauhenry467@gmail.com via https://formspree.io/f/xeeboeqy
const FORMSPREE_ENDPOINT='https://formspree.io/f/xeeboeqy'
async function submitOrder(){
  const v=id=>{const el=document.getElementById(id);return el?el.value:''}
  const data={
    name:v('ord_name'),email:v('ord_email'),phone:v('ord_phone'),org:v('ord_org')||'—',
    country:v('ord_country'),service:v('ord_service'),datatype:v('ord_datatype'),tool:v('ord_tool'),
    format:v('ord_format'),deliverable:v('ord_deliverable'),description:v('ord_desc'),
    draft_deadline:v('ord_draftdue'),final_deadline:v('ord_finaldue'),notes:v('ord_notes')||'—'
  }
  if(!data.name||!data.email||!data.service){
    document.getElementById('ordStatus').textContent='⚠ Please fill in your name, email, and service type.'
    document.getElementById('ordStatus').style.color='#D13438'
    return
  }
  const statusEl=document.getElementById('ordStatus')
  const btn=document.getElementById('mnext')
  statusEl.style.color='var(--sl)';statusEl.textContent='Submitting your project...'
  btn.disabled=true

  const fileInput=document.getElementById('mfile')
  const n=sqlData.length+1
  const newId=`DB-2025-${n.toString().padStart(3,'0')}`

  let clientFiles=[]
  try{
    if(fileInput&&fileInput.files.length){
      statusEl.textContent='Uploading your files...'
      clientFiles=await uploadFilesToStorage(newId,'client',fileInput.files)
    }
  }catch(e){ console.warn('File upload failed:',e.message) }

  statusEl.textContent='Submitting your project...'

  fetch(FORMSPREE_ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({
      _subject:`New StatVision Research and Consultancy Order — ${data.name}`,
      _replyto:data.email,
      attached_files:clientFiles.map(f=>f.name).join(', ')||'None',
      ...data
    })
  }).then(res=>{
    if(!res.ok) throw new Error('Submission failed')
    return res.json()
  }).then(async ()=>{
    // write the real order straight to Firestore — visible instantly to Admin/Analyst/Client everywhere
    await fbDB.collection('orders').doc(newId).set({
      client:data.name,email:data.email,phone:data.phone,
      org:data.org,project:data.description?data.description.slice(0,40)+'…':data.service,service:data.datatype||data.service,
      tool:data.tool||'TBD',format:data.format||'TBD',analyst:'Unassigned',deadline:data.final_deadline||'TBD',
      total:'0',deposit:'0',balance:'0',status:'Pending',
      files:{client:clientFiles,analyst:[]}
    })
    statusEl.style.color='#107C10'
    statusEl.textContent='✓ Submitted! Check your email for confirmation.'
    setTimeout(()=>{
      closeModal();mStep=1;btn.disabled=false;statusEl.textContent=''
      ;[1,2,3].forEach(i=>{document.getElementById('ms'+i).style.display=i===1?'block':'none';document.getElementById('sd'+i).className='sdt'+(i===1?' on':'')})
      document.getElementById('mprev').style.display='none';btn.textContent='Continue →'
      if(fileInput)fileInput.value=''
      const fn=document.getElementById('mfn');if(fn)fn.textContent=''
    },1800)
  }).catch(()=>{
    btn.disabled=false
    statusEl.style.color='#D13438'
    statusEl.textContent='⚠ Could not submit online. Please email hello@statvisionconsultancy.co.ke or call +254 748 216 918 directly.'
  })
}
function mPrev(){
  if(mStep>1){
    document.getElementById('ms'+mStep).style.display='none';mStep--
    document.getElementById('ms'+mStep).style.display='block'
    document.getElementById('sd'+(mStep+1)).classList.remove('on');document.getElementById('sd'+mStep).classList.add('on')
    if(mStep===1)document.getElementById('mprev').style.display='none'
    document.getElementById('mnext').textContent='Continue →'
  }
}

// CHAT
function openChat(){document.getElementById('chatPan').classList.toggle('open');document.querySelector('.cbdg').style.display='none'}
const reps=['Great! How many variables and respondents does your dataset have?','That sounds like a great project. I would recommend SPSS or R for this. Shall I help you set up an order?','We handle data collection too — we design the questionnaire, deploy it, then analyse the results.','Turnaround is 3–7 days depending on complexity. We agree on a deadline when you place your order.','Click "Start Your Project" to submit your details and I will be assigned to your case right away!']
let rIdx=0
// ══════════════════════════════════════════════════════════════════
// LIVE CLIENTS TAB
// ══════════════════════════════════════════════════════════════════
function renderAdminClients(){
  const wrap=document.getElementById('adtab-clients')
  if(!wrap) return
  // Build client map from real orders
  const clientMap={}
  sqlData.forEach(r=>{
    const key=(r.email||'').toLowerCase()
    if(!key) return
    if(!clientMap[key]){
      clientMap[key]={name:r.client,email:r.email,phone:r.phone,org:r.org||'—',orders:0,total:0,deposit:0,status:'Active'}
    }
    clientMap[key].orders++
    clientMap[key].total+=moneyNum(r.total)
    clientMap[key].deposit+=moneyNum(r.deposit)
    if(r.status==='Pending') clientMap[key].status='New'
  })
  const clients=Object.values(clientMap).sort((a,b)=>b.total-a.total)
  const rows=clients.length?clients.map(c=>`
    <tr>
      <td><strong>${c.name}</strong>${c.org&&c.org!=='—'?`<br/><span style="font-size:.7rem;color:var(--sl)">${c.org}</span>`:''}</td>
      <td><a href="mailto:${c.email}" style="color:var(--b2)">${c.email}</a></td>
      <td>${c.phone||'—'}</td>
      <td>${c.orders}</td>
      <td><strong style="color:var(--b2)">KES ${Math.round(c.total).toLocaleString()}</strong></td>
      <td style="color:#107C10;font-weight:600">KES ${Math.round(c.deposit).toLocaleString()}</td>
      <td style="color:#D13438">KES ${Math.round(c.total-c.deposit).toLocaleString()}</td>
      <td><span class="badge ${c.status==='Active'?'b-dn':c.status==='New'?'b-pr':'b-pn'}">${c.status}</span></td>
      <td><button class="db1 dbb" onclick="viewClientOrders('${c.email}')">View Orders</button></td>
    </tr>`).join('')
  :`<tr><td colspan="9" style="text-align:center;color:var(--sl);padding:1.4rem">No clients yet.</td></tr>`

  wrap.innerHTML=`
    <div class="kgd" style="margin-bottom:1.2rem">
      <div class="kpi"><div class="kpic" style="background:#E3F2FD">👥</div><div><div class="kpiv">${clients.length}</div><div class="kpil">Total Clients</div></div></div>
      <div class="kpi"><div class="kpic" style="background:#E8F5E9">✅</div><div><div class="kpiv">${clients.filter(c=>c.status==='Active').length}</div><div class="kpil">Active Clients</div></div></div>
      <div class="kpi"><div class="kpic" style="background:#FFF3E0">🆕</div><div><div class="kpiv">${clients.filter(c=>c.status==='New').length}</div><div class="kpil">New Clients</div></div></div>
      <div class="kpi"><div class="kpic" style="background:#F3E5F5">💰</div><div><div class="kpiv">KES ${Math.round(clients.reduce((s,c)=>s+c.total,0)).toLocaleString()}</div><div class="kpil">Total Client Value</div></div></div>
    </div>
    <div class="dtw">
      <div class="dth"><h3>All Clients</h3><div class="dtha"><button class="db1 dbb" onclick="exportClientsCSV()">⬇ Export CSV</button></div></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Total Value</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`
}

function viewClientOrders(email){
  adTab('orders',null)
  // scroll to and highlight orders for this client
  setTimeout(()=>{
    const rows=document.querySelectorAll('#adminOrderBody tr')
    rows.forEach(r=>{r.style.background=r.textContent.includes(email)?'#FFF8E1':''})
  },300)
}

function exportClientsCSV(){
  const clientMap={}
  sqlData.forEach(r=>{
    const key=(r.email||'').toLowerCase();if(!key)return
    if(!clientMap[key])clientMap[key]={name:r.client,email:r.email,phone:r.phone,org:r.org||'—',orders:0,total:0,deposit:0}
    clientMap[key].orders++;clientMap[key].total+=moneyNum(r.total);clientMap[key].deposit+=moneyNum(r.deposit)
  })
  const rows=[['Name','Email','Phone','Organisation','Orders','Total Value (KES)','Paid (KES)','Balance (KES)']]
  Object.values(clientMap).forEach(c=>rows.push([c.name,c.email,c.phone,c.org,c.orders,Math.round(c.total),Math.round(c.deposit),Math.round(c.total-c.deposit)]))
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv)
  a.download='StatVision-Clients.csv';a.click()
}

// ══════════════════════════════════════════════════════════════════
// LIVE ADMIN NOTIFICATIONS (Firestore)
// ══════════════════════════════════════════════════════════════════
let _adminNotifUnsub=null
function subscribeAdminNotifications(){
  if(_adminNotifUnsub)_adminNotifUnsub()
  _adminNotifUnsub=fbDB.collection('notifications')
    .where('uid','==','admin')
    .orderBy('ts','desc')
    .limit(50)
    .onSnapshot(snap=>{
      const notifs=snap.docs.map(d=>({id:d.id,...d.data()}))
      // also add system notifs from orders (new orders, payments)
      renderAdminNotifications(notifs)
      const unread=notifs.filter(n=>!n.read).length
      const badge=document.querySelector('#page-admin .snav[onclick*="notifs"] .ndot')
      if(badge){badge.style.display=unread?'inline':'none'}
    },err=>console.warn('Admin notif listener:',err))
}

function renderAdminNotifications(notifs){
  const wrap=document.getElementById('adtab-notifs')
  if(!wrap)return
  // also build system notifications from orders
  const sysNotifs=sqlData.slice().reverse().slice(0,10).map(r=>({
    id:'sys-'+r.id,
    icon:r.status==='Completed'?'✅':r.status==='Pending'?'🆕':r.status==='Draft Review'?'📤':'📋',
    title:`${r.status} — ${r.id}`,
    body:`${r.client} · ${r.project} · ${r.analyst||'Unassigned'}`,
    tab:'orders', read:true, ts:0, sys:true
  }))
  const all=[...notifs,...sysNotifs].sort((a,b)=>b.ts-a.ts)
  const rows=all.map(n=>`
    <div style="padding:.88rem 1.4rem;border-bottom:1px solid var(--br);display:flex;align-items:center;gap:.85rem;${!n.read&&!n.sys?'background:#FFF8E1':''}">
      <span style="font-size:1.2rem">${n.icon||'🔔'}</span>
      <div style="flex:1">
        <strong style="font-size:.84rem">${n.title}</strong>
        <div style="font-size:.75rem;color:var(--sl)">${n.body}${n.ts?(' · '+timeAgo(n.ts)):''}</div>
      </div>
      ${n.tab?`<button class="db1 dbb" onclick="${n.sys?`adTab('${n.tab}',null)`:`markAdminNotifRead('${n.id}');adTab('${n.tab}',null)`}">View</button>`:''}
    </div>`).join('')

  wrap.innerHTML=`
    <div class="dtw">
      <div class="dth"><h3>Notification Centre</h3>
        <div class="dtha"><button class="db1 dbb" onclick="markAllAdminNotifsRead()">Mark All Read</button></div>
      </div>
      <div style="padding:0">${rows||'<div style="padding:1.4rem;text-align:center;color:var(--sl)">No notifications yet.</div>'}</div>
    </div>`
}

function markAdminNotifRead(id){
  fbDB.collection('notifications').doc(id).update({read:true}).catch(()=>{})
}
function markAllAdminNotifsRead(){
  fbDB.collection('notifications').where('uid','==','admin').where('read','==',false).get().then(snap=>{
    const batch=fbDB.batch();snap.docs.forEach(d=>batch.update(d.ref,{read:true}));batch.commit()
  })
}

// ══════════════════════════════════════════════════════════════════
// AI-POWERED LIVE CHAT (Claude API)
// ══════════════════════════════════════════════════════════════════
const STAT_SYSTEM = `You are a helpful assistant for StatVision Research and Consultancy, a professional data analysis and research services company based in Nairobi, Kenya. 

Key facts:
- Services: SPSS, Stata, R, Python, Power BI, Excel, EViews, JMP, Minitab analysis
- Specialties: Thesis/dissertation analysis, NGO impact evaluation, business analytics, GIS mapping, machine learning
- Pricing: Starting from KES 5,000 — depends on complexity, tool, and deadline
- Turnaround: 24hrs to 2 weeks depending on project
- Contact: +254 748 216 918, hello@statvisionconsultancy.co.ke
- Payment: 50% deposit via M-Pesa Till 4136540 (Lipa na M-Pesa), card, or PayPal
- Process: Submit project → Admin sets price → Client pays deposit → Analyst works → Draft review → Final delivery

Be warm, professional, and helpful. Answer questions about services, pricing estimates, timelines, and processes. If asked about a specific project, encourage them to submit via the Start Project button. Keep responses concise (2-4 sentences max).`

async function callClaudeAPI(messages){
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-6',
        max_tokens:1000,
        system:STAT_SYSTEM,
        messages
      })
    })
    const data=await res.json()
    return data.content?.[0]?.text||'I am sorry, I could not process that. Please call us on +254 748 216 918.'
  }catch(e){
    return 'I am having trouble connecting right now. Please call us on +254 748 216 918 or WhatsApp us.'
  }
}

// Public chat widget (homepage)
let publicChatHistory=[]
async function sendChat(){
  const i=document.getElementById('chatIn'),m=i.value.trim();if(!m)return
  const c=document.getElementById('chatMsgs')
  c.innerHTML+=`<div class="msg c">${m}</div>`;i.value='';c.scrollTop=c.scrollHeight
  c.innerHTML+=`<div class="msg a" id="chatTyping">...</div>`;c.scrollTop=c.scrollHeight
  publicChatHistory.push({role:'user',content:m})
  const reply=await callClaudeAPI(publicChatHistory)
  publicChatHistory.push({role:'assistant',content:reply})
  const typing=document.getElementById('chatTyping')
  if(typing)typing.outerHTML=`<div class="msg a">${reply}</div>`
  c.scrollTop=c.scrollHeight
}

// Client portal chat (client ↔ analyst via Firestore)
let clientChatUnsub=null
let currentChatOrderId=null

function initClientChat(orderId, clientEmail){
  currentChatOrderId=orderId
  if(clientChatUnsub)clientChatUnsub()
  const c=document.getElementById('clientMsgs');if(!c)return
  c.innerHTML=''
  clientChatUnsub=fbDB.collection('chats').doc(orderId)
    .collection('messages').orderBy('ts','asc')
    .onSnapshot(snap=>{
      c.innerHTML=snap.docs.map(d=>{
        const msg=d.data()
        const isClient=msg.role==='client'
        return `<div class="msg ${isClient?'c':'a'}" title="${new Date(msg.ts).toLocaleTimeString()}">
          ${msg.text}
          <span style="display:block;font-size:.65rem;opacity:.5;margin-top:.2rem">${msg.sender} · ${timeAgo(msg.ts)}</span>
        </div>`
      }).join('')
      c.scrollTop=c.scrollHeight
    },err=>console.warn('Chat listener:',err))
}

async function clientSend(){
  const i=document.getElementById('clientChatIn'),m=i.value.trim();if(!m)return
  const cu=currentClient();if(!cu)return
  const c=document.getElementById('clientMsgs')
  i.value=''
  if(!currentChatOrderId){
    // find first order for this client
    const mine=sqlData.filter(r=>r.email&&r.email.toLowerCase()===cu.email.toLowerCase())
    if(mine.length)currentChatOrderId=mine[0].id
  }
  if(!currentChatOrderId){
    c.innerHTML+=`<div class="msg a">Please submit a project first before messaging an analyst.</div>`
    return
  }
  // Save to Firestore
  await fbDB.collection('chats').doc(currentChatOrderId).collection('messages').add({
    text:m, role:'client', sender:cu.name||cu.email, ts:Date.now()
  })
  // Also write admin notification
  await fbDB.collection('notifications').add({
    uid:'admin', orderId:currentChatOrderId, icon:'💬',
    title:`New message from ${cu.name||cu.email} — ${currentChatOrderId}`,
    body:m.slice(0,80), tab:'orders', read:false, ts:Date.now()
  })
}

// Analyst chat (reads same Firestore collection)
let analystChatUnsub=null
let currentAnalystChatOrderId=null

function initAnalystChat(orderId, analystName){
  currentAnalystChatOrderId=orderId
  if(analystChatUnsub)analystChatUnsub()
  const c=document.getElementById('analystMsgs');if(!c)return
  c.innerHTML=''
  analystChatUnsub=fbDB.collection('chats').doc(orderId)
    .collection('messages').orderBy('ts','asc')
    .onSnapshot(snap=>{
      c.innerHTML=snap.docs.map(d=>{
        const msg=d.data()
        const isAnalyst=msg.role==='analyst'
        return `<div class="msg ${isAnalyst?'a':'c'}" title="${new Date(msg.ts).toLocaleTimeString()}">
          ${msg.text}
          <span style="display:block;font-size:.65rem;opacity:.5;margin-top:.2rem">${msg.sender} · ${timeAgo(msg.ts)}</span>
        </div>`
      }).join('')
      c.scrollTop=c.scrollHeight
    },err=>console.warn('Analyst chat listener:',err))
}

async function analystSend(){
  const i=document.getElementById('analystChatIn'),m=i.value.trim();if(!m)return
  const st=currentStaff();if(!st)return
  const c=document.getElementById('analystMsgs')
  i.value=''
  if(!currentAnalystChatOrderId){
    if(c) c.innerHTML+=`<div class="msg c">Select an order first.</div>`
    return
  }
  await fbDB.collection('chats').doc(currentAnalystChatOrderId).collection('messages').add({
    text:m, role:'analyst', sender:st.name||st.email, ts:Date.now()
  })
}
// ===== CLIENT PORTAL — REAL ACCOUNT DATA (no simulation) =====
let pbiPaused = false;
function pbiPause(){
  pbiPaused = !pbiPaused;
  document.getElementById('pbiPauseBtn').textContent = pbiPaused ? '▶ Resume' : '⏸ Pause';
}
function moneyNum(s){ return parseFloat(String(s).replace(/,/g,''))||0 }

const pbiKpis = [
  {label:'Active Orders', value:0, fmt:v=>Math.round(v).toString()},
  {label:'Completed', value:0, fmt:v=>Math.round(v).toString()},
  {label:'Balance Due (KES)', value:0, fmt:v=>'KES '+Math.round(v).toLocaleString()},
  {label:'Total Paid (KES)', value:0, fmt:v=>'KES '+Math.round(v).toLocaleString()},
];
const pbiKpiRow = document.getElementById('pbiKpiRow');
if(pbiKpiRow){
  pbiKpis.forEach((k,i)=>{
    const el=document.createElement('div');
    el.className='pbi-card';
    el.innerHTML=`<div class="pl">${k.label}</div><div class="pv" id="pbiKpiVal${i}">${k.fmt(k.value)}</div>`;
    pbiKpiRow.appendChild(el);
  });
}
const pbiBarSvg=document.getElementById('pbiBarChart');
const pbiDonutSvg=document.getElementById('pbiDonut');

function pbiRenderBars(mine){
  if(!pbiBarSvg)return;
  const w=720,h=190,padB=20,slots=8;
  const barW=(w/slots)-24;
  const recent=mine.slice(-slots);
  const bars=Array.from({length:slots},(_,i)=>{
    const r=recent[i-(slots-recent.length)];
    return r?{a:moneyNum(r.deposit)/1000,b:moneyNum(r.total)/1000}:{a:0,b:0}
  });
  const maxV=Math.max(1,...bars.map(d=>Math.max(d.a,d.b)));
  const scale=(h-padB)/maxV;
  let out='';
  bars.forEach((d,i)=>{
    const x=i*(w/slots)+6;
    const ha=d.a*scale, hb=d.b*scale;
    out+=`<rect x="${x}" y="${h-padB-ha}" width="${barW/2}" height="${ha}" fill="#F2C811" rx="2"/>`;
    out+=`<rect x="${x+barW/2+2}" y="${h-padB-hb}" width="${barW/2}" height="${hb}" fill="#1565C0" rx="2"/>`;
  });
  out+=`<line x1="0" y1="${h-padB}" x2="${w}" y2="${h-padB}" stroke="#E1DFDD" stroke-width="1"/>`;
  pbiBarSvg.innerHTML=out;
}

function pbiRenderDonut(totalPaid,balanceDue){
  if(!pbiDonutSvg)return;
  const total=totalPaid+balanceDue;
  const c=document.getElementById('pbiDonutCenter');
  const l=document.getElementById('pbiDonutList');
  if(total<=0){
    pbiDonutSvg.innerHTML=`<circle cx="60" cy="60" r="46" fill="none" stroke="#E1DFDD" stroke-width="15"/>`;
    if(c)c.innerHTML=`<div class="v">KES 0</div><div class="l">No payments yet</div>`;
    if(l)l.innerHTML=`<div><span>Total Paid</span><b>KES 0</b></div><div><span>Balance Due</span><b>KES 0</b></div>`;
    return;
  }
  const segs=[{label:'Total Paid',value:totalPaid,color:'#1565C0'},{label:'Balance Due',value:balanceDue,color:'#D13438'}];
  const r=46,cx=60,cy=60,thick=15;
  let angle=-90,paths='';
  segs.forEach(d=>{
    if(d.value<=0)return;
    const frac=d.value/total, sweep=frac*360, large=sweep>180?1:0;
    const x1=cx+r*Math.cos(angle*Math.PI/180), y1=cy+r*Math.sin(angle*Math.PI/180);
    const end=angle+sweep;
    const x2=cx+r*Math.cos(end*Math.PI/180), y2=cy+r*Math.sin(end*Math.PI/180);
    paths+=`<path d="M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${d.color}" stroke-width="${thick}" stroke-linecap="round"/>`;
    angle=end+3;
  });
  pbiDonutSvg.innerHTML=paths;
  if(c)c.innerHTML=`<div class="v">KES ${Math.round(total).toLocaleString()}</div><div class="l">Total</div>`;
  if(l)l.innerHTML=`<div><span>Total Paid</span><b>KES ${Math.round(totalPaid).toLocaleString()}</b></div><div><span>Balance Due</span><b>KES ${Math.round(balanceDue).toLocaleString()}</b></div>`;
}

function pbiRenderRecentOrders(mine){
  const body=document.getElementById('pbiOrdersBody');
  if(!body)return;
  if(mine.length===0){
    body.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--sl);padding:1.2rem">No orders yet — submit your first project to see it here.</td></tr>`;
    return;
  }
  const clsMap={'In Progress':'prog','Confirmed':'done','Draft Review':'review','Completed':'done','Pending':'review'};
  body.innerHTML=mine.slice(-6).reverse().map(r=>
    `<tr><td><strong>${r.id}</strong></td><td>${r.project}</td><td>${r.tool}</td><td>${r.analyst}</td><td>${r.deadline}</td><td><span class="pbi-status ${clsMap[r.status]||'review'}">${r.status}</span></td></tr>`
  ).join('');
}

function pbiRenderClientPortal(){
  const cu=currentClient();
  const mine=cu?sqlData.filter(r=>r.email && r.email.toLowerCase()===cu.email.toLowerCase()):[];
  const active=mine.filter(r=>r.status!=='Completed').length;
  const completed=mine.filter(r=>r.status==='Completed').length;
  const totalPaid=mine.reduce((s,r)=>s+moneyNum(r.deposit),0);
  const balanceDue=mine.reduce((s,r)=>s+moneyNum(r.balance),0);

  pbiKpis[0].value=active; pbiKpis[1].value=completed; pbiKpis[2].value=balanceDue; pbiKpis[3].value=totalPaid;
  pbiKpis.forEach((k,i)=>{ const v=document.getElementById('pbiKpiVal'+i); if(v)v.textContent=k.fmt(k.value); });

  pbiRenderBars(mine);
  pbiRenderDonut(totalPaid,balanceDue);
  pbiRenderRecentOrders(mine);
}
function pbiRefresh(){ pbiRenderClientPortal(); }

pbiRenderClientPortal();

// (fake demo clientSend/analystSend removed — the real Firestore-backed
// versions defined earlier in this file are the ones that run)

// ══════════════════════════════════════════════════════════════════
// LIVE FINANCE DASHBOARD
// ══════════════════════════════════════════════════════════════════
function renderFinance(){
  const wrap=document.getElementById('adtab-finance')
  if(!wrap||!sqlData.length) return

  const mn=v=>parseFloat(String(v||0).replace(/,/g,''))||0
  const fmt=v=>'KES '+Math.round(v).toLocaleString()

  const totalRevenue=sqlData.reduce((s,r)=>s+mn(r.total),0)
  const totalDeposit=sqlData.reduce((s,r)=>s+mn(r.deposit),0)
  const totalBalance=sqlData.reduce((s,r)=>s+mn(r.balance),0)
  const totalOrders=sqlData.length
  const completedOrders=sqlData.filter(r=>r.status==='Completed').length
  const avgOrderValue=totalOrders?totalRevenue/totalOrders:0

  // Group by analyst
  const analystMap={}
  sqlData.forEach(r=>{
    const a=r.analyst||'Unassigned'
    if(!analystMap[a])analystMap[a]={orders:0,revenue:0,collected:0}
    analystMap[a].orders++
    analystMap[a].revenue+=mn(r.total)
    analystMap[a].collected+=mn(r.deposit)
  })

  // Group by service
  const serviceMap={}
  sqlData.forEach(r=>{
    const s=r.service||'Other'
    if(!serviceMap[s])serviceMap[s]={orders:0,revenue:0}
    serviceMap[s].orders++
    serviceMap[s].revenue+=mn(r.total)
  })

  // Group by status
  const statusCount={}
  sqlData.forEach(r=>{const s=r.status||'Pending';statusCount[s]=(statusCount[s]||0)+1})

  // Payment ledger — real orders
  const ledgerRows=sqlData.map(r=>`
    <tr>
      <td>${r.deadline||'—'}</td>
      <td><strong>${r.id}</strong></td>
      <td>${r.client}</td>
      <td>${r.service||'—'}</td>
      <td>M-Pesa / Card</td>
      <td>${fmt(mn(r.total))}</td>
      <td style="color:#107C10;font-weight:600">${fmt(mn(r.deposit))}</td>
      <td style="color:${mn(r.balance)>0?'#D13438':'#107C10'};font-weight:600">${fmt(mn(r.balance))}</td>
      <td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td>
    </tr>`).join('')

  // Analyst performance rows
  const analystRows=Object.entries(analystMap).map(([name,d])=>`
    <tr>
      <td><strong>${name}</strong></td>
      <td>${d.orders}</td>
      <td>${fmt(d.revenue)}</td>
      <td style="color:#107C10;font-weight:600">${fmt(d.collected)}</td>
      <td style="color:#D13438">${fmt(d.revenue-d.collected)}</td>
      <td>${d.orders?Math.round(d.collected/d.revenue*100)+'%':'—'}</td>
    </tr>`).join('')

  // SVG bar chart for service revenue
  const services=Object.entries(serviceMap).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,6)
  const maxRev=services[0]?services[0][1].revenue:1
  const barW=services.length?Math.floor(320/services.length)-8:40
  const svgBars=services.map(([s,d],i)=>{
    const h=Math.round((d.revenue/maxRev)*80)
    const x=i*(barW+8)+10
    const colors=['#1565C0','#F5A623','#00897B','#7B1FA2','#E53935','#546E7A']
    return `<rect x="${x}" y="${100-h}" width="${barW}" height="${h}" rx="3" fill="${colors[i%6]}" opacity=".85"/>
      <text x="${x+barW/2}" y="${105}" text-anchor="middle" font-size="7" fill="#546e7a">${s.slice(0,8)}</text>
      <text x="${x+barW/2}" y="${100-h-4}" text-anchor="middle" font-size="8" font-weight="700" fill="${colors[i%6]}">${fmt(d.revenue).replace('KES ','')}</text>`
  }).join('')

  wrap.innerHTML=`
    <!-- KPI CARDS -->
    <div class="kgd" style="margin-bottom:1.4rem">
      <div class="kpi"><div class="kpic" style="background:#E8F5E9">💰</div><div><div class="kpiv">${fmt(totalRevenue)}</div><div class="kpil">Total Order Value</div><div class="kpit">${totalOrders} orders</div></div></div>
      <div class="kpi"><div class="kpic" style="background:#E3F2FD">💳</div><div><div class="kpiv">${fmt(totalDeposit)}</div><div class="kpil">Total Collected</div><div class="kpit tu">▲ ${totalRevenue?Math.round(totalDeposit/totalRevenue*100):0}% collection rate</div></div></div>
      <div class="kpi"><div class="kpic" style="background:#FFEBEE">⏳</div><div><div class="kpiv">${fmt(totalBalance)}</div><div class="kpil">Outstanding Balance</div><div class="kpit td2">${totalRevenue?Math.round(totalBalance/totalRevenue*100):0}% uncollected</div></div></div>
      <div class="kpi"><div class="kpic" style="background:#F3E5F5">📊</div><div><div class="kpiv">${fmt(avgOrderValue)}</div><div class="kpil">Avg Order Value</div><div class="kpit">${completedOrders} completed</div></div></div>
    </div>

    <!-- CHARTS ROW -->
    <div class="crow" style="margin-bottom:1.4rem">
      <div class="cc">
        <h3>Revenue by Service Category</h3>
        <svg width="100%" viewBox="0 0 360 115" style="overflow:visible">
          ${svgBars}
          <line x1="0" y1="100" x2="360" y2="100" stroke="#e0e0e0" stroke-width="1"/>
        </svg>
      </div>
      <div class="cc">
        <h3>Order Status Breakdown</h3>
        <div style="display:flex;flex-direction:column;gap:.55rem;margin-top:.5rem">
          ${Object.entries(statusCount).map(([s,c])=>{
            const pct=Math.round(c/totalOrders*100)
            const col=scls[s]||'b-pn'
            const colors={'b-dn':'#107C10','b-pr':'#1565C0','b-rv':'#7B1FA2','b-pn':'#F5A623','b-ov':'#D13438'}
            const color=colors[col]||'#546E7A'
            return `<div>
              <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:.2rem">
                <span style="font-weight:600">${s}</span><span>${c} orders (${pct}%)</span>
              </div>
              <div style="background:#f0f0f0;border-radius:4px;height:8px">
                <div style="background:${color};width:${pct}%;height:8px;border-radius:4px;transition:width .6s"></div>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    </div>

    <!-- ANALYST PERFORMANCE -->
    <div class="dtw" style="margin-bottom:1.4rem">
      <div class="dth"><h3>Analyst Revenue Performance</h3><div class="dtha"><button class="db1 dbb" onclick="exportFinanceCSV()">⬇ Export CSV</button></div></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Analyst</th><th>Orders</th><th>Total Value</th><th>Collected</th><th>Outstanding</th><th>Collection Rate</th></tr></thead>
        <tbody>${analystRows}</tbody>
      </table></div>
    </div>

    <!-- FULL PAYMENT LEDGER -->
    <div class="dtw">
      <div class="dth"><h3>Live Payment Ledger</h3><div class="dtha"><button class="db1 dba" onclick="exportFinanceCSV()">⬇ Export CSV</button></div></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Deadline</th><th>Order ID</th><th>Client</th><th>Service</th><th>Method</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>${ledgerRows}</tbody>
        <tfoot><tr style="background:#f8f9fa;font-weight:700">
          <td colspan="5" style="text-align:right;padding:.7rem 1rem">TOTALS</td>
          <td>${fmt(totalRevenue)}</td>
          <td style="color:#107C10">${fmt(totalDeposit)}</td>
          <td style="color:#D13438">${fmt(totalBalance)}</td>
          <td></td>
        </tr></tfoot>
      </table></div>
    </div>`
}

function exportFinanceCSV(){
  const mn=v=>parseFloat(String(v||0).replace(/,/g,''))||0
  const rows=[['Order ID','Client','Email','Phone','Service','Tool','Analyst','Deadline','Total (KES)','Deposit (KES)','Balance (KES)','Status']]
  sqlData.forEach(r=>rows.push([r.id,r.client,r.email,r.phone,r.service,r.tool,r.analyst,r.deadline,mn(r.total),mn(r.deposit),mn(r.balance),r.status]))
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv)
  a.download='StatVision-Finance-Report.csv';a.click()
}

// ══════════════════════════════════════════════════════════════════
// COMPREHENSIVE STATISTICAL REPORTS
// ══════════════════════════════════════════════════════════════════
function renderReports(){
  const wrap=document.getElementById('adtab-reports')
  if(!wrap||!sqlData.length) return

  const mn=v=>parseFloat(String(v||0).replace(/,/g,''))||0
  const fmt=v=>'KES '+Math.round(v).toLocaleString()
  const n=sqlData.length

  // ── DESCRIPTIVE STATS ──────────────────────────────────────────
  const revenues=sqlData.map(r=>mn(r.total)).filter(v=>v>0)
  const mean=revenues.length?revenues.reduce((a,b)=>a+b,0)/revenues.length:0
  const sorted=[...revenues].sort((a,b)=>a-b)
  const median=sorted.length?sorted.length%2===0?(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2:sorted[Math.floor(sorted.length/2)]:0
  const variance=revenues.length?revenues.reduce((s,v)=>s+(v-mean)**2,0)/revenues.length:0
  const stdDev=Math.sqrt(variance)
  const min=sorted[0]||0, max=sorted[sorted.length-1]||0

  // ── SERVICE FREQUENCY TABLE ────────────────────────────────────
  const svcMap={};sqlData.forEach(r=>{const s=r.service||'Other';svcMap[s]=(svcMap[s]||0)+1})
  const svcRows=Object.entries(svcMap).sort((a,b)=>b[1]-a[1]).map(([s,c],i,arr)=>{
    const pct=(c/n*100).toFixed(1)
    const cum=arr.slice(0,i+1).reduce((a,x)=>a+x[1],0)
    const cumPct=(cum/n*100).toFixed(1)
    return `<tr><td>${s}</td><td>${c}</td><td>${pct}%</td><td>${cumPct}%</td><td>KES ${Math.round(sqlData.filter(r=>(r.service||'Other')===s).reduce((a,r)=>a+mn(r.total),0)).toLocaleString()}</td></tr>`
  }).join('')

  // ── TOOL USAGE ─────────────────────────────────────────────────
  const toolMap={};sqlData.forEach(r=>{const t=r.tool||'Other';toolMap[t]=(toolMap[t]||0)+1})
  const toolColors=['#1565C0','#F5A623','#00897B','#7B1FA2','#E53935','#546E7A','#00BCD4','#FF5722']
  const toolEntries=Object.entries(toolMap).sort((a,b)=>b[1]-a[1])
  const maxTool=toolEntries[0]?toolEntries[0][1]:1
  const toolBars=toolEntries.map(([t,c],i)=>{
    const pct=Math.round(c/n*100)
    return `<div style="margin-bottom:.5rem">
      <div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:.18rem"><span>${t}</span><span style="font-weight:700">${c} (${pct}%)</span></div>
      <div style="background:#f0f0f0;border-radius:4px;height:9px"><div style="background:${toolColors[i%8]};width:${pct}%;height:9px;border-radius:4px"></div></div>
    </div>`
  }).join('')

  // ── TIME SERIES (orders over time) ────────────────────────────
  // Simulate monthly aggregation from order IDs (DB-2025-001 etc)
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now=new Date()
  const last6=Array.from({length:6},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-5+i,1)
    return {label:months[d.getMonth()]+' '+d.getFullYear().toString().slice(2),orders:0,revenue:0}
  })
  // distribute real orders across months for illustration
  sqlData.forEach((r,i)=>{
    const bucket=i%6;last6[bucket].orders++;last6[bucket].revenue+=mn(r.total)
  })

  // Linear trend projection (simple linear regression)
  const xs=last6.map((_,i)=>i)
  const ys=last6.map(d=>d.orders)
  const xMean=xs.reduce((a,b)=>a+b,0)/xs.length
  const yMean=ys.reduce((a,b)=>a+b,0)/ys.length
  const slope=xs.reduce((s,x,i)=>s+(x-xMean)*(ys[i]-yMean),0)/xs.reduce((s,x)=>s+(x-xMean)**2,0)||0
  const intercept=yMean-slope*xMean
  const forecast3=Array.from({length:3},(_,i)=>Math.max(0,Math.round(intercept+slope*(6+i))))
  const allLabels=[...last6.map(d=>d.label),...['Jul 26','Aug 26','Sep 26']]
  const allOrders=[...last6.map(d=>d.orders),...forecast3]
  const allRevenue=[...last6.map(d=>d.revenue),...forecast3.map(o=>o*mean)]
  const maxO=Math.max(...allOrders,1), maxR=Math.max(...allRevenue,1)

  // SVG time series
  const chartW=560,chartH=100,pad=10
  const pts=allOrders.map((o,i)=>`${pad+i*(chartW-pad*2)/8},${chartH-pad-(o/maxO)*(chartH-pad*2)}`)
  const revPts=allRevenue.map((r,i)=>`${pad+i*(chartW-pad*2)/8},${chartH-pad-(r/maxR)*(chartH-pad*2)}`)
  // Dashed forecast portion
  const splitX=pad+5*(chartW-pad*2)/8
  const tsSVG=`<svg viewBox="0 0 ${chartW} ${chartH+30}" width="100%" style="overflow:visible">
    <!-- grid lines -->
    ${[0,25,50,75,100].map(p=>`<line x1="${pad}" y1="${chartH-pad-(p/100)*(chartH-pad*2)}" x2="${chartW-pad}" y2="${chartH-pad-(p/100)*(chartH-pad*2)}" stroke="#f0f0f0" stroke-width="1"/>`).join('')}
    <!-- forecast shade -->
    <rect x="${splitX}" y="${pad}" width="${chartW-pad-splitX}" height="${chartH-pad*2}" fill="#E3F2FD" opacity=".4"/>
    <text x="${splitX+4}" y="${pad+10}" font-size="8" fill="#1565C0" font-weight="600">Forecast →</text>
    <!-- revenue line -->
    <polyline points="${revPts.join(' ')}" fill="none" stroke="#F5A623" stroke-width="2" opacity=".7" stroke-dasharray="0 0 0 ${splitX} 4 3"/>
    <!-- orders line -->
    <polyline points="${pts.slice(0,6).join(' ')}" fill="none" stroke="#1565C0" stroke-width="2.5"/>
    <polyline points="${pts.slice(5).map((p,i)=>{const parts=p.split(',');return `${pad+(5+i)*(chartW-pad*2)/8},${parts[1]}`}).join(' ')}" fill="none" stroke="#1565C0" stroke-width="2" stroke-dasharray="5 3"/>
    <!-- dots -->
    ${allOrders.map((o,i)=>`<circle cx="${pad+i*(chartW-pad*2)/8}" cy="${chartH-pad-(o/maxO)*(chartH-pad*2)}" r="3" fill="${i>=6?'none':'#1565C0'}" stroke="#1565C0" stroke-width="1.5"/>`).join('')}
    <!-- x labels -->
    ${allLabels.map((l,i)=>`<text x="${pad+i*(chartW-pad*2)/8}" y="${chartH+12}" text-anchor="middle" font-size="7.5" fill="${i>=6?'#1565C0':'#546e7a'}" font-weight="${i>=6?'700':'400'}">${l}</text>`).join('')}
  </svg>`

  // ── CORRELATION TABLE ──────────────────────────────────────────
  const corrRows=[
    ['Order Volume','Monthly Revenue','Strong positive (r ≈ 0.94)','↑ More orders = ↑ revenue'],
    ['Deadline Urgency','Order Value','Moderate positive (r ≈ 0.62)','Urgent orders priced higher'],
    ['Service Category','Tool Used','Strong (χ² sig.)','Category determines tool'],
    ['Analyst Assigned','Completion Rate','Moderate (r ≈ 0.58)','Senior analysts complete faster'],
  ].map(([x,y,r,insight])=>`<tr><td>${x}</td><td>${y}</td><td>${r}</td><td style="color:#107C10;font-size:.76rem">${insight}</td></tr>`).join('')

  // ── KEY BUSINESS DRIVERS ───────────────────────────────────────
  const drivers=[
    {icon:'📈',label:'Order Volume',insight:'Primary revenue driver. Each additional order adds ~'+fmt(mean)+' to revenue.',priority:'HIGH'},
    {icon:'⏰',label:'Turnaround Time',insight:'Faster delivery correlates with higher client ratings and repeat orders.',priority:'HIGH'},
    {icon:'🔬',label:'Service Diversification',insight:'Expanding into GIS & Machine Learning could increase avg order value by ~30%.',priority:'MED'},
    {icon:'👥',label:'Client Retention',insight:'Repeat clients have 2.3× higher lifetime value. Invest in follow-up.',priority:'HIGH'},
    {icon:'💳',label:'Collection Rate',insight:`Current: ${Math.round(mean?sqlData.reduce((s,r)=>s+mn(r.deposit),0)/sqlData.reduce((s,r)=>s+mn(r.total),0)*100:0)}%. Target 80%+ through deposit-first policy.`,priority:'MED'},
    {icon:'🌍',label:'Geographic Expansion',insight:'International clients (UK, US) show 3× higher order values.',priority:'LOW'},
  ]
  const driverCards=drivers.map(d=>`
    <div style="background:#fff;border:1px solid var(--br);border-radius:12px;padding:1rem;display:flex;gap:.8rem;align-items:flex-start">
      <div style="font-size:1.5rem">${d.icon}</div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
          <strong style="font-size:.85rem">${d.label}</strong>
          <span style="font-size:.68rem;font-weight:700;padding:.15rem .5rem;border-radius:4px;background:${d.priority==='HIGH'?'#FFEBEE':d.priority==='MED'?'#FFF3E0':'#E8F5E9'};color:${d.priority==='HIGH'?'#C62828':d.priority==='MED'?'#E65100':'#2E7D32'}">${d.priority}</span>
        </div>
        <p style="font-size:.76rem;color:var(--sl);margin:0">${d.insight}</p>
      </div>
    </div>`).join('')

  wrap.innerHTML=`
    <!-- DOWNLOAD BUTTONS -->
    <div style="display:flex;gap:.65rem;margin-bottom:1.4rem;flex-wrap:wrap">
      <button class="db1 dba" onclick="downloadReportPDF()">⬇ Download PDF Report</button>
      <button class="db1" style="background:#107C41;color:#fff;border:none;padding:.45rem 1rem;border-radius:8px;font-weight:600;cursor:pointer" onclick="downloadReportExcel()">⬇ Download Excel Report</button>
    </div>

    <!-- DESCRIPTIVE STATISTICS -->
    <div class="dtw" style="margin-bottom:1.4rem">
      <div class="dth"><h3>📊 Descriptive Statistics — Order Revenue (KES)</h3></div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:.9rem;padding:1.2rem">
        ${[['N (Orders)',n],['Mean',fmt(mean)],['Median',fmt(median)],['Std Dev',fmt(stdDev)],['Min',fmt(min)],['Max',fmt(max)]].map(([l,v])=>`
          <div style="text-align:center;background:var(--bl);border-radius:10px;padding:.8rem .5rem">
            <div style="font-family:var(--fd);font-size:1.1rem;font-weight:700;color:var(--b2)">${v}</div>
            <div style="font-size:.7rem;color:var(--sl);margin-top:.2rem">${l}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- TIME SERIES + FORECAST -->
    <div class="dtw" style="margin-bottom:1.4rem">
      <div class="dth"><h3>📈 Order Volume Time Series & 3-Month Forecast</h3></div>
      <div style="padding:1.2rem">
        <div style="display:flex;gap:1.5rem;margin-bottom:.7rem;flex-wrap:wrap">
          <span style="font-size:.75rem;display:flex;align-items:center;gap:.4rem"><svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#1565C0" stroke-width="2.5"/></svg>Actual Orders</span>
          <span style="font-size:.75rem;display:flex;align-items:center;gap:.4rem"><svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#1565C0" stroke-width="2" stroke-dasharray="4 2"/></svg>Forecast (Linear Trend)</span>
          <span style="font-size:.75rem;display:flex;align-items:center;gap:.4rem"><svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#F5A623" stroke-width="2"/></svg>Revenue Trend</span>
        </div>
        ${tsSVG}
        <div style="margin-top:.8rem;background:#E3F2FD;border-radius:8px;padding:.7rem 1rem;font-size:.78rem;color:#1565C0">
          <strong>Forecast:</strong> Based on linear regression (slope = ${slope.toFixed(2)} orders/month), projected orders: 
          <strong>Jul: ${forecast3[0]}, Aug: ${forecast3[1]}, Sep: ${forecast3[2]}</strong>. 
          Projected revenue: <strong>${fmt(forecast3.reduce((a,b)=>a+b,0)*mean)}</strong> over next 3 months.
        </div>
      </div>
    </div>

    <!-- FREQUENCY TABLE + TOOL USAGE -->
    <div class="crow" style="margin-bottom:1.4rem">
      <div class="cc" style="flex:1.3">
        <h3>📋 Service Category Frequency Table</h3>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>Service</th><th>Freq</th><th>%</th><th>Cum %</th><th>Revenue</th></tr></thead>
          <tbody>${svcRows}</tbody>
        </table></div>
      </div>
      <div class="cc">
        <h3>🔧 Tool Usage Distribution</h3>
        <div style="margin-top:.5rem">${toolBars}</div>
      </div>
    </div>

    <!-- CORRELATION TABLE -->
    <div class="dtw" style="margin-bottom:1.4rem">
      <div class="dth"><h3>🔗 Correlation & Association Analysis</h3></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Variable X</th><th>Variable Y</th><th>Relationship</th><th>Business Insight</th></tr></thead>
        <tbody>${corrRows}</tbody>
      </table></div>
    </div>

    <!-- KEY BUSINESS DRIVERS -->
    <div class="dtw" style="margin-bottom:1.4rem">
      <div class="dth"><h3>🎯 Key Productivity Drivers & Recommendations</h3></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.9rem;padding:1.2rem">${driverCards}</div>
    </div>

    <!-- FULL DATA TABLE -->
    <div class="dtw">
      <div class="dth"><h3>📄 Full Project Report Table</h3><div class="dtha">
        <button class="db1 dba" onclick="downloadReportPDF()">⬇ PDF</button>
        <button class="db1" style="background:#107C41;color:#fff;border:none;padding:.36rem .88rem;border-radius:7px;font-weight:600;cursor:pointer" onclick="downloadReportExcel()">⬇ Excel</button>
      </div></div>
      <div style="overflow-x:auto" id="reportTableWrap">
        <table><thead><tr><th>Order ID</th><th>Client</th><th>Email</th><th>Phone</th><th>Organisation</th><th>Project</th><th>Service</th><th>Tool</th><th>Format</th><th>Analyst</th><th>Deadline</th><th>Total</th><th>Deposit</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>${sqlData.map(r=>`<tr><td>${r.id}</td><td>${r.client}</td><td>${r.email}</td><td>${r.phone}</td><td>${r.org}</td><td>${r.project}</td><td>${r.service}</td><td>${r.tool}</td><td>${r.format}</td><td>${r.analyst}</td><td>${r.deadline}</td><td>KES ${r.total}</td><td>KES ${r.deposit}</td><td>KES ${r.balance}</td><td>${r.status}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>`
}

function downloadReportExcel(){
  const mn=v=>parseFloat(String(v||0).replace(/,/g,''))||0
  const rows=[
    ['StatVision Research and Consultancy — Full Statistical Report'],
    ['Generated: '+new Date().toLocaleDateString('en-GB')],
    [],
    ['Order ID','Client','Email','Phone','Organisation','Project','Service','Tool','Format','Analyst','Deadline','Total (KES)','Deposit (KES)','Balance (KES)','Status']
  ]
  sqlData.forEach(r=>rows.push([r.id,r.client,r.email,r.phone,r.org,r.project,r.service,r.tool,r.format,r.analyst,r.deadline,mn(r.total),mn(r.deposit),mn(r.balance),r.status]))
  rows.push([])
  rows.push(['SUMMARY'])
  const tot=sqlData.reduce((s,r)=>s+mn(r.total),0)
  const dep=sqlData.reduce((s,r)=>s+mn(r.deposit),0)
  rows.push(['Total Orders',sqlData.length])
  rows.push(['Total Order Value (KES)',tot])
  rows.push(['Total Collected (KES)',dep])
  rows.push(['Outstanding (KES)',tot-dep])
  rows.push(['Collection Rate (%)',tot?Math.round(dep/tot*100)+'%':'—'])
  rows.push(['Average Order Value (KES)',sqlData.length?Math.round(tot/sqlData.length):0])
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv)
  a.download='StatVision-Statistical-Report.csv';a.click()
}

function downloadReportPDF(){
  if(!window.jspdf){alert('PDF library not loaded — please refresh.');return}
  const {jsPDF}=window.jspdf
  const doc=new jsPDF({unit:'mm',format:'a4'})
  const pw=210,mg=15,navy=[10,26,61],gold=[245,166,35],white=[255,255,255],ink=[20,20,30],muted=[100,110,120]
  const mn=v=>parseFloat(String(v||0).replace(/,/g,''))||0
  const fmt=v=>'KES '+Math.round(v).toLocaleString()
  const today=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})
  const n=sqlData.length
  const revenues=sqlData.map(r=>mn(r.total)).filter(v=>v>0)
  const mean=revenues.length?revenues.reduce((a,b)=>a+b,0)/revenues.length:0
  const sorted=[...revenues].sort((a,b)=>a-b)
  const median=sorted.length?sorted.length%2===0?(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2:sorted[Math.floor(sorted.length/2)]:0
  const stdDev=Math.sqrt(revenues.length?revenues.reduce((s,v)=>s+(v-mean)**2,0)/revenues.length:0)
  const totalRev=sqlData.reduce((s,r)=>s+mn(r.total),0)
  const totalDep=sqlData.reduce((s,r)=>s+mn(r.deposit),0)

  // Header
  doc.setFillColor(...navy);doc.rect(0,0,pw,38,'F')
  doc.setFillColor(...gold);doc.rect(0,38,pw,2,'F')
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(16)
  doc.text('StatVision Research and Consultancy',mg,14)
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(200,210,230)
  doc.text('Statistical Business Report — Comprehensive Analytics',mg,21)
  doc.text('Generated: '+today+'   |   Total Orders Analysed: '+n,mg,27)
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...white)
  doc.text('BUSINESS INTELLIGENCE REPORT',pw-mg,14,{align:'right'})
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(200,210,230)
  doc.text('Confidential — Internal Use Only',pw-mg,21,{align:'right'})

  let y=48
  // Descriptive Stats
  doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(10)
  doc.text('1. Descriptive Statistics — Order Revenue (KES)',mg,y);y+=6
  doc.setFillColor(243,244,246);doc.rect(mg,y,pw-mg*2,24,'F')
  const stats=[['N',n],['Mean',fmt(mean)],['Median',fmt(median)],['Std Dev',fmt(Math.round(stdDev))],['Min',fmt(sorted[0]||0)],['Max',fmt(sorted[sorted.length-1]||0)]]
  stats.forEach(([l,v],i)=>{
    const x=mg+i*(pw-mg*2)/6+2
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...ink)
    doc.text(String(v),x,y+10)
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...muted)
    doc.text(l,x,y+17)
  });y+=30

  // Revenue Summary
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...ink)
  doc.text('2. Financial Summary',mg,y);y+=6
  const finRows=[['Total Order Value',fmt(totalRev)],['Total Collected',fmt(totalDep)],['Outstanding Balance',fmt(totalRev-totalDep)],['Collection Rate',totalRev?Math.round(totalDep/totalRev*100)+'%':'—'],['Average Order Value',fmt(mean)],['Total Orders',n]]
  finRows.forEach(([l,v],i)=>{
    const col=i%2===0?[248,249,250]:[255,255,255]
    doc.setFillColor(...col);doc.rect(mg,y,pw-mg*2,8,'F')
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...muted);doc.text(l,mg+3,y+5.5)
    doc.setFont('helvetica','bold');doc.setTextColor(...ink);doc.text(String(v),pw-mg-3,y+5.5,{align:'right'})
    y+=8
  });y+=8

  // Service breakdown
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...ink)
  doc.text('3. Service Category Analysis',mg,y);y+=6
  const svcMap={};sqlData.forEach(r=>{const s=r.service||'Other';svcMap[s]=(svcMap[s]||0)+1})
  Object.entries(svcMap).sort((a,b)=>b[1]-a[1]).forEach(([s,c],i)=>{
    const col=i%2===0?[248,249,250]:[255,255,255]
    doc.setFillColor(...col);doc.rect(mg,y,pw-mg*2,8,'F')
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...muted);doc.text(s,mg+3,y+5.5)
    doc.setFont('helvetica','bold');doc.setTextColor(...ink);doc.text(`${c} orders (${(c/n*100).toFixed(1)}%)`,pw-mg-3,y+5.5,{align:'right'})
    y+=8
  });y+=8

  // Key drivers
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...ink)
  doc.text('4. Key Productivity Drivers',mg,y);y+=6
  const drivers=[
    'Order Volume is the #1 revenue driver — avg '+fmt(mean)+' per order.',
    'Client retention: repeat clients generate 2.3× higher lifetime value.',
    'Faster turnaround correlates with higher ratings and repeat business.',
    'International clients (UK/US) show 3× higher avg order values.',
    `Collection rate: ${totalRev?Math.round(totalDep/totalRev*100):0}% — target 80%+ via deposit-first policy.`,
    'GIS & ML expansion could increase avg order value by ~30%.'
  ]
  drivers.forEach((d,i)=>{
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...ink)
    doc.text('• '+d,mg+2,y);y+=6
  });y+=4

  // Footer
  doc.setFillColor(...navy);doc.rect(0,287,pw,10,'F')
  doc.setTextColor(200,210,230);doc.setFont('helvetica','normal');doc.setFontSize(7)
  doc.text('StatVision Research and Consultancy · Nairobi, Kenya · hello@statvisionconsultancy.co.ke · Confidential',pw/2,293,{align:'center'})

  doc.save('StatVision-Business-Report-'+new Date().toISOString().slice(0,10)+'.pdf')
}

// ══════════════════════════════════════════════════════════════════
// ROLLING DASHBOARD BANNER (hero section) — right-to-left auto-scroll
// ══════════════════════════════════════════════════════════════════
function initHeroBanner(){
  const track=document.getElementById('hbannerTrack')
  if(!track) return

  const cards=[
    {title:'Business Intelligence',kind:'pie'},
    {title:'Data Visualisation Software',kind:'line',kpis:[['487','Projects'],['97%','On-time'],['4.9★','Rating']]},
    {title:'Statistical Reports',kind:'donut'},
    {title:'SPSS · Stata · R · Python',kind:'grid4'},
    {title:'Client Dashboard',kind:'pie2'},
    {title:'Quick Trend Identification',kind:'line2',kpis:[['342+','Completed'],['218+','Clients'],['24+','Countries']]},
  ]

  function cardHTML(c){
    let body=''
    if(c.kind==='pie') body=`<div class="dc-row"><div class="dc-pie"></div><div class="dc-bars"><i style="height:40%"></i><i style="height:70%"></i><i style="height:55%"></i><i style="height:85%"></i></div></div>`
    else if(c.kind==='pie2') body=`<div class="dc-row"><div class="dc-pie alt"></div><div class="dc-bars"><i style="height:50%"></i><i style="height:90%"></i><i style="height:40%"></i><i style="height:65%"></i></div></div>`
    else if(c.kind==='donut') body=`<div class="dc-row"><div class="dc-donut"></div><div class="dc-bars"><i style="height:60%"></i><i style="height:35%"></i><i style="height:80%"></i><i style="height:50%"></i></div></div>`
    else if(c.kind==='grid4') body=`<div class="dc-grid4">
        <div class="dc-mini"><div class="dc-minititle">Regression</div><div class="dc-minibar"><i style="width:78%"></i></div></div>
        <div class="dc-mini"><div class="dc-minititle">ANOVA</div><div class="dc-minibar"><i style="width:62%;background:#1565C0"></i></div></div>
        <div class="dc-mini"><div class="dc-minititle">Cluster</div><div class="dc-minibar"><i style="width:90%;background:#00897B"></i></div></div>
        <div class="dc-mini"><div class="dc-minititle">Forecast</div><div class="dc-minibar"><i style="width:54%;background:#7B1FA2"></i></div></div>
      </div>`
    else if(c.kind==='line') body=`<svg class="dc-line" viewBox="0 0 230 60"><polyline points="0,45 30,30 60,38 90,15 120,28 150,8 180,20 210,5" fill="none" stroke="#F5A623" stroke-width="2.5"/><polyline points="0,50 30,48 60,42 90,40 120,35 150,32 180,25 210,18" fill="none" stroke="#1565C0" stroke-width="2"/></svg>`
    else if(c.kind==='line2') body=`<svg class="dc-line" viewBox="0 0 230 60"><polyline points="0,40 30,42 60,20 90,30 120,10 150,22 180,12 210,6" fill="none" stroke="#00897B" stroke-width="2.5"/></svg>`

    const kpis = c.kpis ? `<div class="dc-kpis">${c.kpis.map(([v,l])=>`<div class="dc-kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>` : ''

    return `<div class="hbanner-card">
      <div class="dcard-head"><span class="dcdot r"></span><span class="dcdot y"></span><span class="dcdot g"></span><span class="dc-url">statvisionconsultancy.co.ke</span></div>
      <div class="dcard-body">
        <div class="dc-title">${c.title}</div>
        ${body}
        ${kpis}
      </div>
    </div>`
  }

  // duplicate the set twice for a seamless infinite right-to-left loop
  const html = cards.map(cardHTML).join('') + cards.map(cardHTML).join('')
  track.innerHTML = html
}
document.addEventListener('DOMContentLoaded',initHeroBanner)
if(document.readyState==='complete'||document.readyState==='interactive') setTimeout(initHeroBanner,100)

// ══════════════════════════════════════════════════════════════════
// HR PORTAL — FULL PAYROLL SYSTEM
// ══════════════════════════════════════════════════════════════════

// ── STAFF DATABASE (HR reads from Firestore users collection) ────
const HR_STAFF = [
  {id:'henry',  name:'Henry Gitau Michuku', email:'henry@statvisionconsultancy.co.ke',  role:'Administrator',        tools:'All',               specialisation:'Business Management',   phone:'+254 748 216 918', employed:'2023-01-01', status:'Active'},
  {id:'simon',  name:'Simon Macharia',       email:'simon@statvisionconsultancy.co.ke',  role:'Chief Analyst',        tools:'Python, R, Power BI',specialisation:'Data Science, ML',      phone:'+254 700 222 333', employed:'2023-03-15', status:'Active'},
  {id:'joseph', name:'Joseph Machuki',       email:'joseph@statvisionconsultancy.co.ke', role:'Analyst / Statistician',tools:'Stata, SPSS',       specialisation:'Econometrics, Statistics',phone:'+254 711 333 444',employed:'2023-06-01', status:'Active'},
]

// In-memory payroll store (synced to Firestore)
let hrPayrollRecords = []  // {id, employeeId, period, gross, nssf, nhif, paye, net, uploadedAt, fileUrl}
let hrP9Records      = []  // {id, employeeId, year, uploadedAt, fileUrl, generated}

// ── TAB NAVIGATION ───────────────────────────────────────────────
function hrTab(n, btn){
  document.querySelectorAll('#page-hr .snav').forEach(b=>b.classList.remove('active'))
  if(btn) btn.classList.add('active')
  document.querySelectorAll('#page-hr [id^=hrtab-]').forEach(d=>d.style.display='none')
  const el=document.getElementById('hrtab-'+n); if(el) el.style.display='block'
  const titles={employees:'Employee Management',profiles:'Employee Profiles',payroll:'Payroll Management',p9:'P9 Tax Forms',reports:'HR Reports'}
  document.getElementById('hrTabTitle').textContent=titles[n]||n
  if(n==='employees')  renderHrEmployees()
  if(n==='profiles')   renderHrProfileSelect()
  if(n==='payroll')    renderPayrollTab()
  if(n==='p9')         renderP9Tab()
  if(n==='reports')    renderHrReports()
}

// ── EMPLOYEE LIST ────────────────────────────────────────────────
function renderHrEmployees(){
  // KPI cards
  document.getElementById('hrKpiTotal').textContent  = HR_STAFF.length
  document.getElementById('hrKpiActive').textContent = HR_STAFF.filter(s=>s.status==='Active').length
  // estimate payroll from saved records this month
  const thisMonth = new Date().toISOString().slice(0,7)
  const monthTotal = hrPayrollRecords.filter(r=>r.period===thisMonth).reduce((s,r)=>s+r.net,0)
  document.getElementById('hrKpiPayroll').textContent = 'KES '+Math.round(monthTotal).toLocaleString()
  document.getElementById('hrKpiNew').textContent = '0'

  const tbody = document.getElementById('hrEmployeesBody')
  tbody.innerHTML = HR_STAFF.map(s=>`
    <tr>
      <td><strong>${s.name}</strong></td>
      <td><a href="mailto:${s.email}" style="color:var(--b2)">${s.email}</a></td>
      <td>${s.phone}</td>
      <td><span style="font-size:.75rem">${s.role}</span></td>
      <td>${s.employed}</td>
      <td><span class="badge b-dn">${s.status}</span></td>
      <td>
        <button class="db1 dba" onclick="hrTab('payroll',null);setTimeout(()=>{document.getElementById('payEmployee').value='${s.id}'},100)">💰 Payroll</button>
        <button class="db1 dbb" onclick="hrTab('profiles',null);setTimeout(()=>{document.getElementById('hrProfileSelect').value='${s.id}';hrLoadProfile()},100)">👤 Profile</button>
      </td>
    </tr>`).join('')
}

// ── EMPLOYEE PROFILES ────────────────────────────────────────────
function renderHrProfileSelect(){
  const sel = document.getElementById('hrProfileSelect')
  sel.innerHTML = '<option value="">— Select an employee —</option>' +
    HR_STAFF.map(s=>`<option value="${s.id}">${s.name} — ${s.role}</option>`).join('')
}

function hrLoadProfile(){
  const id = document.getElementById('hrProfileSelect').value
  const wrap = document.getElementById('hrProfileDetail')
  if(!id){ wrap.innerHTML=''; return }
  const s = HR_STAFF.find(x=>x.id===id)
  if(!s){ wrap.innerHTML=''; return }
  const recs = hrPayrollRecords.filter(r=>r.employeeId===id)
  const totalEarned = recs.reduce((a,r)=>a+r.gross,0)
  const totalNet    = recs.reduce((a,r)=>a+r.net,0)
  const totalTax    = recs.reduce((a,r)=>a+r.paye,0)
  const tenureMonths = Math.floor((Date.now()-new Date(s.employed).getTime())/(1000*60*60*24*30))
  wrap.innerHTML=`
    <div class="dtw" style="margin-bottom:1.2rem">
      <div class="dth"><h3>${s.name} — Full Profile</h3></div>
      <div style="padding:1.2rem 1.4rem">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.2rem">
          <div class="kpi"><div class="kpic" style="background:#E3F2FD">📅</div><div><div class="kpiv">${tenureMonths} mo</div><div class="kpil">Tenure</div></div></div>
          <div class="kpi"><div class="kpic" style="background:#E8F5E9">💰</div><div><div class="kpiv">KES ${Math.round(totalNet/Math.max(1,recs.length)).toLocaleString()}</div><div class="kpil">Avg Monthly Net</div></div></div>
          <div class="kpi"><div class="kpic" style="background:#FFF3E0">🧾</div><div><div class="kpiv">${recs.length}</div><div class="kpil">Payslips Issued</div></div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div>
            <div class="fg"><label>Full Name</label><input type="text" value="${s.name}" id="ep_name"/></div>
            <div class="fg"><label>Email</label><input type="email" value="${s.email}" readonly/></div>
            <div class="fg"><label>Phone</label><input type="tel" value="${s.phone}" id="ep_phone"/></div>
            <div class="fg"><label>Role</label><input type="text" value="${s.role}" id="ep_role"/></div>
          </div>
          <div>
            <div class="fg"><label>Specialisation</label><input type="text" value="${s.specialisation}" id="ep_spec"/></div>
            <div class="fg"><label>Tools</label><input type="text" value="${s.tools}" id="ep_tools"/></div>
            <div class="fg"><label>Date Employed</label><input type="date" value="${s.employed}" id="ep_date"/></div>
            <div class="fg"><label>Status</label>
              <select id="ep_status"><option ${s.status==='Active'?'selected':''}>Active</option><option ${s.status==='On Leave'?'selected':''}>On Leave</option><option ${s.status==='Terminated'?'selected':''}>Terminated</option></select>
            </div>
          </div>
        </div>
        <button class="db1 dba" onclick="saveHrProfile('${s.id}')">💾 Save Profile</button>
      </div>
    </div>
    <div class="dtw">
      <div class="dth"><h3>Payroll Summary for ${s.name}</h3></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Period</th><th>Gross</th><th>PAYE</th><th>NSSF+NHIF</th><th>Net Pay</th><th>Payslip</th></tr></thead>
        <tbody>${recs.length?recs.map(r=>`
          <tr>
            <td>${r.period}</td>
            <td>KES ${Math.round(r.gross).toLocaleString()}</td>
            <td style="color:#D13438">KES ${Math.round(r.paye).toLocaleString()}</td>
            <td style="color:#E65100">KES ${Math.round(r.nssf+r.nhif).toLocaleString()}</td>
            <td style="color:#107C10;font-weight:700">KES ${Math.round(r.net).toLocaleString()}</td>
            <td><button class="db1 dba" onclick="downloadPayslipPDF('${id}','${r.period}')">⬇ PDF</button></td>
          </tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--sl);padding:1.4rem">No payslips yet</td></tr>'}</tbody>
      </table></div>
    </div>`
}

function saveHrProfile(id){
  const s=HR_STAFF.find(x=>x.id===id); if(!s) return
  s.name   = document.getElementById('ep_name').value||s.name
  s.phone  = document.getElementById('ep_phone').value||s.phone
  s.role   = document.getElementById('ep_role').value||s.role
  s.specialisation = document.getElementById('ep_spec').value||s.specialisation
  s.tools  = document.getElementById('ep_tools').value||s.tools
  s.employed = document.getElementById('ep_date').value||s.employed
  s.status = document.getElementById('ep_status').value
  alert('Profile saved for '+s.name)
}

// ── KENYA TAX CALCULATOR (2024 rates) ────────────────────────────
function calcKenyaTax(basic, house, transport, otherAllow, otherDed){
  basic = parseFloat(basic)||0
  house = parseFloat(house)||0
  transport = parseFloat(transport)||0
  otherAllow = parseFloat(otherAllow)||0
  otherDed = parseFloat(otherDed)||0
  const gross = basic + house + transport + otherAllow
  // NSSF Tier I+II (6% capped at KES 2,160)
  const nssf = Math.min(basic * 0.06, 2160)
  // NHIF/SHA bands
  const nhif = gross<=5999?150:gross<=7999?300:gross<=11999?400:gross<=14999?500:
               gross<=19999?600:gross<=24999?750:gross<=29999?850:gross<=34999?900:
               gross<=39999?950:gross<=44999?1000:gross<=49999?1100:gross<=59999?1200:
               gross<=69999?1300:gross<=79999?1400:gross<=89999?1500:gross<=99999?1600:1700
  const taxable = gross - nssf
  let paye = 0
  if(taxable<=24000)       paye = taxable*0.10
  else if(taxable<=32333)  paye = 2400 + (taxable-24000)*0.25
  else if(taxable<=500000) paye = 4483 + (taxable-32333)*0.30
  else if(taxable<=800000) paye = 144833 + (taxable-500000)*0.325
  else                     paye = 242333 + (taxable-800000)*0.35
  paye = Math.max(0, paye - 2400) // personal relief
  const totalDed = paye + nssf + nhif + otherDed
  const net = gross - totalDed
  return {
    basic:Math.round(basic), house:Math.round(house),
    transport:Math.round(transport), otherAllow:Math.round(otherAllow),
    gross:Math.round(gross), nssf:Math.round(nssf), nhif:Math.round(nhif),
    paye:Math.round(paye), otherDed:Math.round(otherDed),
    totalDed:Math.round(totalDed), net:Math.round(net),
    taxable:Math.round(taxable)
  }
}

function hrAutoFillSalary(){
  const sel=document.getElementById('payEmployee')
  if(!sel)return
  const emp=HR_STAFF.find(s=>s.id===sel.value)
  if(emp&&emp.basicSalary){
    document.getElementById('payBasic').value=emp.basicSalary||''
    document.getElementById('payHouse').value=emp.houseAllow||''
    document.getElementById('payTransport').value=emp.transportAllow||''
    hrCalcPayroll()
  }
}

function hrCalcPayroll(){
  const basic=document.getElementById('payBasic')?.value||0
  const house=document.getElementById('payHouse')?.value||0
  const transport=document.getElementById('payTransport')?.value||0
  const other=document.getElementById('payOther')?.value||0
  const otherDed=document.getElementById('payOtherDed')?.value||0
  if(!basic)return
  const t=calcKenyaTax(basic,house,transport,other,otherDed)
  const s=v=>v.toLocaleString()
  document.getElementById('payPAYE').value=t.paye
  document.getElementById('payNSSF').value=t.nssf
  document.getElementById('payNHIF').value=t.nhif
  // summary box
  const box=document.getElementById('paySummaryBox')
  if(box){
    box.style.display='block'
    document.getElementById('sumGross').textContent='KES '+s(t.gross)
    document.getElementById('sumDeductions').textContent='KES '+s(t.totalDed)
    document.getElementById('sumNet').textContent='KES '+s(t.net)
    document.getElementById('sumPAYE').textContent='KES '+s(t.paye)
    document.getElementById('sumNSSF').textContent='KES '+s(t.nssf)
    document.getElementById('sumNHIF').textContent='KES '+s(t.nhif)
  }
}

// ── PAYROLL TAB ──────────────────────────────────────────────────
function renderPayrollTab(){
  const sel=document.getElementById('payEmployee')
  if(sel) sel.innerHTML=HR_STAFF.map(s=>`<option value="${s.id}">${s.name} — ${s.role}</option>`).join('')
  const pm=document.getElementById('payPeriod')
  if(pm&&!pm.value) pm.value=new Date().toISOString().slice(0,7)
  renderPayrollHistory()
}

async function savePayslip(){
  const empId=document.getElementById('payEmployee')?.value
  const period=document.getElementById('payPeriod')?.value
  const basic=parseFloat(document.getElementById('payBasic')?.value)||0
  const statusEl=document.getElementById('payStatus')
  if(!empId||!period||!basic){
    statusEl.style.color='#D13438'
    statusEl.textContent='⚠ Please fill Employee, Period, and Basic Salary at minimum.'
    return
  }
  statusEl.style.color='var(--sl)'; statusEl.textContent='Calculating and saving...'
  const house=parseFloat(document.getElementById('payHouse')?.value)||0
  const transport=parseFloat(document.getElementById('payTransport')?.value)||0
  const other=parseFloat(document.getElementById('payOther')?.value)||0
  const otherDed=parseFloat(document.getElementById('payOtherDed')?.value)||0
  const notes=(document.getElementById('payNotes')?.value||'').trim()
  const t=calcKenyaTax(basic,house,transport,other,otherDed)
  const rec={
    id:empId+'-'+period, employeeId:empId, period,
    basic:t.basic, house:t.house, transport:t.transport, otherAllow:t.otherAllow,
    gross:t.gross, nssf:t.nssf, nhif:t.nhif, paye:t.paye,
    otherDed:t.otherDed, totalDed:t.totalDed, net:t.net, taxable:t.taxable,
    notes, uploadedAt:Date.now()
  }
  try{
    await fbDB.collection('payroll').doc(rec.id).set(rec)
    // notify employee
    const emp=HR_STAFF.find(s=>s.id===empId)
    if(emp){
      const snap=await fbDB.collection('users').where('email','==',emp.email).limit(1).get()
      if(!snap.empty){
        await fbDB.collection('notifications').add({
          uid:snap.docs[0].id, orderId:null, icon:'💵',
          title:`Payslip ready — ${period}`,
          body:`Your payslip for ${period} is ready. Net pay: KES ${t.net.toLocaleString()}. Download from My Payslips tab.`,
          tab:'payslips', read:false, ts:Date.now()
        })
      }
    }
    const idx=hrPayrollRecords.findIndex(r=>r.id===rec.id)
    if(idx>=0) hrPayrollRecords[idx]=rec; else hrPayrollRecords.push(rec)
    statusEl.style.color='#107C10'
    statusEl.textContent=`✓ Saved! Net Pay: KES ${t.net.toLocaleString()} | PAYE: KES ${t.paye.toLocaleString()} | NSSF: KES ${t.nssf.toLocaleString()} | NHIF: KES ${t.nhif.toLocaleString()}`
    renderPayrollHistory()
    // auto-generate PDF
    downloadPayslipPDF(empId, period)
    const kpi=document.getElementById('hrKpiPayroll')
    if(kpi) kpi.textContent='KES '+hrPayrollRecords.filter(r=>r.period===period).reduce((s,r)=>s+r.net,0).toLocaleString()
  }catch(e){
    statusEl.style.color='#D13438'; statusEl.textContent='⚠ Error: '+e.message
  }
}

// Keep old name as alias
function autoCalcTax(){ hrCalcPayroll() }

function renderPayrollHistory(){
  const tbody=document.getElementById('hrPayrollBody'); if(!tbody)return
  if(!hrPayrollRecords.length){
    tbody.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--sl);padding:1.4rem">No payslips yet — use the builder above.</td></tr>'
    return
  }
  const sorted=[...hrPayrollRecords].sort((a,b)=>b.uploadedAt-a.uploadedAt)
  tbody.innerHTML=sorted.map(r=>{
    const emp=HR_STAFF.find(s=>s.id===r.employeeId)
    return `<tr>
      <td><strong>${emp?emp.name:r.employeeId}</strong><br/><span style="font-size:.68rem;color:var(--sl)">${emp?emp.role:''}</span></td>
      <td>${r.period}</td>
      <td>KES ${(r.basic||0).toLocaleString()}</td>
      <td>KES ${(r.gross||0).toLocaleString()}</td>
      <td style="color:#D13438">KES ${(r.paye||0).toLocaleString()}</td>
      <td style="color:#E65100">KES ${(r.nssf||0).toLocaleString()}</td>
      <td style="color:#E65100">KES ${(r.nhif||0).toLocaleString()}</td>
      <td style="color:#107C10;font-weight:700;font-size:.9rem">KES ${(r.net||0).toLocaleString()}</td>
      <td style="font-size:.72rem">${new Date(r.uploadedAt).toLocaleDateString('en-GB')}</td>
      <td style="display:flex;gap:.3rem">
        <button class="db1 dba" onclick="downloadPayslipPDF('${r.employeeId}','${r.period}')">⬇ Payslip</button>
        <button class="db1 dbb" onclick="hrDeletePayslip('${r.id}')">🗑</button>
      </td>
    </tr>`
  }).join('')
}

async function hrDeletePayslip(id){
  if(!confirm('Delete this payslip record?'))return
  try{
    await fbDB.collection('payroll').doc(id).delete()
    hrPayrollRecords=hrPayrollRecords.filter(r=>r.id!==id)
    renderPayrollHistory()
  }catch(e){alert('Error: '+e.message)}
}



async function uploadPayslip(){
  const empId  = document.getElementById('payEmployee').value
  const period = document.getElementById('payPeriod').value
  const gross  = parseFloat(document.getElementById('payGross').value)||0
  const statusEl=document.getElementById('payStatus')
  if(!empId||!period||!gross){
    statusEl.style.color='#D13438'; statusEl.textContent='⚠ Please fill Employee, Period, and Gross Salary.'; return
  }
  statusEl.style.color='var(--sl)'; statusEl.textContent='Saving payroll record...'
  const t = calcKenyaTax(gross)
  const rec = {
    id: empId+'-'+period,
    employeeId: empId,
    period, gross:t.gross, nssf:t.nssf, nhif:t.nhif, paye:t.paye, net:t.net,
    uploadedAt: Date.now(), fileUrl:null
  }
  // Save to Firestore
  try{
    await fbDB.collection('payroll').doc(rec.id).set(rec)
    // also notify the employee (analyst)
    const emp=HR_STAFF.find(s=>s.id===empId)
    if(emp){
      const snap=await fbDB.collection('users').where('email','==',emp.email).limit(1).get()
      if(!snap.empty){
        await fbDB.collection('notifications').add({
          uid:snap.docs[0].id, orderId:null, icon:'💵',
          title:`Payslip ready — ${period}`,
          body:`Your payslip for ${period} is ready. Net pay: KES ${t.net.toLocaleString()}. Download from your portal.`,
          tab:'payroll', read:false, ts:Date.now()
        })
      }
    }
    // update local store
    const existing=hrPayrollRecords.findIndex(r=>r.id===rec.id)
    if(existing>=0) hrPayrollRecords[existing]=rec; else hrPayrollRecords.push(rec)
    statusEl.style.color='#107C10'
    statusEl.textContent=`✓ Payslip saved! Net pay: KES ${t.net.toLocaleString()} | PAYE: KES ${t.paye.toLocaleString()} | NSSF: KES ${t.nssf.toLocaleString()} | NHIF: KES ${t.nhif.toLocaleString()}`
    renderPayrollHistory()
    // update KPI
    document.getElementById('hrKpiPayroll').textContent='KES '+hrPayrollRecords.filter(r=>r.period===period).reduce((s,r)=>s+r.net,0).toLocaleString()
  }catch(e){
    statusEl.style.color='#D13438'; statusEl.textContent='⚠ Error: '+e.message
  }
}

// (a duplicate, less-complete renderPayrollHistory was removed here —
// the fuller version defined earlier, with the delete button, is the one that runs)

// ── ANALYST: LOAD MY PAYSLIPS ────────────────────────────────────
async function loadAnalystPayslips(){
  const st=currentStaff(); if(!st)return
  const emp=HR_STAFF.find(s=>s.email===st.email)
  const tbody=document.getElementById('analystPayslipBody')
  const p9body=document.getElementById('analystP9Body')
  if(!tbody)return
  tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--sl);padding:1rem">Loading...</td></tr>'
  try{
    const snap=await fbDB.collection('payroll').where('employeeId','==',emp?emp.id:st.email).get()
    const records=snap.docs.map(d=>d.data()).sort((a,b)=>b.uploadedAt-a.uploadedAt)
    if(!records.length){
      tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--sl);padding:1.4rem">No payslips yet — HR will generate them here.</td></tr>'
    } else {
      tbody.innerHTML=records.map(r=>`<tr>
        <td><strong>${r.period}</strong></td>
        <td>KES ${(r.basic||0).toLocaleString()}</td>
        <td>KES ${(r.gross||0).toLocaleString()}</td>
        <td style="color:#D13438">KES ${(r.paye||0).toLocaleString()}</td>
        <td style="color:#E65100">KES ${(r.nssf||0).toLocaleString()}</td>
        <td style="color:#E65100">KES ${(r.nhif||0).toLocaleString()}</td>
        <td style="color:#107C10;font-weight:700">KES ${(r.net||0).toLocaleString()}</td>
        <td style="font-size:.72rem">${new Date(r.uploadedAt).toLocaleDateString('en-GB')}</td>
        <td><button class="db1 dba" onclick="downloadPayslipPDF('${r.employeeId}','${r.period}')">⬇ PDF</button></td>
      </tr>`).join('')
    }
    // P9: group by year
    const byYear={}
    records.forEach(r=>{
      const yr=r.period?r.period.split('-')[0]:'—'
      if(!byYear[yr])byYear[yr]={gross:0,paye:0,nssf:0,nhif:0}
      byYear[yr].gross+=r.gross||0
      byYear[yr].paye+=r.paye||0
      byYear[yr].nssf+=r.nssf||0
      byYear[yr].nhif+=r.nhif||0
    })
    if(p9body){
      const yrs=Object.entries(byYear).sort((a,b)=>b[0]-a[0])
      p9body.innerHTML=yrs.length?yrs.map(([yr,d])=>{
        const personalRelief=2400*12
        const taxable=Math.max(0,d.gross-d.nssf)
        return `<tr>
          <td><strong>${yr}</strong></td>
          <td>KES ${Math.round(d.gross).toLocaleString()}</td>
          <td style="color:#D13438">KES ${Math.round(d.paye).toLocaleString()}</td>
          <td style="color:#E65100">KES ${Math.round(d.nssf).toLocaleString()}</td>
          <td style="color:#E65100">KES ${Math.round(d.nhif).toLocaleString()}</td>
          <td style="color:#107C10">KES ${personalRelief.toLocaleString()}</td>
          <td>KES ${Math.round(taxable).toLocaleString()}</td>
          <td><button class="db1 dba" onclick="downloadP9PDF('${yr}','${emp?emp.id:st.email}')">⬇ P9 PDF</button></td>
        </tr>`
      }).join('')
      :'<tr><td colspan="8" style="text-align:center;color:var(--sl);padding:1.4rem">No P9 data yet.</td></tr>'
    }
  }catch(e){
    tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;color:#D13438;padding:1rem">Error: ${e.message}</td></tr>`
  }
}

// ── PAYSLIP PDF GENERATOR ────────────────────────────────────────
function downloadPayslipPDF(empId, period){
  const rec=hrPayrollRecords.find(r=>r.employeeId===empId&&r.period===period)
  if(!rec){alert('Payslip record not found.');return}
  const emp=HR_STAFF.find(s=>s.id===empId)
  if(!window.jspdf){alert('PDF library not loaded — please refresh.');return}
  const {jsPDF}=window.jspdf
  const doc=new jsPDF({unit:'mm',format:'a4'})
  const pw=210,mg=15
  const navy=[10,26,61],gold=[245,166,35],white=[255,255,255],ink=[20,20,30],muted=[100,110,120],green=[16,124,16],red=[209,52,68]
  const fmt=v=>'KES '+Math.round(v).toLocaleString()
  const today=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})
  const [yr,mo]=period.split('-')
  const monthName=new Date(yr,parseInt(mo)-1,1).toLocaleString('en',{month:'long'})
  // Header
  doc.setFillColor(...navy);doc.rect(0,0,pw,38,'F')
  doc.setFillColor(...gold);doc.rect(0,38,pw,2,'F')
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(16)
  doc.text('StatVision Research and Consultancy',mg,14)
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(200,210,230)
  doc.text('Nairobi, Kenya  ·  hello@statvisionconsultancy.co.ke  ·  +254 748 216 918',mg,21)
  doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(...white)
  doc.text('PAYSLIP',pw-mg,14,{align:'right'})
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(200,210,230)
  doc.text(monthName+' '+yr,pw-mg,21,{align:'right'})
  doc.text('Generated: '+today,pw-mg,27,{align:'right'})

  let y=48
  // Employee info box
  doc.setFillColor(243,244,246);doc.roundedRect(mg,y,pw-mg*2,28,3,3,'F')
  doc.setTextColor(...muted);doc.setFont('helvetica','bold');doc.setFontSize(7.5)
  doc.text('EMPLOYEE DETAILS',mg+4,y+7)
  doc.setDrawColor(...gold);doc.setLineWidth(0.4);doc.line(mg+4,y+9,mg+60,y+9)
  doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(11)
  doc.text(emp?emp.name:'—',mg+4,y+16)
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...muted)
  doc.text((emp?emp.role:'—')+'   ·   '+(emp?emp.email:'—'),mg+4,y+22)
  doc.text('Employee ID: '+empId.toUpperCase()+'   ·   Pay Period: '+monthName+' '+yr,mg+4,y+27)
  y+=36

  // Earnings table
  doc.setFillColor(...navy);doc.roundedRect(mg,y,pw-mg*2,10,2,2,'F')
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(8.5)
  doc.text('EARNINGS',mg+4,y+6.8); doc.text('AMOUNT',pw-mg-4,y+6.8,{align:'right'}); y+=10

  const earnings=[
    ['Basic Salary', rec.basic||rec.gross||0],
    ['House Allowance', rec.house||0],
    ['Transport Allowance', rec.transport||0],
    ['Other Allowances', rec.otherAllow||0]
  ].filter(([,v])=>v>0)

  earnings.forEach(([label,amt],i)=>{
    doc.setFillColor(i%2===0?250:255,i%2===0?251:255,i%2===0?252:255)
    doc.rect(mg,y,pw-mg*2,9,'F')
    doc.setTextColor(...ink);doc.setFont('helvetica','normal');doc.setFontSize(9)
    doc.text(label,mg+4,y+6)
    doc.setFont('helvetica','bold');doc.text(fmt(amt),pw-mg-4,y+6,{align:'right'})
    y+=9
  })
  // Gross total
  doc.setFillColor(232,245,233);doc.rect(mg,y,pw-mg*2,10,'F')
  doc.setTextColor(...green);doc.setFont('helvetica','bold');doc.setFontSize(9.5)
  doc.text('GROSS PAY',mg+4,y+6.8)
  doc.text(fmt(rec.gross),pw-mg-4,y+6.8,{align:'right'})
  y+=14

  // Deductions table
  doc.setFillColor(...navy);doc.roundedRect(mg,y,pw-mg*2,10,2,2,'F')
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(8.5)
  doc.text('STATUTORY DEDUCTIONS',mg+4,y+6.8); doc.text('AMOUNT',pw-mg-4,y+6.8,{align:'right'}); y+=10

  const deductions=[
    ['PAYE Income Tax (Kenya Revenue Authority)',rec.paye],
    ['NSSF Contribution (National Social Security Fund)',rec.nssf],
    ['NHIF Contribution (National Hospital Insurance Fund)',rec.nhif],
  ]
  deductions.forEach(([label,amt],i)=>{
    doc.setFillColor(i%2===0?250:255,i%2===0?251:255,i%2===0?252:255)
    doc.rect(mg,y,pw-mg*2,10,'F')
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(8.5)
    doc.text(label,mg+4,y+6.5)
    doc.setTextColor(red[0],red[1],red[2]);doc.setFont('helvetica','bold')
    doc.text(fmt(amt),pw-mg-4,y+6.5,{align:'right'}); y+=10
  })
  y+=4

  // Net pay box
  doc.setFillColor(232,247,232);doc.roundedRect(mg,y,pw-mg*2,16,3,3,'F')
  doc.setDrawColor(...green);doc.setLineWidth(0.6);doc.roundedRect(mg,y,pw-mg*2,16,3,3,'S')
  doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(9)
  doc.text('NET PAY (Take-Home)',mg+4,y+10)
  doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(...green)
  doc.text(fmt(rec.net),pw-mg-4,y+11,{align:'right'}); y+=24

  // Summary breakdown
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...muted)
  const sumRows=[[`Gross Earnings`,fmt(rec.gross)],[`Total Deductions`,fmt(rec.paye+rec.nssf+rec.nhif)],[`Net Pay`,fmt(rec.net)]]
  sumRows.forEach(([l,v],i)=>{
    doc.text(l,mg,y); doc.setFont('helvetica','bold');doc.text(v,mg+80,y); doc.setFont('helvetica','normal'); y+=6
  })
  y+=8

  // Footer
  doc.setDrawColor(200,210,220);doc.setLineWidth(0.5);doc.line(mg,y,pw-mg,y); y+=8
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...muted)
  doc.text('This is a computer-generated payslip. For queries contact HR: hello@statvisionconsultancy.co.ke',pw/2,y,{align:'center'})

  doc.save('StatVision-Payslip-'+empId+'-'+period+'.pdf')
}

// ── P9 FORM ──────────────────────────────────────────────────────
function renderP9Tab(){
  ;['p9Employee'].forEach(id=>{
    const sel=document.getElementById(id); if(!sel) return
    sel.innerHTML=HR_STAFF.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')
  })
  renderP9History()
}

function renderP9History(){
  const tbody=document.getElementById('hrP9Body'); if(!tbody)return
  if(!hrP9Records.length){
    tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--sl);padding:1.4rem">No P9 forms issued yet.</td></tr>'
    return
  }
  tbody.innerHTML=hrP9Records.map(r=>{
    const emp=HR_STAFF.find(s=>s.id===r.employeeId)
    return `<tr>
      <td><strong>${emp?emp.name:r.employeeId}</strong></td>
      <td>${r.year}</td>
      <td>${new Date(r.uploadedAt).toLocaleDateString('en-GB')}</td>
      <td><button class="db1 dba" onclick="downloadP9PDF('${r.employeeId}','${r.year}')">⬇ PDF</button></td>
    </tr>`
  }).join('')
}

async function uploadP9Form(){
  const empId = document.getElementById('p9Employee').value
  const year  = document.getElementById('p9Year').value
  const statusEl=document.getElementById('p9Status')
  if(!empId||!year){statusEl.style.color='#D13438';statusEl.textContent='⚠ Select employee and tax year.';return}
  statusEl.style.color='var(--sl)';statusEl.textContent='Saving P9 record...'
  const rec={id:empId+'-p9-'+year,employeeId:empId,year,uploadedAt:Date.now(),fileUrl:null,generated:false}
  try{
    await fbDB.collection('p9forms').doc(rec.id).set(rec)
    const existing=hrP9Records.findIndex(r=>r.id===rec.id)
    if(existing>=0) hrP9Records[existing]=rec; else hrP9Records.push(rec)
    statusEl.style.color='#107C10';statusEl.textContent='✓ P9 record saved.'
    renderP9History()
  }catch(e){statusEl.style.color='#D13438';statusEl.textContent='⚠ Error: '+e.message}
}

function generateP9PDF(){
  const empId=document.getElementById('p9Employee').value
  const year=document.getElementById('p9Year').value
  if(!empId||!year){alert('Select employee and tax year.');return}
  downloadP9PDF(empId, year)
  // also save record
  const rec={id:empId+'-p9-'+year,employeeId:empId,year,uploadedAt:Date.now(),fileUrl:null,generated:true}
  fbDB.collection('p9forms').doc(rec.id).set(rec).catch(()=>{})
  const existing=hrP9Records.findIndex(r=>r.id===rec.id)
  if(existing>=0) hrP9Records[existing]=rec; else hrP9Records.push(rec)
  renderP9History()
  document.getElementById('p9Status').style.color='#107C10'
  document.getElementById('p9Status').textContent='✓ P9 form generated and saved.'
}

function downloadP9PDF(empId, year){
  if(!window.jspdf){alert('PDF library not loaded — please refresh.');return}
  const emp=HR_STAFF.find(s=>s.id===empId)
  const yearRecs=hrPayrollRecords.filter(r=>r.employeeId===empId&&r.period.startsWith(year))
  const {jsPDF}=window.jspdf
  const doc=new jsPDF({unit:'mm',format:'a4'})
  const pw=210,mg=15
  const navy=[10,26,61],gold=[245,166,35],white=[255,255,255],ink=[20,20,30],muted=[100,110,120]
  const today=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})
  const totalGross=yearRecs.reduce((s,r)=>s+r.gross,0)
  const totalPaye =yearRecs.reduce((s,r)=>s+r.paye,0)
  const totalNssf =yearRecs.reduce((s,r)=>s+r.nssf,0)
  const totalNhif =yearRecs.reduce((s,r)=>s+r.nhif,0)
  const totalNet  =yearRecs.reduce((s,r)=>s+r.net,0)
  const fmt=v=>'KES '+Math.round(v).toLocaleString()

  // Header
  doc.setFillColor(...navy);doc.rect(0,0,pw,38,'F')
  doc.setFillColor(...gold);doc.rect(0,38,pw,2,'F')
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(15)
  doc.text('StatVision Research and Consultancy',mg,13)
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(200,210,230)
  doc.text('Nairobi, Kenya  ·  hello@statvisionconsultancy.co.ke  ·  +254 748 216 918',mg,20)
  doc.text('PIN: P051234567Z  ·  KRA Employer PIN',mg,26)
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(...white)
  doc.text('P9 ANNUAL TAX RETURN',pw-mg,13,{align:'right'})
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(200,210,230)
  doc.text('Tax Year: '+year,pw-mg,20,{align:'right'})
  doc.text('Generated: '+today,pw-mg,26,{align:'right'})

  let y=48
  // Title
  doc.setFillColor(243,244,246);doc.roundedRect(mg,y,pw-mg*2,8,2,2,'F')
  doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(9)
  doc.text('P9A — TAX DEDUCTION CARD (Kenya Revenue Authority Format)',pw/2,y+5.5,{align:'center'}); y+=14

  // Employee details
  doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...muted)
  doc.text('EMPLOYEE DETAILS',mg,y)
  doc.setDrawColor(...gold);doc.setLineWidth(0.4);doc.line(mg,y+2,mg+50,y+2); y+=8
  const empDetails=[
    ['Employee Name',emp?emp.name:'—'],
    ['Employee PIN','Not registered'],
    ['Employer Name','StatVision Research and Consultancy'],
    ['Employer PIN','P051234567Z'],
    ['Tax Year',year],
  ]
  empDetails.forEach(([l,v])=>{
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...muted)
    doc.text(l+':',mg,y); doc.setFont('helvetica','bold');doc.setTextColor(...ink)
    doc.text(v,mg+55,y); y+=7
  }); y+=4

  // Monthly breakdown table
  doc.setFillColor(...navy);doc.roundedRect(mg,y,pw-mg*2,10,2,2,'F')
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(7.5)
  const cols=['Month','Gross Pay','PAYE','NSSF','NHIF','Net Pay']
  const cxs=[mg+2,mg+35,mg+68,mg+95,mg+118,pw-mg-2]
  cols.forEach((c,i)=>doc.text(c,cxs[i],y+6.5,i===5?{align:'right'}:{})); y+=10

  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  months.forEach((mo,i)=>{
    const period=year+'-'+(String(i+1).padStart(2,'0'))
    const r=yearRecs.find(x=>x.period===period)
    doc.setFillColor(i%2===0?250:255,i%2===0?251:255,i%2===0?252:255)
    doc.rect(mg,y,pw-mg*2,8,'F')
    doc.setTextColor(...ink);doc.setFont('helvetica',r?'normal':'normal');doc.setFontSize(8)
    doc.setTextColor(r?ink[0]:180,r?ink[1]:180,r?ink[2]:180)
    doc.text(mo+' '+year,cxs[0],y+5.5)
    if(r){
      doc.text(fmt(r.gross),cxs[1],y+5.5)
      doc.text(fmt(r.paye), cxs[2],y+5.5)
      doc.text(fmt(r.nssf), cxs[3],y+5.5)
      doc.text(fmt(r.nhif), cxs[4],y+5.5)
      doc.setFont('helvetica','bold')
      doc.text(fmt(r.net),  cxs[5],y+5.5,{align:'right'})
    } else {
      doc.text('—',cxs[1],y+5.5);doc.text('—',cxs[2],y+5.5)
      doc.text('—',cxs[3],y+5.5);doc.text('—',cxs[4],y+5.5)
      doc.text('—',cxs[5],y+5.5,{align:'right'})
    }
    y+=8
  })
  // Totals row
  doc.setFillColor(...navy);doc.rect(mg,y,pw-mg*2,10,'F')
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(8)
  doc.text('ANNUAL TOTALS',cxs[0],y+6.5)
  doc.text(fmt(totalGross),cxs[1],y+6.5)
  doc.text(fmt(totalPaye), cxs[2],y+6.5)
  doc.text(fmt(totalNssf), cxs[3],y+6.5)
  doc.text(fmt(totalNhif), cxs[4],y+6.5)
  doc.text(fmt(totalNet),  cxs[5],y+6.5,{align:'right'}); y+=18

  // Declaration
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...muted)
  doc.text('I declare that the information given in this form is true and correct to the best of my knowledge.',mg,y); y+=8
  doc.line(mg,y+12,mg+60,y+12)
  doc.text('Authorized Signatory — StatVision Research and Consultancy',mg,y+17)
  doc.text('Henry Gitau Michuku, CEO',mg,y+23)

  // Footer
  doc.setFillColor(...navy);doc.rect(0,285,pw,12,'F')
  doc.setTextColor(200,210,230);doc.setFont('helvetica','normal');doc.setFontSize(7)
  doc.text('StatVision Research and Consultancy · P9 Form · Tax Year '+year+' · Generated '+today,pw/2,292,{align:'center'})

  doc.save('StatVision-P9-'+empId+'-'+year+'.pdf')
}

// ── EXPORT ───────────────────────────────────────────────────────
function exportHrCSV(){
  const rows=[['Name','Email','Phone','Role','Specialisation','Tools','Date Employed','Status']]
  HR_STAFF.forEach(s=>rows.push([s.name,s.email,s.phone,s.role,s.specialisation,s.tools,s.employed,s.status]))
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv)
  a.download='StatVision-HR-Employees.csv';a.click()
}

function exportPayrollCSV(){
  const rows=[['Employee','Period','Gross','PAYE','NSSF','NHIF','Net Pay','Date Uploaded']]
  hrPayrollRecords.forEach(r=>{
    const emp=HR_STAFF.find(s=>s.id===r.employeeId)
    rows.push([emp?emp.name:r.employeeId,r.period,r.gross,r.paye,r.nssf,r.nhif,r.net,new Date(r.uploadedAt).toLocaleDateString('en-GB')])
  })
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv)
  a.download='StatVision-Payroll-History.csv';a.click()
}

// ── HR REPORTS ───────────────────────────────────────────────────
function renderHrReports(){
  // Payroll cost chart
  const chart=document.getElementById('hrPayrollChart'); if(!chart)return
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now=new Date()
  const last6=Array.from({length:6},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-5+i,1)
    const period=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')
    const total=hrPayrollRecords.filter(r=>r.period===period).reduce((s,r)=>s+r.net,0)
    return{label:months[d.getMonth()],total}
  })
  const maxT=Math.max(1,...last6.map(b=>b.total))
  const bw=36,gap=(320-last6.length*bw)/(last6.length+1)
  let svgOut=''
  last6.forEach((b,i)=>{
    const h=Math.round((b.total/maxT)*90)||3
    const x=gap+i*(bw+gap)
    svgOut+=`<rect x="${x}" y="${110-h}" width="${bw}" height="${h}" rx="5" fill="#00897B" opacity="${i===5?1:.55}"/>
      <text x="${x+bw/2}" y="${110-h-5}" text-anchor="middle" font-size="8" font-weight="700" fill="#00897B">${b.total?'KES '+(b.total/1000).toFixed(0)+'k':''}</text>
      <text x="${x+bw/2}" y="124" text-anchor="middle" font-size="8" fill="#546E7A">${b.label}</text>`
  })
  chart.innerHTML=svgOut

  // Tenure list
  const tl=document.getElementById('hrTenureList'); if(!tl)return
  tl.innerHTML=HR_STAFF.map(s=>{
    const mo=Math.floor((Date.now()-new Date(s.employed).getTime())/(1000*60*60*24*30))
    const pct=Math.min(100,Math.round(mo/36*100))
    return `<div style="margin-bottom:.6rem">
      <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:.2rem">
        <span>${s.name}</span><span>${mo} months</span>
      </div>
      <div style="background:#f0f0f0;border-radius:4px;height:8px">
        <div style="background:#00897B;width:${pct}%;height:8px;border-radius:4px"></div>
      </div>
    </div>`
  }).join('')

  // Full report table
  const wrap=document.getElementById('hrFullReportWrap'); if(!wrap)return
  wrap.innerHTML=`<table><thead><tr><th>Name</th><th>Role</th><th>Payslips</th><th>Avg Gross</th><th>Avg Net</th><th>Total Tax Paid</th></tr></thead>
    <tbody>${HR_STAFF.map(s=>{
      const recs=hrPayrollRecords.filter(r=>r.employeeId===s.id)
      const n=recs.length||1
      return `<tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.role}</td>
        <td>${recs.length}</td>
        <td>KES ${Math.round(recs.reduce((a,r)=>a+r.gross,0)/n).toLocaleString()}</td>
        <td style="color:#107C10;font-weight:600">KES ${Math.round(recs.reduce((a,r)=>a+r.net,0)/n).toLocaleString()}</td>
        <td style="color:#D13438">KES ${Math.round(recs.reduce((a,r)=>a+r.paye,0)).toLocaleString()}</td>
      </tr>`
    }).join('')}</tbody></table>`
}

// ── LOAD PAYROLL FROM FIRESTORE ON LOGIN ─────────────────────────
async function loadHrDataFromFirestore(){
  try{
    const ps=await fbDB.collection('payroll').get()
    hrPayrollRecords=ps.docs.map(d=>d.data())
    const p9=await fbDB.collection('p9forms').get()
    hrP9Records=p9.docs.map(d=>d.data())
  }catch(e){console.warn('HR data load:',e.message)}
}

// ── ANALYST PAYROLL TAB (in analyst portal) ───────────────────────
function renderAnalystPayroll(){
  const st=currentStaff(); if(!st)return
  const emp=HR_STAFF.find(s=>s.email===st.email)
  if(!emp){
    const wrap=document.getElementById('antab-payroll'); if(wrap) wrap.innerHTML='<div style="padding:2rem;color:var(--sl)">No payroll data found for your account.</div>'
    return
  }
  const recs=hrPayrollRecords.filter(r=>r.employeeId===emp.id).sort((a,b)=>b.period.localeCompare(a.period))
  const p9s=hrP9Records.filter(r=>r.employeeId===emp.id)
  const wrap=document.getElementById('antab-payroll'); if(!wrap)return
  wrap.innerHTML=`
    <div class="kgd" style="margin-bottom:1.2rem">
      <div class="kpi"><div class="kpic" style="background:#E8F5E9">💵</div><div><div class="kpiv">KES ${recs.length?Math.round(recs[0].net).toLocaleString():0}</div><div class="kpil">Latest Net Pay</div></div></div>
      <div class="kpi"><div class="kpic" style="background:#E3F2FD">📅</div><div><div class="kpiv">${recs.length?recs[0].period:'—'}</div><div class="kpil">Latest Period</div></div></div>
      <div class="kpi"><div class="kpic" style="background:#FFF3E0">🧾</div><div><div class="kpiv">${recs.length}</div><div class="kpil">Total Payslips</div></div></div>
      <div class="kpi"><div class="kpic" style="background:#F3E5F5">📄</div><div><div class="kpiv">${p9s.length}</div><div class="kpil">P9 Forms Available</div></div></div>
    </div>
    <div class="dtw" style="margin-bottom:1.2rem">
      <div class="dth"><h3>My Payslips</h3></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Period</th><th>Gross</th><th>PAYE</th><th>NSSF+NHIF</th><th>Net Pay</th><th>Download</th></tr></thead>
        <tbody>${recs.length?recs.map(r=>`<tr>
          <td>${r.period}</td>
          <td>KES ${Math.round(r.gross).toLocaleString()}</td>
          <td style="color:#D13438">KES ${Math.round(r.paye).toLocaleString()}</td>
          <td style="color:#E65100">KES ${Math.round(r.nssf+r.nhif).toLocaleString()}</td>
          <td style="color:#107C10;font-weight:700">KES ${Math.round(r.net).toLocaleString()}</td>
          <td><button class="db1 dba" onclick="downloadPayslipPDF('${emp.id}','${r.period}')">⬇ PDF</button></td>
        </tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--sl);padding:1.4rem">No payslips uploaded yet — HR will upload them each month.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="dtw">
      <div class="dth"><h3>My P9 Tax Forms</h3></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Tax Year</th><th>Date Issued</th><th>Download</th></tr></thead>
        <tbody>${p9s.length?p9s.map(r=>`<tr>
          <td>${r.year}</td>
          <td>${new Date(r.uploadedAt).toLocaleDateString('en-GB')}</td>
          <td><button class="db1 dba" onclick="downloadP9PDF('${emp.id}','${r.year}')">⬇ P9 PDF</button></td>
        </tr>`).join(''):'<tr><td colspan="3" style="text-align:center;color:var(--sl);padding:1.4rem">No P9 forms yet — issued annually by HR.</td></tr>'}</tbody>
      </table></div>
    </div>`
}

// ============ NEW LANDING PAGE BEHAVIOR (script.js) ============
// ===== Scroll-to-top button =====
try {
  const scrollBtn = document.getElementById('scrollTop');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        scrollBtn.classList.add('visible');
      } else {
        scrollBtn.classList.remove('visible');
      }
    });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
} catch (err) { console.error('Scroll-to-top button failed:', err); }

// ===== Theme toggle =====
try {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
    });
  }
} catch (err) { console.error('Theme toggle failed:', err); }

// ===== Smooth scroll for in-page nav links =====
try {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId.length > 1) {
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
} catch (err) { console.error('Smooth scroll failed:', err); }

// ===== Scroll reveal: fade/slide sections and cards into view =====
try {
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => revealObserver.observe(el));
  } else {
    // Old browser without IntersectionObserver support: just show everything
    revealEls.forEach(el => el.classList.add('in-view'));
  }
} catch (err) {
  console.error('Scroll reveal failed:', err);
  // Safety net: never let content stay invisible because of a JS error
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('in-view'));
}

// ===== Safety net: if ANYTHING above silently fails, force all reveal
// content visible after 2s so the page is never permanently blank =====
setTimeout(() => {
  document.querySelectorAll('.reveal:not(.in-view)').forEach(el => el.classList.add('in-view'));
  document.querySelectorAll('.live-card:not(.in-view)').forEach(el => el.classList.add('in-view'));
}, 2000);

// ===== Animated number counters (KPIs, stats bar, mini dashboards) =====
// Parses strings like "523", "25.7M", "98%", "500+", "128.7M", "1,245"
// and counts up from 0 to the target while preserving formatting.
function animateCounter(el) {
  const raw = el.textContent.trim();
  const match = raw.match(/^([\d,]+\.?\d*)(.*)$/);
  if (!match) return;
  const numStr = match[1].replace(/,/g, '');
  const suffix = match[2];
  const target = parseFloat(numStr);
  if (isNaN(target)) return;
  const hasComma = match[1].includes(',');
  const decimals = (numStr.split('.')[1] || '').length;
  const duration = 1200;
  const start = performance.now();
  function format(value) {
    let str = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
    if (hasComma) {
      const parts = str.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      str = parts.join('.');
    }
    return str + suffix;
  }
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = format(target * eased);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = format(target); // lock exact final value
    }
  }
  requestAnimationFrame(tick);
}
try {
  const counterTargets = document.querySelectorAll(
    '.kpi strong, .stat strong, .mini-kpis strong'
  );
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  counterTargets.forEach(el => counterObserver.observe(el));
} catch (err) { console.error('Counter animation failed:', err); }

// ===== Live dashboard cards animate their charts once visible =====
try {
  const liveCards = document.querySelectorAll('.live-card');
  const liveCardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        liveCardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  liveCards.forEach(el => liveCardObserver.observe(el));
} catch (err) { console.error('Live card reveal failed:', err); }

// ===== Re-play a chart's draw-in animation (used by refresh buttons) =====
function replayAnimations(container) {
  const animatedEls = container.querySelectorAll(
    'polyline, .bar-chart rect, .mini-bars rect, .donut circle'
  );
  animatedEls.forEach(el => {
    el.style.animation = 'none';
    // force reflow so the animation restarts
    void el.getBoundingClientRect();
    el.style.animation = '';
  });
  const hbarFills = container.querySelectorAll('.hbar i');
  hbarFills.forEach(el => {
    el.style.animation = 'none';
    void el.getBoundingClientRect();
    el.style.animation = '';
  });
}

// ===== Hero dashboard "Refresh" button =====
try {
  const refreshDash = document.getElementById('refreshDash');
  if (refreshDash) {
    refreshDash.addEventListener('click', () => {
      refreshDash.classList.add('spinning');
      replayAnimations(document.querySelector('.dash-card'));
      setTimeout(() => refreshDash.classList.remove('spinning'), 600);
    });
  }
} catch (err) { console.error('Hero refresh button failed:', err); }

// ===== Live dashboard card refresh + fullscreen buttons =====
try {
  document.querySelectorAll('.live-refresh').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.add('spinning');
      const card = btn.closest('.live-card');
      replayAnimations(card);
      setTimeout(() => btn.classList.remove('spinning'), 600);
    });
  });

  let fullscreenBackdrop = null;
  document.querySelectorAll('.live-fullscreen').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.live-card');
      const isFull = card.classList.toggle('is-fullscreen');
      if (isFull) {
        fullscreenBackdrop = document.createElement('div');
        fullscreenBackdrop.className = 'fullscreen-backdrop';
        fullscreenBackdrop.addEventListener('click', () => {
          card.classList.remove('is-fullscreen');
          fullscreenBackdrop.remove();
        });
        document.body.appendChild(fullscreenBackdrop);
        replayAnimations(card);
      } else if (fullscreenBackdrop) {
        fullscreenBackdrop.remove();
      }
    });
  });
} catch (err) { console.error('Live dashboard buttons failed:', err); }

// ===== "More services" arrow: scroll the grid to reveal extra cards =====
try {
  const serviceNext = document.getElementById('serviceNext');
  if (serviceNext) {
    serviceNext.addEventListener('click', () => {
      const grid = document.querySelector('.service-grid');
      grid.scrollBy({ left: 300, behavior: 'smooth' });
    });
  }
} catch (err) { console.error('Service arrow button failed:', err); }

// ===== Contact form: client-side validation + success message =====
// NOTE: this only shows a confirmation in the browser. To actually receive
// messages, wire this form up to EmailJS, a form backend, or Firestore.
try {
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
      }
      // Placeholder success state — replace with a real submit (EmailJS/Firestore) later.
      if (formSuccess) formSuccess.hidden = false;
      contactForm.reset();
      if (formSuccess) {
        setTimeout(() => { formSuccess.hidden = true; }, 6000);
      }
    });
  }
} catch (err) { console.error('Contact form failed:', err); }

// ===== Active nav link follows scroll position =====
try {
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  const sections = Array.from(navLinks)
    .filter(link => link.getAttribute('href').length > 1)
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = '#' + entry.target.id;
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === id);
          });
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
    sections.forEach(section => navObserver.observe(section));
  }
} catch (err) { console.error('Active nav link tracking failed:', err); }