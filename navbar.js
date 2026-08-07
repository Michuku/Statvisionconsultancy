/* ===================================================================
   StatVision — Premium mega-dropdown navigation (Services / Industries
   / About Us). Vanilla JS only. Builds three reusable dropdown menus
   from data arrays below, wires hover/click (desktop) and tap-to-
   expand (mobile), keeps only one menu open at a time, closes on
   outside click / Esc, and opens either an existing StatVision page
   (service modal, team modal) or a lightweight "info page" modal for
   items that don't have a dedicated page yet.
   =================================================================== */
(function(){

  /* ---------------------------------------------------------------
     Small icon set — 24x24 stroke icons, single color (currentColor)
     so they pick up the StatVision blue automatically on hover.
     --------------------------------------------------------------- */
  function ico(inner){
    return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+inner+'</svg>'
  }
  var ICONS = {
    barChart:   ico('<path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-7"/>'),
    activity:   ico('<path d="M3 12h4l2 7 4-14 2 7h6"/>'),
    clipboard:  ico('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1"/><path d="M9 11h6M9 15h6"/>'),
    database:   ico('<ellipse cx="12" cy="5" rx="7" ry="2.5"/><path d="M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>'),
    pieChart:   ico('<path d="M12 3v9l7.5 4.3"/><circle cx="12" cy="12" r="9"/>'),
    gradCap:    ico('<path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11.5V17c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5.5"/>'),
    landmark:   ico('<path d="M3 21h18"/><path d="M4 21V10M20 21V10"/><path d="M2 10l10-6 10 6"/><path d="M8 21v-7M12 21v-7M16 21v-7"/>'),
    globeAlt:   ico('<circle cx="12" cy="12" r="9"/><path d="M3 9h18M3 15h18"/><path d="M12 3a14 14 0 010 18 14 14 0 010-18z"/>'),
    globe:      ico('<circle cx="12" cy="12" r="9"/><path d="M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18"/><path d="M3.6 8.5h16.8M3.6 15.5h16.8"/>'),
    heart:      ico('<path d="M12 20s-7-4.4-9.3-8.8C1.2 8 2.5 4.7 5.8 4.1c1.9-.3 3.6.6 4.7 2.2C11.6 4.7 13.3 3.8 15.2 4.1c3.3.6 4.6 3.9 3.1 7.1C20 15.6 12 20 12 20z"/><path d="M8 12h2l1.2-2.4L12.6 14 14 12h2"/>'),
    book:       ico('<path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 16.5v-12z"/><path d="M4 16.5A2.5 2.5 0 016.5 19H20"/>'),
    leaf:       ico('<path d="M20 4c0 9-5 14-14 14H4c0-9 5-14 14-14h2z"/><path d="M6 18c4-4 8-7 14-10"/>'),
    banknote:   ico('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>'),
    factory:    ico('<path d="M3 21V11l5 3v-3l5 3V7l6 4v10H3z"/><path d="M7 21v-4M12 21v-4M17 21v-4"/>'),
    bolt:       ico('<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>'),
    wifi:       ico('<path d="M2 8.5a16 16 0 0120 0"/><path d="M5.5 12.5a11 11 0 0113 0"/><path d="M9 16.5a5.5 5.5 0 016 0"/><path d="M12 20v.01"/>'),
    mapPin:     ico('<path d="M12 21s7-7.3 7-12a7 7 0 10-14 0c0 4.7 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
    store:      ico('<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9.5 20v-6h5v6"/><path d="M3 9c0 1.4 1.1 2.5 2.5 2.5S8 10.4 8 9c0 1.4 1.1 2.5 2.5 2.5S13 10.4 13 9c0 1.4 1.1 2.5 2.5 2.5S18 10.4 18 9c0 1.4 1.1 2.5 2.5 2.5S23 10.4 23 9"/>'),
    fileText:   ico('<path d="M6 2h9l5 5v15H6V2z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 17h6"/>'),
    compass:    ico('<circle cx="12" cy="12" r="9"/><path d="M15 9l-2 6-6 2 2-6 6-2z"/>'),
    target:     ico('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    award:      ico('<circle cx="12" cy="8" r="6"/><path d="M8.5 13.5L7 22l5-3 5 3-1.5-8.5"/>'),
    userCircle: ico('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.3 18.5c1.2-2.3 3.3-3.5 5.7-3.5s4.5 1.2 5.7 3.5"/>'),
    users:      ico('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 14.6c2.6.4 4.5 2.4 4.5 5.4"/>'),
    star:       ico('<path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6L12 3z"/>'),
    handshake:  ico('<path d="M2 12l5-4 4 3 4-3 5 4"/><path d="M2 12l4 4 2-1M22 12l-4 4-2-1"/><path d="M9 11l3 5 3-5"/>'),
    briefcase:  ico('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 12h18"/>'),
    mail:       ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6.5l9 6.5 9-6.5"/>'),
    camera:     ico('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>'),
    calculator: ico('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01"/>'),
    calendar:   ico('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M9 15l2 2 4-4"/>')
  }

  /* ---------------------------------------------------------------
     Menu data
     --------------------------------------------------------------- */
  var SERVICES_MENU = [
    { key:'statistical', label:'Statistical Analysis', desc:'SPSS, Stata, R &amp; Python-driven statistical modelling.', icon:'barChart' },
    { key:'monitoring',  label:'Monitoring &amp; Evaluation', desc:'M&amp;E frameworks, baselines and impact evaluations.', icon:'activity' },
    { key:'research',    label:'Research Consultancy', desc:'Study design, proposal writing and report authoring.', icon:'clipboard' },
    { key:'cleaning',    label:'Data Cleaning &amp; Management', desc:'Validation, cleaning and secure data management.', icon:'database' },
    { key:'powerbi',     label:'Power BI Dashboards &amp; Data Visualization', desc:'Interactive dashboards that turn data into decisions.', icon:'pieChart' },
    { key:'training',    label:'Learning &amp; Capacity Building', desc:'Hands-on training in SPSS, STATA, R, Python &amp; Power BI.', icon:'gradCap' }
  ]

  var INDUSTRIES_MENU = [
    { key:'gov',    label:'Government &amp; Public Sector', desc:'Planning, policy development, monitoring and statistical analysis.', icon:'landmark',
      body:['We support national and county ministries, departments and agencies with policy-relevant research, programme evaluation and statistics that stand up to scrutiny.','From budget-linked results frameworks to census-scale data processing, our work helps public institutions plan, monitor and report with confidence.'],
      bullets:['Policy research &amp; evidence reviews','Programme monitoring &amp; evaluation','Public expenditure &amp; performance analysis'] },
    { key:'ngo',    label:'Non-Governmental Organizations (NGOs)', desc:'M&amp;E systems, impact assessments and donor-ready reporting.', icon:'globeAlt',
      body:['NGOs trust StatVision to build M&amp;E systems that satisfy donor requirements while remaining genuinely useful for programme decisions.','We support the full project cycle — from baseline through endline — with rigorous, field-tested methodology.'],
      bullets:['Baseline, midline &amp; endline surveys','Log frame &amp; indicator design','Donor &amp; compliance reporting'] },
    { key:'intl',   label:'International Development Partners', desc:'Rigorous evaluation and evidence for multi-country programmes.', icon:'globe',
      body:['We work alongside development partners and implementing agencies on evaluations and research that inform funding and policy decisions across multiple countries.','Our teams are experienced with donor evaluation standards and large, multi-site data collection.'],
      bullets:['Impact &amp; outcome evaluations','Multi-country data collection','Evidence synthesis for funders'] },
    { key:'health', label:'Healthcare &amp; Public Health', desc:'Health surveys, epidemiological analysis and clinical data management.', icon:'heart',
      body:['StatVision supports health facilities, researchers and public health programmes with survey design, epidemiological analysis and secure data management.','We help translate clinical and population health data into insights that guide interventions.'],
      bullets:['Health &amp; demographic surveys','Epidemiological &amp; outcomes analysis','Clinical data management'] },
    { key:'edu',    label:'Education &amp; Research Institutions', desc:'Learning outcome studies, institutional research and analytics.', icon:'book',
      body:['We partner with schools, universities and research institutions on learning outcome studies, enrolment analytics and thesis/dissertation data analysis.','Our reporting is built to meet academic and institutional review standards.'],
      bullets:['Learning outcome &amp; assessment studies','Institutional research &amp; enrolment analytics','Thesis &amp; dissertation data analysis'] },
    { key:'agri',   label:'Agriculture &amp; Food Security', desc:'Yield forecasting, value-chain surveys and food security assessments.', icon:'leaf',
      body:['From smallholder value chains to national food security monitoring, we bring statistical rigor to agricultural research and programme evaluation.','Our field teams are experienced in household and market-level data collection.'],
      bullets:['Yield &amp; production forecasting','Value-chain &amp; market surveys','Food security assessments'] },
    { key:'fin',    label:'Financial Institutions', desc:'Risk modelling, customer analytics and market research.', icon:'banknote',
      body:['Banks, SACCOs and microfinance institutions rely on us for credit risk modelling, customer analytics and market research grounded in real portfolio data.','We help translate statistical models into decisions that protect and grow the loan book.'],
      bullets:['Credit &amp; default risk modelling','Customer segmentation &amp; analytics','Market &amp; product research'] },
    { key:'mfg',    label:'Manufacturing &amp; Industrial Sector', desc:'Production analytics, quality data and performance dashboards.', icon:'factory',
      body:['We help manufacturers make sense of production, quality and supply chain data through analytics and Power BI dashboards built for the shop floor and the boardroom.','Our work focuses on turning operational data into measurable efficiency gains.'],
      bullets:['Production &amp; quality analytics','Supply chain data management','Executive performance dashboards'] },
    { key:'energy', label:'Energy &amp; Environment', desc:'Environmental data analysis and sustainability reporting.', icon:'bolt',
      body:['StatVision supports energy and environmental organizations with data management, monitoring and analysis for sustainability and compliance reporting.','We help quantify impact across environmental and resource-management programmes.'],
      bullets:['Environmental &amp; sustainability data','Programme monitoring &amp; evaluation','Compliance-ready reporting'] },
    { key:'ict',    label:'ICT &amp; Telecommunications', desc:'Usage analytics, market research and BI dashboards.', icon:'wifi',
      body:['We help ICT and telecom organizations analyse usage data, run market research and build dashboards that track customer and network performance.','Our analytics support both strategic planning and day-to-day operations.'],
      bullets:['Usage &amp; customer analytics','Market &amp; competitor research','Power BI performance dashboards'] },
    { key:'county', label:'County Governments', desc:'County-level planning data, M&amp;E and performance reporting.', icon:'mapPin',
      body:['We support county governments with the statistics, monitoring frameworks and dashboards needed for CIDP planning, budgeting and performance reporting.','Our teams have delivered multi-county surveys and evaluations across Kenya.'],
      bullets:['CIDP-aligned planning data','County M&amp;E frameworks','Performance &amp; budget dashboards'] },
    { key:'sme',    label:'Private Sector &amp; SMEs', desc:'Business intelligence, market sizing and customer research.', icon:'store',
      body:['Small and growing businesses work with us for practical, affordably-scoped market research, customer analytics and Power BI dashboards.','We tailor the depth of analysis to the size and stage of the business.'],
      bullets:['Market sizing &amp; feasibility research','Customer satisfaction studies','Business intelligence dashboards'] }
  ]

  var ABOUT_MENU = [
    { key:'profile',  label:'Company Profile', desc:'An overview of who StatVision is and what we deliver.', icon:'fileText', action:'info',
      body:['StatVision Research &amp; Consultancy is a Nairobi-based data analysis and research firm helping organizations turn raw data into decisions they can act on.','We combine statistical expertise in SPSS, Stata, R and Python with hands-on experience in monitoring &amp; evaluation, business intelligence, and research consultancy — serving government, NGOs, development partners, and the private sector.'],
      bullets:['Founded on statistical rigor and practical delivery','Multi-sector experience across East Africa','A single partner for research, analytics &amp; reporting'] },
    { key:'story',    label:'Our Story', desc:'How StatVision came to be.', icon:'compass', action:'info',
      body:['StatVision began with a simple observation: organizations were collecting more data than ever, yet struggling to turn it into decisions.','What started as an independent statistical consultancy has grown into a full-service research, M&amp;E and analytics firm trusted by clients across government, development and the private sector.'],
      bullets:[] },
    { key:'vision',   label:'Vision &amp; Mission', desc:'What drives our work every day.', icon:'target', action:'info',
      body:['<strong>Vision:</strong> To be East Africa\u2019s most trusted partner for data-driven decision-making.','<strong>Mission:</strong> To equip organizations with the statistical expertise, tools and insight they need to plan, monitor and grow with confidence.'],
      bullets:[] },
    { key:'values',   label:'Core Values', desc:'The principles behind every engagement.', icon:'award', action:'info',
      body:['Every engagement at StatVision is guided by four principles that shape how we work with clients and with their data.'],
      bullets:['Accuracy First — every analysis is validated for statistical soundness','Client Partnership — we work alongside you, not just for you','Actionable Insights — reports built for decisions, not just numbers','Confidentiality — client data handled with strict discretion'] },
    { key:'ceo',      label:'Meet the CEO', desc:'Learn about the leadership driving StatVision.', icon:'userCircle', action:'team', target:'henry' },
    { key:'team',     label:'Our Team', desc:'The analysts, statisticians and consultants behind the work.', icon:'users', action:'scroll', target:'about' },
    { key:'why',      label:'Why Choose StatVision', desc:'What sets our approach apart.', icon:'star', action:'info',
      body:['Clients choose StatVision for the combination of statistical depth and practical, decision-ready delivery.'],
      bullets:['Rigorous methodology across SPSS, Stata, R &amp; Python','Sector experience spanning government, NGOs &amp; the private sector','Clear, decision-ready reporting — not just raw numbers','Responsive, partnership-style client support'] },
    { key:'partners', label:'Partners &amp; Clients', desc:'Organizations that trust StatVision.', icon:'handshake', action:'info',
      body:['We\u2019re proud to have worked with government agencies, NGOs, development partners, financial institutions and private companies across the region.','Our portfolio spans monitoring &amp; evaluation, business intelligence and research consultancy engagements — a snapshot is available in our Portfolio section.'],
      bullets:[] },
    { key:'careers',  label:'Careers', desc:'Join the StatVision team.', icon:'briefcase', action:'info',
      body:['We\u2019re always glad to hear from skilled statisticians, data analysts, researchers and M&amp;E specialists.','There are no open roles listed at the moment, but you\u2019re welcome to send your CV via the Contact page and we\u2019ll reach out when a suitable opportunity comes up.'],
      bullets:[] },
    { key:'contact',  label:'Contact Us', desc:'Get in touch with the StatVision team.', icon:'mail', action:'scroll', target:'contact' }
  ]

  window.STATVISION_SERVICES_MENU  = SERVICES_MENU
  window.STATVISION_INDUSTRIES_MENU = INDUSTRIES_MENU
  window.STATVISION_ABOUT_MENU     = ABOUT_MENU

  var MORE_MENU = [
    { key:'gallery',   label:'Gallery', desc:'Photos from our office, field work, training and events.', icon:'camera', action:'scroll', target:'gallery' },
    { key:'resources', label:'Resources Centre', desc:'Articles, templates, reports, datasets and training materials.', icon:'fileText', action:'scroll', target:'resources' },
    { key:'insights',  label:'Insights', desc:'Practical articles on statistics, research and analytics.', icon:'book', action:'scroll', target:'insights' },
    { key:'quote',     label:'Get a Quote', desc:'Instant, indicative pricing for your project.', icon:'calculator', action:'scroll', target:'quote' },
    { key:'booking',   label:'Book a Consultation', desc:'Schedule time with a StatVision consultant.', icon:'calendar', action:'scroll', target:'booking' }
  ]
  window.STATVISION_MORE_MENU = MORE_MENU

  /* ---------------------------------------------------------------
     Rendering helpers
     --------------------------------------------------------------- */
  function itemHTML(it, kind){
    var icon = ICONS[it.icon] || ''
    return '<button type="button" class="nav-dd-item" data-kind="'+kind+'" data-key="'+it.key+'" role="menuitem">'+
             '<span class="nav-dd-ico">'+icon+'</span>'+
             '<span class="nav-dd-text"><span class="nav-dd-title">'+it.label+'</span>'+
             '<span class="nav-dd-desc">'+it.desc+'</span></span>'+
           '</button>'
  }
  function panelHTML(items, kind, grid){
    return '<div class="nav-dd-list'+(grid?' nav-dd-list--grid':'')+'">'+items.map(function(it){return itemHTML(it,kind)}).join('')+'</div>'
  }

  function renderAll(){
    var map = [
      { id:'servicesMegaMenu',   mobile:'servicesMobilePanel',   items:SERVICES_MENU,   kind:'service',  grid:false },
      { id:'industriesMegaMenu', mobile:'industriesMobilePanel', items:INDUSTRIES_MENU, kind:'industry', grid:true  },
      { id:'aboutMegaMenu',      mobile:'aboutMobilePanel',      items:ABOUT_MENU,      kind:'about',    grid:true  },
      { id:'moreMegaMenu',       mobile:'moreMobilePanel',       items:MORE_MENU,       kind:'more',     grid:true  }
    ]
    map.forEach(function(m){
      var d = document.getElementById(m.id)
      var mo = document.getElementById(m.mobile)
      if(d)  d.innerHTML  = panelHTML(m.items, m.kind, m.grid)
      if(mo) mo.innerHTML = panelHTML(m.items, m.kind, false)
    })
  }

  /* ---------------------------------------------------------------
     Generic dropdown wiring — only one open at a time, hover/click
     (desktop), outside-click + Esc close, arrow-key navigation.
     --------------------------------------------------------------- */
  var desktopWraps = []
  var mobileWraps = []

  function closeAllDesktop(except){
    desktopWraps.forEach(function(w){
      if(w.wrap === except) return
      w.wrap.classList.remove('open')
      w.trigger.setAttribute('aria-expanded','false')
    })
  }
  function closeAllMobile(except){
    mobileWraps.forEach(function(w){
      if(w.wrap === except) return
      w.wrap.classList.remove('open')
      w.trigger.setAttribute('aria-expanded','false')
    })
  }

  function wireDesktopDropdown(wrapId){
    var wrap = document.getElementById(wrapId)
    if(!wrap) return
    var trigger = wrap.querySelector('.nav-dropdown-trigger')
    var panel = wrap.querySelector('.nav-dd-panel')
    var closeTimer = null
    var entry = { wrap:wrap, trigger:trigger }
    desktopWraps.push(entry)

    function open(){ closeAllDesktop(wrap); wrap.classList.add('open'); trigger.setAttribute('aria-expanded','true') }
    function close(){ wrap.classList.remove('open'); trigger.setAttribute('aria-expanded','false') }

    wrap.addEventListener('mouseenter',function(){ clearTimeout(closeTimer); open() })
    wrap.addEventListener('mouseleave',function(){ closeTimer=setTimeout(close,180) })
    trigger.addEventListener('click',function(e){
      e.preventDefault()
      if(wrap.classList.contains('open')) close(); else open()
    })
    trigger.addEventListener('keydown',function(e){
      if(e.key==='Enter' || e.key===' ' || e.key==='ArrowDown'){
        e.preventDefault(); open()
        var first = panel && panel.querySelector('.nav-dd-item')
        if(first) first.focus()
      }
    })
    wrap.addEventListener('keydown',function(e){
      if(e.key==='Escape'){ close(); trigger.focus(); return }
      if(e.key==='ArrowDown' || e.key==='ArrowUp'){
        if(!panel) return
        var links = Array.prototype.slice.call(panel.querySelectorAll('.nav-dd-item'))
        if(!links.length) return
        e.preventDefault()
        var idx = links.indexOf(document.activeElement)
        var next = e.key==='ArrowDown' ? (links[idx+1]||links[0]) : (links[idx-1]||links[links.length-1])
        next.focus()
      }
    })
  }

  function wireMobileDropdown(wrapId){
    var wrap = document.getElementById(wrapId)
    if(!wrap) return
    var trigger = wrap.querySelector('.mm-dropdown-trigger')
    var entry = { wrap:wrap, trigger:trigger }
    mobileWraps.push(entry)
    trigger.addEventListener('click',function(){
      var willOpen = !wrap.classList.contains('open')
      closeAllMobile(willOpen ? wrap : null)
      wrap.classList.toggle('open', willOpen)
      trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false')
    })
  }

  document.addEventListener('click',function(e){
    desktopWraps.forEach(function(w){ if(!w.wrap.contains(e.target)) w.wrap.classList.remove('open') })
  })
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape') closeAllDesktop(null)
  })

  /* ---------------------------------------------------------------
     Item click routing
     --------------------------------------------------------------- */
  function goHomeSection(id){
    if(typeof window.showPage==='function') window.showPage('home')
    if(typeof window.scrollTo2==='function') window.scrollTo2(id)
    else { var el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth'}) }
  }

  function findItem(kind, key){
    var list = kind==='service' ? SERVICES_MENU : kind==='industry' ? INDUSTRIES_MENU : kind==='more' ? MORE_MENU : ABOUT_MENU
    for(var i=0;i<list.length;i++) if(list[i].key===key) return list[i]
    return null
  }

  document.addEventListener('click',function(e){
    var el = e.target.closest ? e.target.closest('.nav-dd-item') : null
    if(!el) return
    e.preventDefault()
    var kind = el.getAttribute('data-kind'), key = el.getAttribute('data-key')
    closeAllDesktop(null); closeAllMobile(null)
    var mm = document.getElementById('mmenu'); if(mm) mm.classList.remove('open')

    if(kind==='service'){
      if(typeof window.openServiceModal==='function') window.openServiceModal(key)
      return
    }
    var item = findItem(kind,key)
    if(!item) return
    if(kind==='industry'){ window.openInfoModal(item,'industry'); return }
    if(kind==='more'){ goHomeSection(item.target); return }
    // about
    if(item.action==='team'){ if(typeof window.openTeamMember==='function') window.openTeamMember(item.target); return }
    if(item.action==='scroll'){ goHomeSection(item.target); return }
    window.openInfoModal(item,'about')
  })

  /* ---------------------------------------------------------------
     Lightweight "info page" modal — used for Industries and the
     About Us items that don't yet have a dedicated section.
     --------------------------------------------------------------- */
  window.openInfoModal = function(item, kind){
    var modal = document.getElementById('infoModal')
    if(!modal) return
    document.getElementById('infoModalIcon').innerHTML = ICONS[item.icon] || ''
    document.getElementById('infoModalTitle').innerHTML = item.label
    document.getElementById('infoModalTag').innerHTML = item.desc
    var body = (item.body||[]).map(function(p){return '<p>'+p+'</p>'}).join('')
    var bullets = (item.bullets && item.bullets.length) ? '<ul class="info-modal-bullets">'+item.bullets.map(function(b){return '<li>'+b+'</li>'}).join('')+'</ul>' : ''
    document.getElementById('infoModalBody').innerHTML = body + bullets
    modal.classList.add('open')
    document.body.style.overflow = 'hidden'
    var content = modal.querySelector('.info-modal-content')
    content.classList.remove('info-animate-in'); void content.offsetWidth; content.classList.add('info-animate-in')
  }
  window.closeInfoModal = function(){
    var modal = document.getElementById('infoModal')
    if(!modal) return
    modal.classList.remove('open')
    document.body.style.overflow = ''
  }
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape') window.closeInfoModal && window.closeInfoModal()
  })

  /* ---------------------------------------------------------------
     Active-service highlight (called from app.js on modal open/close)
     --------------------------------------------------------------- */
  window.setActiveServiceNav = function(id){
    var links = document.querySelectorAll('.nav-dd-item[data-kind="service"]')
    for(var i=0;i<links.length;i++){
      var a = links[i]
      if(id && a.getAttribute('data-key')===id) a.classList.add('is-active')
      else a.classList.remove('is-active')
    }
  }

  function openFromHash(){
    var m = location.hash.match(/^#service-(.+)$/)
    if(m && typeof window.openServiceModal==='function') window.openServiceModal(decodeURIComponent(m[1]))
  }

  document.addEventListener('DOMContentLoaded',function(){
    renderAll()
    ;['navServicesItem','navIndustriesItem','navAboutItem','navMoreItem'].forEach(wireDesktopDropdown)
    ;['mmServicesItem','mmIndustriesItem','mmAboutItem','mmMoreItem'].forEach(wireMobileDropdown)
    openFromHash()
  })
})();
