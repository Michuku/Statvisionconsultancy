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
// SERVICES PAGE — "Learn More" detail modal with sample charts
// ══════════════════════════════════════════════════════════════════
const SERVICES_DATA = {
  statistical:{
    title:'Statistical Analysis', tag:'SPSS · STATA · R · Python', icon:'📊', color:'#3b82f6',
    desc:'We turn raw numbers into defensible conclusions. Our analysts run descriptive and inferential statistics, regression modelling, hypothesis testing, and predictive analytics using industry-standard tools — so your decisions are backed by rigorous, reproducible evidence.',
    features:['Descriptive & inferential statistics','Regression & predictive modelling','Hypothesis testing & significance analysis','Custom SPSS, STATA, R & Python scripts','Clear, decision-ready result summaries'],
    subServices:['Descriptive Statistics','Inferential Statistics','Regression Analysis','Time Series Analysis','ANOVA','Survey Data Analysis','Predictive Analytics','Experimental Design','Statistical Modelling','Data Interpretation'],
    benefits:['Evidence-based decisions instead of guesswork','Reduced risk through statistically validated findings','Clear, defensible results for stakeholders & funders','Faster turnaround using industry-standard software'],
    tools:['spss','stata','r','python']
  },
  powerbi:{
    title:'Power BI Dashboards', tag:'Interactive Business Dashboards', icon:'📈', color:'#f59e0b',
    desc:'We design live, interactive Power BI dashboards that turn scattered spreadsheets into a single source of truth — so your team can track KPIs, spot trends, and make decisions in real time instead of waiting on monthly reports.',
    features:['Custom KPI & executive dashboards','Live data connections & auto-refresh','Drill-down reports by team, region or product','Mobile-friendly dashboard design','Staff training on dashboard use'],
    subServices:['KPI Dashboard Design','Real-Time Data Connections','Executive Reporting Dashboards','Sales & Revenue Dashboards','Financial Performance Tracking','Custom Data Visualizations','Drill-Down & Filter Reports','Mobile Dashboard Access','Automated Report Scheduling','Dashboard Training & Handover'],
    benefits:['See performance in real time, not month-end','One dashboard replaces a dozen spreadsheets','Faster, more confident executive decisions','Fully branded to your organisation'],
    tools:['powerbi','excel','sql']
  },
  monitoring:{
    title:'Monitoring & Evaluation', tag:'M&E Frameworks & Impact Assessment', icon:'🎯', color:'#22c55e',
    desc:'We design end-to-end M&E frameworks for NGOs, government programmes and businesses — from theory of change and indicator selection to field data collection and impact assessment — so you can prove and improve what your programme actually achieves.',
    features:['Theory of change & log-frame design','Indicator & baseline development','Field data collection & KoBo/ODK setup','Impact & outcome evaluation','Donor-ready M&E reports'],
    subServices:['Theory of Change Design','Log-Frame Development','Indicator & Baseline Setting','Field Data Collection (KoBo/ODK)','Outcome & Impact Evaluation','Mid-Term & End-Term Reviews','Beneficiary Feedback Systems','Data Quality Assessments','Donor Reporting Support','M&E Capacity Building'],
    benefits:['Prove programme impact to donors & boards','Catch problems early through real-time monitoring','Stronger, evidence-backed funding proposals','Built-in accountability & transparency'],
    tools:['kobo','odk','excel','spss']
  },
  research:{
    title:'Research Consultancy', tag:'Data-Driven Research Solutions', icon:'🔍', color:'#8b5cf6',
    desc:'From concept notes to final publication, we support institutions, NGOs and businesses through the full research lifecycle — study design, ethical clearance support, data collection, analysis, and writing up findings for policy or publication.',
    features:['Research design & proposal development','Mixed-methods (qualitative + quantitative)','Ethical review & IRB support','Peer-review-ready analysis & writing','Policy brief & publication support'],
    subServices:['Research Proposal Development','Literature Review','Qualitative Research (Interviews/FGDs)','Quantitative Research Design','Mixed-Methods Studies','Ethical Review & IRB Support','Market Research','Policy Analysis','Academic & Technical Writing','Publication & Dissemination Support'],
    benefits:['Rigorous methodology from design to write-up','Findings ready for policy or publication','Access to experienced multi-sector researchers','End-to-end support — no need for multiple vendors'],
    tools:['spss','stata','excel','r']
  },
  cleaning:{
    title:'Data Cleaning', tag:'Preparation, Validation & Quality Control', icon:'🧹', color:'#14b8a6',
    desc:'Messy data leads to wrong conclusions. We detect and fix missing values, duplicates, inconsistent coding and outliers, and validate your dataset against its own logic — so every analysis built on it stands on solid ground.',
    features:['Missing value & outlier treatment','De-duplication & consistency checks','Variable coding & standardisation','Data validation against source logic','Clean, analysis-ready dataset delivery'],
    subServices:['Missing Data Treatment','Duplicate Detection & Removal','Outlier Identification','Variable Coding & Labelling','Data Consistency Checks','Data Format Standardisation','Dataset Merging & Restructuring','Data Validation Rules','Anonymisation & Confidentiality Checks','Analysis-Ready Dataset Delivery'],
    benefits:['Reliable analysis built on trustworthy data','Fewer errors and false conclusions downstream','Saves your team hours of manual cleanup','Documented, repeatable cleaning process'],
    tools:['excel','r','python','sql']
  },
  survey:{
    title:'Survey Design', tag:'Structured Data Collection Instruments', icon:'📝', color:'#f97316',
    desc:'A survey is only as good as its design. We build structured, bias-tested questionnaires and digital data collection tools tailored to your research questions — piloted and refined before they ever reach your respondents.',
    features:['Questionnaire design & question wording','Digital tools: KoBo, ODK, Google Forms','Sampling strategy & respondent targeting','Pilot testing & instrument refinement','Multi-language survey adaptation'],
    subServices:['Questionnaire Design','Digital Survey Setup (KoBo/ODK/Forms)','Sampling Strategy Design','Survey Piloting & Testing','Enumerator Training','Multi-Language Translation','Paper-to-Digital Survey Conversion','Response Quality Control','Survey Logistics Planning','Data Collection Supervision'],
    benefits:['Higher-quality, less biased responses','Tools built for your specific research questions','Field-tested before full rollout','Faster data collection with digital tools'],
    tools:['kobo','odk','excel']
  },
  bi:{
    title:'Business Intelligence', tag:'Turning Data into Decisions', icon:'💡', color:'#6366f1',
    desc:'We help organisations build the data infrastructure and reporting culture to compete on insight — consolidating data sources, building BI pipelines, and delivering the kind of intelligence that shows up directly in the bottom line.',
    features:['Data warehousing & pipeline setup','Cross-department reporting systems','Trend & competitor benchmarking','Automated reporting workflows','Executive-level insight briefings'],
    subServices:['Data Warehousing Setup','BI Pipeline Development','Cross-Department Reporting','Competitor & Market Benchmarking','Automated Reporting Workflows','Business Performance Analytics','Trend & Forecast Analysis','Executive Insight Briefings','Data Source Integration','BI Strategy Consulting'],
    benefits:['Insight that shows up directly in the bottom line','One source of truth across departments','Less manual reporting, more analysis time','Data-backed strategy, not guesswork'],
    tools:['powerbi','sql','excel','tableau']
  },
  training:{
    title:'Training & Capacity Building', tag:'Data Skills & Research Methodology Training', icon:'🎓', color:'#10b981',
    desc:'We build lasting in-house capacity, not just one-off reports. Our hands-on workshops train your team on statistical tools, survey methods and dashboard use — so your organisation keeps generating insight long after our engagement ends.',
    features:['SPSS, STATA, R & Excel training','Survey & M&E methodology workshops','Power BI / dashboard skills training','Customised in-house curricula','Certificates of completion'],
    subServices:['SPSS Training','STATA Training','R Programming Training','Excel for Data Analysis','Power BI / Dashboard Training','Survey Methodology Workshops','M&E Methodology Training','Data Cleaning Workshops','Research Writing Workshops','Customised In-House Curricula'],
    benefits:['Builds lasting in-house capacity','Reduces future reliance on external consultants','Hands-on, practical, tool-based learning','Certificates of completion for participants'],
    tools:['spss','stata','r','python','excel','powerbi']
  },
  gis:{
    title:'GIS & Mapping', tag:'Spatial Analysis & Interactive Mapping', icon:'🗺️', color:'#0891b2',
    desc:'We turn location data into clear, decision-ready maps. From field GPS collection to spatial analysis and interactive web maps, our GIS team helps you see the geographic patterns behind your data — where needs are highest, where coverage is weak, and where to act next.',
    features:['GIS mapping & cartographic design','Spatial & geospatial data analysis','GPS field data collection','Interactive, shareable web maps','Boundary, catchment & coverage mapping'],
    subServices:['GIS Mapping','Spatial Analysis','GPS Data Collection','Interactive Web Maps','Choropleth & Heat Maps','Catchment & Coverage Mapping','Remote Sensing & Satellite Data','Geo-Referencing & Digitisation'],
    benefits:['See geographic patterns hidden in raw data','Target resources to where they are needed most','Shareable interactive maps for reports & funders','Field-collected location data you can trust'],
    tools:['qgis','gps','excel']
  }
}
// Software/tools catalog referenced by each service's `tools` array (Interactive Panel > Tools tab)
const TOOLS_CATALOG = {
  spss:{name:'SPSS',icon:'📊',desc:'Statistical analysis & survey data processing'},
  stata:{name:'STATA',icon:'📈',desc:'Econometric & panel data analysis'},
  r:{name:'R',icon:'📉',desc:'Statistical computing & visualization'},
  python:{name:'Python',icon:'🐍',desc:'Data science & predictive modelling'},
  sql:{name:'SQL',icon:'🗄️',desc:'Database querying & data management'},
  excel:{name:'Excel',icon:'📑',desc:'Spreadsheet modelling & reporting'},
  powerbi:{name:'Power BI',icon:'💡',desc:'Interactive business dashboards'},
  tableau:{name:'Tableau',icon:'📐',desc:'Advanced data visualization'},
  kobo:{name:'KoBoToolbox',icon:'📱',desc:'Digital field data collection'},
  odk:{name:'ODK',icon:'📲',desc:'Offline survey data collection'},
  qgis:{name:'QGIS',icon:'🗺️',desc:'Geographic information mapping'},
  gps:{name:'GPS Devices',icon:'📍',desc:'Field coordinate & spatial data capture'}
}
// Technical workflow shown in the Interactive Panel's "Process" tab (distinct from the
// general 4-step engagement process further down the page)
const SERVICE_WORKFLOW_STEPS=[
  {icon:'📥',title:'Data Collection',desc:'Gathering raw data from surveys, systems, or field sources.'},
  {icon:'🧹',title:'Cleaning',desc:'Validating, de-duplicating and preparing the dataset.'},
  {icon:'📊',title:'Analysis',desc:'Applying the right statistical or analytical methods.'},
  {icon:'📈',title:'Visualization',desc:'Turning results into clear charts and dashboards.'},
  {icon:'📄',title:'Reporting',desc:'Compiling findings into a clear, decision-ready report.'},
  {icon:'💡',title:'Recommendations',desc:'Translating insight into practical next steps.'}
]
// Company-wide achievement stats shown (with count-up animation) in the "Results" tab
const SERVICE_RESULTS_STATS=[
  {value:500,suffix:'+',label:'Projects Completed'},
  {value:120,suffix:'+',label:'Organisations Served'},
  {value:98,suffix:'%',label:'Client Satisfaction'},
  {value:25,suffix:'M+',label:'Records Analysed'}
]
// Shared 4-step engagement process, shown on every service page
const SERVICE_PROCESS_STEPS=[
  {title:'Consultation & Scoping',desc:"We start by understanding your goals, data, and constraints — so the engagement is scoped around what you actually need."},
  {title:'Data Collection & Preparation',desc:'We gather, clean, and organise your data (or design the tools to collect it) so every analysis stands on solid ground.'},
  {title:'Analysis & Modelling',desc:'We apply the right statistical, analytical, or design methods for your questions, using industry-standard tools.'},
  {title:'Reporting & Handover',desc:'You receive clear, decision-ready deliverables — plus training and support so your team can keep using them.'}
]
function svcIconHTML(icon,iconURL){
  return iconURL ? `<img src="${iconURL}" alt="">` : (icon||'📊')
}
const BENEFIT_ICONS=['📊','⚡','📈','🔍','✅','💡','🎯','🚀']
function featureCardsHTML(list){
  return (list||[]).map(f=>`<div class="sm-feature-card"><span class="sm-feature-check">✓</span><span>${escapeHtml(f)}</span></div>`).join('')
}
function benefitCardsHTML(list){
  return (list||[]).map((b,i)=>`<li><span class="sm-benefit-ico">${BENEFIT_ICONS[i%BENEFIT_ICONS.length]}</span><span>${escapeHtml(b)}</span></li>`).join('')
}
// Sets the featured image panel to a branded gradient placeholder using the service's own colour/icon
// ══════════════════════════════════════════════════════════════════
// SERVICE MODAL — Interactive Panel: automatic image carousel
// (carousel.js logic — autoplay, arrows, dots, pause-on-hover, swipe, fade)
// ══════════════════════════════════════════════════════════════════
let svcCarouselImages=[]
let svcCarouselIndex=0
let svcCarouselTimer=null
function renderServiceCarousel(images,placeholderIcon,placeholderColor){
  svcCarouselImages = images||[]
  svcCarouselIndex = 0
  stopServiceCarouselAutoplay()
  const track=document.getElementById('serviceCarouselTrack')
  const dots=document.getElementById('serviceCarouselDots')
  const prev=document.getElementById('serviceCarouselPrev')
  const next=document.getElementById('serviceCarouselNext')
  if(!svcCarouselImages.length){
    track.innerHTML = `<div class="sm-carousel-placeholder" style="background:linear-gradient(135deg,${placeholderColor},${placeholderColor}99)"><span>${placeholderIcon||'📊'}</span><small>Sample deliverables coming soon</small></div>`
    dots.innerHTML=''; prev.style.display='none'; next.style.display='none'
    return
  }
  track.innerHTML = svcCarouselImages.map((img,i)=>
    `<div class="sm-carousel-slide${i===0?' active':''}" onclick="openLightbox('${img.url}')"><img src="${img.url}" alt="${(img.name||'Sample output').replace(/"/g,'&quot;')}" loading="lazy"/></div>`
  ).join('')
  if(svcCarouselImages.length>1){
    // more than one image — show arrows, dots, and start autoplay
    dots.innerHTML = svcCarouselImages.map((_,i)=>`<button class="sm-carousel-dot${i===0?' active':''}" onclick="svcCarouselGoTo(${i})" aria-label="Go to image ${i+1}"></button>`).join('')
    prev.style.display='flex'; next.style.display='flex'
    startServiceCarouselAutoplay()
  } else {
    // exactly one image — hide arrows & dots per spec
    dots.innerHTML=''; prev.style.display='none'; next.style.display='none'
  }
}
function svcCarouselGoTo(i){
  if(!svcCarouselImages.length) return
  svcCarouselIndex = (i+svcCarouselImages.length)%svcCarouselImages.length
  document.querySelectorAll('#serviceCarouselTrack .sm-carousel-slide').forEach((el,j)=>el.classList.toggle('active',j===svcCarouselIndex))
  document.querySelectorAll('#serviceCarouselDots .sm-carousel-dot').forEach((el,j)=>el.classList.toggle('active',j===svcCarouselIndex))
}
function svcCarouselNext(){ svcCarouselGoTo(svcCarouselIndex+1) }
function svcCarouselPrev(){ svcCarouselGoTo(svcCarouselIndex-1) }
function startServiceCarouselAutoplay(){
  stopServiceCarouselAutoplay()
  svcCarouselTimer=setInterval(svcCarouselNext,4000)
}
function stopServiceCarouselAutoplay(){
  if(svcCarouselTimer){ clearInterval(svcCarouselTimer); svcCarouselTimer=null }
}
// Pause on hover + touch-swipe support, wired once to the static carousel container
document.addEventListener('DOMContentLoaded',()=>{
  const car=document.getElementById('serviceCarousel')
  if(!car) return
  car.addEventListener('mouseenter',stopServiceCarouselAutoplay)
  car.addEventListener('mouseleave',()=>{ if(svcCarouselImages.length>1) startServiceCarouselAutoplay() })
  let touchStartX=null
  car.addEventListener('touchstart',e=>{ touchStartX=e.touches[0].clientX; stopServiceCarouselAutoplay() },{passive:true})
  car.addEventListener('touchend',e=>{
    if(touchStartX===null) return
    const dx=e.changedTouches[0].clientX-touchStartX
    if(Math.abs(dx)>40){ dx<0?svcCarouselNext():svcCarouselPrev() }
    touchStartX=null
    if(svcCarouselImages.length>1) startServiceCarouselAutoplay()
  },{passive:true})
})

