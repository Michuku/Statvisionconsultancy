// service-details.js — StatVision service detail page (data + core logic)
// Depends on: carousel.js, tabs.js, gallery.js (load this file after those three)

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