// ══════════════════════════════════════════════════════════════════
// SERVICE MODAL — Interactive Panel: tab system
// (tabs.js logic — Gallery / Dashboards / Process / Tools / Results)
// ══════════════════════════════════════════════════════════════════
function switchServiceTab(name){
  document.querySelectorAll('#serviceTabBar .sm-tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name))
  document.querySelectorAll('#serviceTabPanels .sm-tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===name))
  if(name==='results') animateServiceResultCounters()
}
function resetServiceTabs(){ switchServiceTab('gallery') }

// (gallery.js logic — shared grid renderer used by both the Gallery and Dashboards tabs)
function renderImageGrid(containerId,docs){
  const el=document.getElementById(containerId)
  if(!el) return
  if(!docs.length){
    el.classList.add('sm-gallery-grid-empty')
    el.innerHTML='<p class="sm-empty-note">No images uploaded yet for this section.</p>'
    return
  }
  el.classList.remove('sm-gallery-grid-empty')
  el.innerHTML = docs.map(g=>{
    const safeName=(g.caption||g.name||'Sample output').replace(/"/g,'&quot;')
    return `<div class="sm-gallery-item" onclick="openLightbox('${g.url}')"><img src="${g.url}" alt="${safeName}" loading="lazy"/></div>`
  }).join('')
}
function renderServiceWorkflow(){
  const el=document.getElementById('serviceModalWorkflow')
  el.innerHTML = SERVICE_WORKFLOW_STEPS.map((w,i)=>
    `<div class="sm-workflow-step"><div class="sm-workflow-ico">${w.icon}</div><h5>${escapeHtml(w.title)}</h5><p>${escapeHtml(w.desc)}</p></div>`+
    (i<SERVICE_WORKFLOW_STEPS.length-1 ? '<div class="sm-workflow-arrow">↓</div>' : '')
  ).join('')
}
function renderServiceTools(toolKeys){
  const el=document.getElementById('serviceModalTools')
  el.innerHTML=(toolKeys||[]).map(k=>{
    const t=TOOLS_CATALOG[k]
    if(!t) return ''
    return `<div class="sm-tool-card"><span class="sm-tool-ico">${t.icon}</span><div><h5>${escapeHtml(t.name)}</h5><p>${escapeHtml(t.desc)}</p></div></div>`
  }).join('')
}
let svcCountersAnimated=false
function renderServiceResults(){
  const el=document.getElementById('serviceModalResults')
  el.innerHTML = SERVICE_RESULTS_STATS.map((s,i)=>
    `<div class="sm-result-card"><strong id="svcCounter${i}">0${s.suffix}</strong><small>${escapeHtml(s.label)}</small></div>`
  ).join('')
  svcCountersAnimated=false
}
function animateServiceResultCounters(){
  if(svcCountersAnimated) return
  svcCountersAnimated=true
  SERVICE_RESULTS_STATS.forEach((s,i)=>{
    const el=document.getElementById('svcCounter'+i)
    if(!el) return
    const dur=1200, start=performance.now()
    function tick(now){
      const p=Math.min(1,(now-start)/dur)
      el.textContent=Math.floor(p*s.value)+s.suffix
      if(p<1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

// ---- lightweight markdown renderer for admin-entered descriptions/notes ----
function mdInline(s){
  return s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g,'$1<em>$2</em>')
}
function mdLite(raw){
  if(!raw) return ''
  const lines = escapeHtml(raw).split(/\r?\n/)
  let html='', inList=false
  const closeList=()=>{ if(inList){ html+='</ul>'; inList=false } }
  for(let line of lines){
    line = line.trim()
    if(!line){ closeList(); continue }
    let m
    if((m=line.match(/^###\s+(.*)/))){ closeList(); html+=`<h5>${mdInline(m[1])}</h5>`; continue }
    if((m=line.match(/^##\s+(.*)/))){ closeList(); html+=`<h4>${mdInline(m[1])}</h4>`; continue }
    if((m=line.match(/^#\s+(.*)/))){ closeList(); html+=`<h3>${mdInline(m[1])}</h3>`; continue }
    if((m=line.match(/^[-*]\s+(.*)/))){ if(!inList){ html+='<ul>'; inList=true } html+=`<li>${mdInline(m[1])}</li>`; continue }
    closeList()
    html+=`<p>${mdInline(line)}</p>`
  }
  closeList()
  return html
}

// ---- Available Services accordion (smooth expand/collapse) ----
let serviceAccordionOpen=false
function resetServiceAccordion(){
  serviceAccordionOpen=false
  document.getElementById('serviceModalAccordionPanel').style.maxHeight='0px'
  document.getElementById('serviceModalAccordionCaret').textContent='▼ Click to View Services'
  document.getElementById('serviceModalAccordionBtn').setAttribute('aria-expanded','false')
}
function toggleServiceAccordion(){
  serviceAccordionOpen=!serviceAccordionOpen
  const panel=document.getElementById('serviceModalAccordionPanel')
  const caret=document.getElementById('serviceModalAccordionCaret')
  const btn=document.getElementById('serviceModalAccordionBtn')
  if(serviceAccordionOpen){
    panel.style.maxHeight=panel.scrollHeight+'px'
    caret.textContent='▲ Hide Services'
    btn.setAttribute('aria-expanded','true')
  } else {
    panel.style.maxHeight='0px'
    caret.textContent='▼ Click to View Services'
    btn.setAttribute('aria-expanded','false')
  }
}

// ---- Full-screen lightbox for gallery images ----
function openLightbox(url){
  document.getElementById('serviceLightboxImg').src=url
  document.getElementById('serviceLightbox').classList.add('open')
}
function closeLightbox(){
  document.getElementById('serviceLightbox').classList.remove('open')
}

async function openServiceModal(id){
  const s = SERVICES_DATA[id]
  if(!s) return
  // 1) paint instantly with the built-in defaults
  const iconEl=document.getElementById('serviceModalIcon')
  const headband=document.getElementById('serviceModalHeadband')
  iconEl.innerHTML=svcIconHTML(s.icon,null)
  headband.style.background=`linear-gradient(120deg,${s.color},${s.color}cc)`
  document.getElementById('serviceModalTitle').textContent=s.title
  document.getElementById('serviceModalTag').textContent=s.tag
  document.getElementById('serviceModalDesc').innerHTML=mdLite(s.desc)
  document.getElementById('serviceModalFeatures').innerHTML=featureCardsHTML(s.features)
  document.getElementById('serviceModalNotesWrap').style.display='none'
  document.getElementById('serviceModalSubList').innerHTML=(s.subServices||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')
  document.getElementById('serviceModalBenefits').innerHTML=benefitCardsHTML(s.benefits)
  renderServiceCarousel([],s.icon,s.color)
  renderServiceWorkflow()
  renderServiceTools(s.tools)
  renderServiceResults()
  resetServiceTabs()
  document.getElementById('serviceModalProcess').innerHTML=SERVICE_PROCESS_STEPS.map((p,i)=>
    `<div class="sm-process-step"><span class="sm-process-num">${i+1}</span><div><h5>${escapeHtml(p.title)}</h5><p>${escapeHtml(p.desc)}</p></div></div>`
  ).join('')
  const allKeys=Object.keys(SERVICES_DATA), idx=allKeys.indexOf(id)
  const relatedKeys=[allKeys[(idx+1)%allKeys.length],allKeys[(idx+2)%allKeys.length],allKeys[(idx+3)%allKeys.length]]
  document.getElementById('serviceModalRelated').innerHTML=relatedKeys.map(k=>{
    const o=SERVICES_DATA[k]
    return `<button class="sm-related-card" onclick="openServiceModal('${k}')"><span class="sm-related-ico" style="background:${o.color}22;color:${o.color}">${o.icon}</span><span>${escapeHtml(o.title)}</span></button>`
  }).join('')
  resetServiceAccordion()
  // trigger the fade/slide-in animation fresh each time the modal opens
  const contentEl=document.getElementById('serviceModal').querySelector('.sm-content')
  contentEl.classList.remove('sm-animate-in')
  void contentEl.offsetWidth // force reflow so the animation restarts
  contentEl.classList.add('sm-animate-in')
  document.getElementById('serviceModal').style.display='flex'
  document.body.style.overflow='hidden'
  if(typeof window.setActiveServiceNav==='function') window.setActiveServiceNav(id)
  // push a history entry so the browser/back button and our Back button both work naturally
  if(!(history.state && history.state.serviceModal)){
    history.pushState({serviceModal:id},'','#service-'+id)
  }
  // 2) layer in any admin-uploaded overrides (icon, text, gallery, notes)
  try{
    const doc = await fbDB.collection('services').doc(id).get()
    const data = doc.exists ? doc.data() : {}
    if(data.iconURL) iconEl.innerHTML=svcIconHTML(null,data.iconURL)
    if(data.title) document.getElementById('serviceModalTitle').textContent=data.title
    if(data.tag) document.getElementById('serviceModalTag').textContent=data.tag
    if(data.desc) document.getElementById('serviceModalDesc').innerHTML=mdLite(data.desc)
    if(data.features && data.features.length) document.getElementById('serviceModalFeatures').innerHTML=featureCardsHTML(data.features)
    if(data.subServices && data.subServices.length) document.getElementById('serviceModalSubList').innerHTML=data.subServices.map(f=>`<li>${escapeHtml(f)}</li>`).join('')
    if(data.benefits && data.benefits.length) document.getElementById('serviceModalBenefits').innerHTML=benefitCardsHTML(data.benefits)
    if(data.analysisNotes){
      document.getElementById('serviceModalNotes').innerHTML=mdLite(data.analysisNotes)
      document.getElementById('serviceModalNotesWrap').style.display='block'
    }
    // gallery & dashboards — real admin-uploaded images are the only visuals here.
    // Gallery images drive both the auto-play carousel and the Gallery tab grid;
    // dashboard screenshots are a separate upload set shown in the Dashboards tab.
    const [gsnap,dsnap] = await Promise.all([
      fbDB.collection('services').doc(id).collection('gallery').orderBy('uploadedAt','desc').get(),
      fbDB.collection('services').doc(id).collection('dashboards').orderBy('uploadedAt','desc').get()
    ])
    const galleryDocs = gsnap.docs.map(d=>d.data())
    const dashDocs = dsnap.docs.map(d=>d.data())
    renderServiceCarousel(galleryDocs,s.icon,s.color)
    renderImageGrid('serviceModalGallery',galleryDocs)
    renderImageGrid('serviceModalDashboards',dashDocs)
  }catch(e){ /* no overrides saved yet — defaults already shown */ }
}
function closeServiceModal(fromPopState){
  document.getElementById('serviceModal').style.display='none'
  document.body.style.overflow=''
  closeLightbox()
  if(typeof window.setActiveServiceNav==='function') window.setActiveServiceNav(null)
  if(!fromPopState && history.state && history.state.serviceModal){
    history.back()
  }
}
// Browser/hardware back button also closes the service page cleanly
window.addEventListener('popstate',()=>{
  const modal=document.getElementById('serviceModal')
  if(modal.style.display==='flex' && !(history.state && history.state.serviceModal)){
    closeServiceModal(true)
  }
})
// ---- PUBLIC — reflect admin icon/title/tools overrides on the Services grid cards ----
async function loadServiceCardOverrides(){
  for(const id of Object.keys(SERVICES_DATA)){
    try{
      const doc = await fbDB.collection('services').doc(id).get()
      if(!doc.exists) continue
      const data=doc.data()
      if(data.iconURL){ const el=document.getElementById('svcCardIcon-'+id); if(el) el.innerHTML=svcIconHTML(null,data.iconURL) }
      if(data.title){ const el=document.getElementById('svcCardTitle-'+id); if(el) el.textContent=data.title }
      if(data.tag){ const el=document.getElementById('svcCardTools-'+id); if(el) el.textContent=data.tag }
    }catch(e){ /* card just keeps its default */ }
  }
}
document.addEventListener('DOMContentLoaded',loadServiceCardOverrides)

// ---- ADMIN (edit) — Admin Portal > Manage Services ----
function renderAdminServicesPanel(){
  const grid=document.getElementById('adServicesGrid')
  if(!grid) return
  grid.innerHTML = Object.keys(SERVICES_DATA).map(id=>{
    const s=SERVICES_DATA[id]
    return `<div class="odtl">
      <div style="display:flex;align-items:center;gap:1.1rem;margin-bottom:1rem">
        <label class="svc-icon-upload" title="Upload a custom icon image">
          <div class="svc-icon-preview" id="adSvcIcon-${id}" style="background:${s.color}22;color:${s.color}">${s.icon}</div>
          <span class="avatar-cam">📷</span>
          <input type="file" accept="image/*" onchange="uploadServiceIconAdmin(this,'${id}')" hidden/>
        </label>
        <div>
          <div style="font-weight:700;font-size:.95rem;color:var(--ch)">${s.title}</div>
          <div style="font-size:.8rem;color:var(--sl)">${s.tag}</div>
          <button type="button" onclick="resetServiceIconAdmin('${id}')" style="margin-top:.3rem;background:none;border:none;color:var(--b2);font-size:.75rem;cursor:pointer;padding:0">Reset icon to default</button>
        </div>
      </div>
      <div class="fg"><label>Title</label><input id="adSvcTitle-${id}" placeholder="${s.title}"/></div>
      <div class="fg"><label>Tagline</label><input id="adSvcTag-${id}" placeholder="${s.tag}"/></div>
      <div class="fg"><label>Description</label><textarea id="adSvcDesc-${id}" placeholder="${s.desc}" style="min-height:80px"></textarea></div>
      <div class="fg"><label>What's Included (one feature per line)</label><textarea id="adSvcFeatures-${id}" placeholder="${s.features.join('\n')}" style="min-height:90px"></textarea></div>
      <div class="fg"><label>📋 Available Services (one sub-service per line)</label><textarea id="adSvcSubs-${id}" placeholder="${(s.subServices||[]).join('\n')}" style="min-height:100px"></textarea></div>
      <div class="fg"><label>💎 Benefits (one per line)</label><textarea id="adSvcBenefits-${id}" placeholder="${(s.benefits||[]).join('\n')}" style="min-height:80px"></textarea></div>
      <div class="fg"><label>📝 Analysis Notes / Write-up (shown under the sample chart)</label><textarea id="adSvcNotes-${id}" placeholder="Optional write-up describing a real project's analysis, methodology or results..." style="min-height:80px"></textarea></div>
      <div style="display:flex;align-items:center;gap:.9rem;margin-bottom:1.1rem">
        <button class="db1 dba" onclick="saveServiceAdmin('${id}')">Save ${s.title}</button>
        <span id="adSvcStatus-${id}" style="font-size:.78rem;color:var(--sl)"></span>
      </div>
      <div class="fg" style="margin-bottom:.4rem">
        <label>🖼️ Sample Graphs, Screenshots &amp; Deliverables</label>
        <input type="file" id="adSvcGalleryInput-${id}" accept="image/*" multiple/>
      </div>
      <button class="bsec" onclick="uploadServiceGalleryAdmin('${id}')">⬆ Upload Images</button>
      <span id="adSvcGalleryStatus-${id}" style="font-size:.78rem;color:var(--sl);margin-left:.6rem"></span>
      <div class="svc-gallery-admin" id="adSvcGallery-${id}"></div>
      <div class="fg" style="margin:1rem 0 .4rem">
        <label>📊 Dashboard Screenshots (Power BI, Excel, SPSS, R, STATA output...)</label>
        <input type="file" id="adSvcDashInput-${id}" accept="image/*" multiple/>
      </div>
      <button class="bsec" onclick="uploadServiceDashboardAdmin('${id}')">⬆ Upload Dashboards</button>
      <span id="adSvcDashStatus-${id}" style="font-size:.78rem;color:var(--sl);margin-left:.6rem"></span>
      <div class="svc-gallery-admin" id="adSvcDash-${id}"></div>
    </div>`
  }).join('')
  Object.keys(SERVICES_DATA).forEach(async id=>{
    try{
      const doc = await fbDB.collection('services').doc(id).get()
      const data = doc.exists ? doc.data() : {}
      if(data.iconURL) document.getElementById('adSvcIcon-'+id).innerHTML=svcIconHTML(null,data.iconURL)
      document.getElementById('adSvcTitle-'+id).value = data.title||''
      document.getElementById('adSvcTag-'+id).value = data.tag||''
      document.getElementById('adSvcDesc-'+id).value = data.desc||''
      document.getElementById('adSvcFeatures-'+id).value = (data.features||[]).join('\n')
      document.getElementById('adSvcSubs-'+id).value = (data.subServices||[]).join('\n')
      document.getElementById('adSvcBenefits-'+id).value = (data.benefits||[]).join('\n')
      document.getElementById('adSvcNotes-'+id).value = data.analysisNotes||''
    }catch(e){ /* leave fields blank if nothing saved yet */ }
    loadServiceGalleryAdmin(id)
    loadServiceDashboardAdmin(id)
  })
}
async function uploadServiceIconAdmin(input,id){
  const file = input.files && input.files[0]
  if(!file) return
  if(!file.type.startsWith('image/')){ alert('Please choose an image file.'); input.value=''; return }
  const statusEl = document.getElementById('adSvcStatus-'+id)
  const reader = new FileReader()
  reader.onload = e => { document.getElementById('adSvcIcon-'+id).innerHTML = `<img src="${e.target.result}" alt="">` }
  reader.readAsDataURL(file)
  if(statusEl){ statusEl.style.color='var(--sl)'; statusEl.textContent='Uploading icon...' }
  try{
    const path = `service-icons/${id}_${Date.now()}_${file.name}`
    const ref = fbStorage.ref(path)
    await ref.put(file)
    const url = await ref.getDownloadURL()
    await fbDB.collection('services').doc(id).set({iconURL:url},{merge:true})
    document.getElementById('adSvcIcon-'+id).innerHTML = svcIconHTML(null,url)
    const cardIcon=document.getElementById('svcCardIcon-'+id); if(cardIcon) cardIcon.innerHTML=svcIconHTML(null,url)
    if(statusEl){ statusEl.style.color='#107C10'; statusEl.textContent='✓ Icon updated across the site.' }
  }catch(e){
    if(statusEl){ statusEl.style.color='#D13438'; statusEl.textContent='⚠ Upload failed: '+e.message }
  }
  input.value=''
}
async function resetServiceIconAdmin(id){
  if(!confirm('Reset this icon back to the default?')) return
  const s=SERVICES_DATA[id]
  const statusEl = document.getElementById('adSvcStatus-'+id)
  try{
    await fbDB.collection('services').doc(id).set({iconURL:firebase.firestore.FieldValue.delete()},{merge:true})
    document.getElementById('adSvcIcon-'+id).innerHTML = s.icon
    const cardIcon=document.getElementById('svcCardIcon-'+id); if(cardIcon) cardIcon.innerHTML = s.icon
    if(statusEl){ statusEl.style.color='#107C10'; statusEl.textContent='✓ Icon reset to default.' }
  }catch(e){
    if(statusEl){ statusEl.style.color='#D13438'; statusEl.textContent='⚠ Could not reset: '+e.message }
  }
}
async function saveServiceAdmin(id){
  const statusEl = document.getElementById('adSvcStatus-'+id)
  const featuresText = document.getElementById('adSvcFeatures-'+id).value.trim()
  const subsText = document.getElementById('adSvcSubs-'+id).value.trim()
  const benefitsText = document.getElementById('adSvcBenefits-'+id).value.trim()
  const payload = {
    title: document.getElementById('adSvcTitle-'+id).value.trim(),
    tag: document.getElementById('adSvcTag-'+id).value.trim(),
    desc: document.getElementById('adSvcDesc-'+id).value.trim(),
    features: featuresText ? featuresText.split('\n').map(f=>f.trim()).filter(Boolean) : [],
    subServices: subsText ? subsText.split('\n').map(f=>f.trim()).filter(Boolean) : [],
    benefits: benefitsText ? benefitsText.split('\n').map(f=>f.trim()).filter(Boolean) : [],
    analysisNotes: document.getElementById('adSvcNotes-'+id).value.trim()
  }
  // don't overwrite with blanks — only save fields the admin actually filled in
  Object.keys(payload).forEach(k=>{ if(!payload[k] || (Array.isArray(payload[k]) && !payload[k].length)) delete payload[k] })
  if(statusEl){ statusEl.style.color='var(--sl)'; statusEl.textContent='Saving...' }
  try{
    await fbDB.collection('services').doc(id).set(payload,{merge:true})
    const s=SERVICES_DATA[id]
    const cardTitle=document.getElementById('svcCardTitle-'+id); if(cardTitle) cardTitle.textContent=payload.title||s.title
    const cardTools=document.getElementById('svcCardTools-'+id); if(cardTools) cardTools.textContent=payload.tag||s.tag
    if(statusEl){ statusEl.style.color='#107C10'; statusEl.textContent='✓ Saved — now live on the website.' }
  }catch(e){
    if(statusEl){ statusEl.style.color='#D13438'; statusEl.textContent='⚠ Could not save: '+e.message }
  }
}
async function uploadServiceGalleryAdmin(id){
  const input=document.getElementById('adSvcGalleryInput-'+id)
  const statusEl=document.getElementById('adSvcGalleryStatus-'+id)
  if(!input || !input.files || !input.files.length){
    if(statusEl){statusEl.style.color='#D13438';statusEl.textContent='⚠ Choose at least one image first.'}
    return
  }
  if(statusEl){statusEl.style.color='var(--sl)';statusEl.textContent='Uploading...'}
  try{
    for(const f of [...input.files]){
      const path=`service-gallery/${id}/${Date.now()}_${f.name}`
      const ref=fbStorage.ref(path)
      await ref.put(f)
      const url=await ref.getDownloadURL()
      await fbDB.collection('services').doc(id).collection('gallery').add({url,path,name:f.name,uploadedAt:Date.now()})
    }
    if(statusEl){statusEl.style.color='#107C10';statusEl.textContent='✓ Uploaded! Now visible on the service page.'}
    input.value=''
    loadServiceGalleryAdmin(id)
  }catch(e){
    if(statusEl){statusEl.style.color='#D13438';statusEl.textContent='⚠ Upload failed: '+e.message}
  }
}
async function loadServiceGalleryAdmin(id){
  const grid=document.getElementById('adSvcGallery-'+id)
  if(!grid) return
  try{
    const snap=await fbDB.collection('services').doc(id).collection('gallery').orderBy('uploadedAt','desc').get()
    grid.innerHTML=snap.empty ? '' : snap.docs.map(d=>{
      const data=d.data()
      return `<div><img src="${data.url}"/><button onclick="deleteServiceGalleryImage('${id}','${d.id}','${(data.path||'').replace(/'/g,"\\'")}')" title="Remove">✕</button></div>`
    }).join('')
  }catch(e){
    grid.innerHTML='<div style="color:#D13438;font-size:.78rem">Could not load images: '+e.message+'</div>'
  }
}
async function deleteServiceGalleryImage(id,galleryId,path){
  if(!confirm('Remove this image from the service page?')) return
  try{
    if(path) await fbStorage.ref(path).delete()
    await fbDB.collection('services').doc(id).collection('gallery').doc(galleryId).delete()
    loadServiceGalleryAdmin(id)
  }catch(e){
    alert('Could not delete: '+e.message)
  }
}
async function uploadServiceDashboardAdmin(id){
  const input=document.getElementById('adSvcDashInput-'+id)
  const statusEl=document.getElementById('adSvcDashStatus-'+id)
  if(!input || !input.files || !input.files.length){
    if(statusEl){statusEl.style.color='#D13438';statusEl.textContent='⚠ Choose at least one image first.'}
    return
  }
  if(statusEl){statusEl.style.color='var(--sl)';statusEl.textContent='Uploading...'}
  try{
    for(const f of [...input.files]){
      const path=`service-dashboards/${id}/${Date.now()}_${f.name}`
      const ref=fbStorage.ref(path)
      await ref.put(f)
      const url=await ref.getDownloadURL()
      await fbDB.collection('services').doc(id).collection('dashboards').add({url,path,name:f.name,uploadedAt:Date.now()})
    }
    if(statusEl){statusEl.style.color='#107C10';statusEl.textContent='✓ Uploaded! Now visible in the Dashboards tab.'}
    input.value=''
    loadServiceDashboardAdmin(id)
  }catch(e){
    if(statusEl){statusEl.style.color='#D13438';statusEl.textContent='⚠ Upload failed: '+e.message}
  }
}
async function loadServiceDashboardAdmin(id){
  const grid=document.getElementById('adSvcDash-'+id)
  if(!grid) return
  try{
    const snap=await fbDB.collection('services').doc(id).collection('dashboards').orderBy('uploadedAt','desc').get()
    grid.innerHTML=snap.empty ? '' : snap.docs.map(d=>{
      const data=d.data()
      return `<div><img src="${data.url}"/><button onclick="deleteServiceDashboardImage('${id}','${d.id}','${(data.path||'').replace(/'/g,"\\'")}')" title="Remove">✕</button></div>`
    }).join('')
  }catch(e){
    grid.innerHTML='<div style="color:#D13438;font-size:.78rem">Could not load images: '+e.message+'</div>'
  }
}
async function deleteServiceDashboardImage(id,dashId,path){
  if(!confirm('Remove this dashboard screenshot?')) return
  try{
    if(path) await fbStorage.ref(path).delete()
    await fbDB.collection('services').doc(id).collection('dashboards').doc(dashId).delete()
    loadServiceDashboardAdmin(id)
  }catch(e){
    alert('Could not delete: '+e.message)
  }
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


// ══════════════════════════════════════════════════════════════════
// OFFICIAL LETTERHEAD — used across every generated PDF document
// (invoices, reports, payslips, P9 forms)
// ══════════════════════════════════════════════════════════════════
const LH_LOGO='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwMDAgQDAwMEBAQFBgoGBgUFBgwICQcKDgwPDg4MDQ0PERYTDxAVEQ0NExoTFRcYGRkZDxIbHRsYHRYYGRj/2wBDAQQEBAYFBgsGBgsYEA0QGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBj/wAARCAGZAfQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7+ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKRmVVLMQAOSTQByXxL8aab4A+GeqeJNUcLDBC2MnqxBxXmv7KHjnUPiF8HbrxBf4y99IseBj5e1fN37Wvxcl+IPi6X4deHrwtpFmD9tZDwXHava/2E4hB+zIIh/DfSD9a2lQnGmqjWj2JU05OJ9PUUUViUFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRQSAMk4AoAD0r5Y/ap/aBHhLQ38D+EblZdcvwYneI8wD146Vp/tC/tMaT4D0yXw34VuEv8AxBcAxgQnd5JPc18R29tf3+sT+IvENw13qt02+SRznGewr1MsyyeNqdordnPiMQqS8xml6W1hpVzNdSGa9uFZ55W5LMepzX2D+wvPKvwr1Cz3ExLcuwHoc18pSnNrNn+4a+qf2Gf+Sdal/wBfDfzr2+JKUaVGlCCskcmAk5Sk2fW1FFFfIHphRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRWF401ubw38PtY163jEktlavOinoSBmgC7rGt6XoGky6lq97Fa20Q3M8jYwK+MPjn+1xc6q83hH4UOZC2Ul1RDwnY4rwTxX8TviL8Zrg6lr+qy2Gmu5AtbZyFYZ6GqNjp1nptuIrSFUx1YDk19FluQTr2qVtI/izhr41Q92GrKun6O0V3JqmqXDX2pzndJcSHJJrUoor7WjRhRgoU1ZI8mU3N3kNk/49Zf9w19S/sNXMA8Dana7/wB8J2JX2zXy2/8AqZP9019E/sRcajq6jgbm4r5zihXpQfmd+Xv3mj7Wooor4s9UKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK4/4rf8AJE/FH/YOl/8AQa7CuP8Ait/yRPxR/wBg6X/0GgD8tvB5P/CHRc/xt/M1t1ieDv8AkTov99v51t1+p4L/AHen6I+drfxJeoUUUV0mYjf6mT/dNfRX7Ef/ACEtX+pr52bmNx6ive/2JdREfjbWdIZPmVS+6vmeJ0/Ywfmehl/xs+46KKK+JPWCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKK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'
const LH_FOOTER='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAB2BXgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7LooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiig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190UY+v517+QZ2soqTqez5+ZW3tp9zOXFYb6wkr2sUNC1bTdb09b/SruO6tmJAdM9e4IPIPPQ1foorwpuLk+Vaf16HSr21DA9KKKKkYYooooAMCjA9KKKACiiigAwPSjA9KKKACiiigAooooAKKKKACiiigAooooAMD0owPSiigAwKMCiigAwKKKKACiiigAooooAKMD0oooAMCiiigAoxRRQAUUUUAFFFFABRRRQAUYFFFABRRRQAYHpRRRQAUYHpRRQAUUUUAFGB6UUUAGB6UUUUAFFFFABgUUUUAGKKKKADA9KKKKADAowPSiigAooooAKMUUUAFGKKKACiiigAwPSjA9KKKADAowKKKADAooooAKKKKACiiigAwKMD0oooAMCorsT/ZZRa+WJ9h8vf8Ad3Y4z7ZxUtFNOzA+XPBOnaHZaxrUvx18L6hLr1xc7k1K6sZJrWSPAAVDCpUcg89wR6Yq/wCPNA+Euu+G7qw8AeD7vUtflTZZvplhcRLFJ2aSRwIwo77u1fSmKMV9RLiabrKulKLVvdU2oadOW10vLmOJYNcvLo/O2v3/APAOQ+Dfhe68HfDbR/D19Kkl3bxs05Q5UO7s5UHuAWxnviuvxRRXzmIrzxFaVafxSbb9XqdcIqEVFdAowPSiisSgwKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//Z'
// Draws the white logo badge (icon + wordmark) — call inside a coloured header band
function lhLogoBadge(doc,x,y,h){
  const w=h*(500/409)
  doc.setFillColor(255,255,255)
  doc.roundedRect(x,y,w+4,h+4,2,2,'F')
  doc.addImage(LH_LOGO,'JPEG',x+2,y+2,w,h)
  return w+4 // returns badge width so callers can position text after it
}
// Draws the "Turning Complex Data..." tagline band — call near the bottom of a page
function lhFooterTagline(doc,pw,y){
  const w=pw-20, h=w*(118/1400)
  doc.addImage(LH_FOOTER,'JPEG',10,y,w,h)
  return h
}
// Stamps the tagline band on every page of a finished document (call right before doc.save)
function lhStampAllPages(doc,marginFromBottom){
  const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight()
  const pages=doc.internal.getNumberOfPages()
  for(let i=1;i<=pages;i++){ doc.setPage(i); lhFooterTagline(doc,pw,ph-marginFromBottom) }
}

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
  doc.setFontSize(9.5)
  doc.text('StatVision Research and Consultancy',62.6,15)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8)
  doc.setTextColor(200,210,230)
  doc.text('Professional Data Analysis & Research Services',62.6,22)
  doc.text('Nairobi, Kenya  ·  hello@statvisionconsultancy.co.ke',62.6,28)
  doc.text('+254 748 216 918  ·  www.statvisionconsultancy.co.ke',62.6,34)
  lhLogoBadge(doc,mg,4,34)

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
  lhFooterTagline(doc,pw,ph-18-19)
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
  const t={overview:'Admin Overview',orders:'All Orders',tracker:'Project Tracker',clients:'Client Management',analysts:'Analyst Accounts',finance:'Financial Management',reports:'Reports & Analytics',notifs:'Notification Centre',content:'Website Content',services:'Manage Services',team:'Team Profiles',profile:'My Profile'}
  document.getElementById('adTabTitle').textContent=t[n]||n
  renderSQL()
  if(n==='finance') renderFinance()
  if(n==='reports') renderReports()
  if(n==='clients') renderAdminClients()
  if(n==='notifs') renderAdminNotifications([])
  if(n==='content') loadSiteImages()
  if(n==='services') renderAdminServicesPanel()
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
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(10.5)
  doc.text('StatVision Research and Consultancy',58,13)
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(200,210,230)
  doc.text('Statistical Business Report — Comprehensive Analytics',58,19.5)
  doc.text('Generated: '+today+'   |   Total Orders Analysed: '+n,58,26)
  lhLogoBadge(doc,mg,4,28)
  doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(...white)
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
  lhStampAllPages(doc,28)

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
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(12.5)
  doc.text('StatVision Research and Consultancy',58,15)
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(200,210,230)
  doc.text('Nairobi, Kenya  ·  hello@statvisionconsultancy.co.ke',58,21.5)
  doc.text('+254 748 216 918',58,27)
  lhLogoBadge(doc,mg,4,28)
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
  y+=6
  lhFooterTagline(doc,pw,y)

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
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(11.5)
  doc.text('StatVision Research and Consultancy',58,14)
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(200,210,230)
  doc.text('Nairobi, Kenya  ·  hello@statvisionconsultancy.co.ke',58,20.5)
  doc.text('+254 748 216 918  ·  PIN: P051234567Z',58,26)
  lhLogoBadge(doc,mg,4,28)
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
  lhStampAllPages(doc,30)

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