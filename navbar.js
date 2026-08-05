/* ===================================================================
   StatVision — Services mega-dropdown navigation logic
   Vanilla JS only (no jQuery). Renders the categorized Services menu,
   handles hover (desktop) / tap (mobile) opening, closes on outside
   click, supports keyboard navigation (Arrow keys, Enter, Esc), and
   keeps the active service link highlighted in StatVision blue.

   Every leaf item routes to an existing StatVision service page via
   window.openServiceModal(id) (defined in app.js) — several closely
   related items (e.g. "Data Analysis", "Predictive Analytics",
   "Forecasting") point to the same in-depth service page, since that
   page already documents each of those as a listed sub-service.
   =================================================================== */
(function(){

  // ---- Menu data: category -> [{ label shown in the menu, id of the
  // StatVision service page it opens }] ----------------------------------
  var SERVICE_MENU = [
    { group:'Statistical Services', items:[
      { label:'Statistical Analysis',            id:'statistical' },
      { label:'Data Analysis',                   id:'statistical' },
      { label:'Data Cleaning & Preparation',     id:'cleaning' },
      { label:'Data Visualization',              id:'powerbi' },
      { label:'Statistical Modelling',           id:'statistical' },
      { label:'Predictive Analytics',            id:'statistical' },
      { label:'Forecasting',                     id:'statistical' },
      { label:'Time Series Analysis',            id:'statistical' }
    ]},
    { group:'Research Services', items:[
      { label:'Research Consultancy',            id:'research' },
      { label:'Proposal Development',            id:'research' },
      { label:'Research Design',                 id:'research' },
      { label:'Questionnaire Design',            id:'survey' },
      { label:'Data Collection',                 id:'survey' },
      { label:'Report Writing',                  id:'research' },
      { label:'Academic Research Support',       id:'research' }
    ]},
    { group:'Monitoring & Evaluation', items:[
      { label:'M&E Framework Development',       id:'monitoring' },
      { label:'Baseline Surveys',                id:'monitoring' },
      { label:'Mid-Term Evaluations',             id:'monitoring' },
      { label:'End-Term Evaluations',             id:'monitoring' },
      { label:'Impact Assessment',                id:'monitoring' },
      { label:'Performance Monitoring',           id:'monitoring' },
      { label:'Indicator Development',            id:'monitoring' }
    ]},
    { group:'Business Intelligence', items:[
      { label:'Power BI Dashboards',              id:'powerbi' },
      { label:'Excel Dashboards',                 id:'powerbi' },
      { label:'SQL Analytics',                    id:'bi' },
      { label:'Business Reporting',                id:'bi' },
      { label:'KPI Tracking',                      id:'bi' },
      { label:'Executive Dashboards',              id:'powerbi' }
    ]},
    { group:'GIS & Mapping', items:[
      { label:'GIS Mapping',                       id:'gis' },
      { label:'Spatial Analysis',                  id:'gis' },
      { label:'GPS Data Collection',                id:'gis' },
      { label:'Interactive Maps',                   id:'gis' }
    ]},
    { group:'Capacity Building', items:[
      { label:'SPSS Training',                      id:'training' },
      { label:'STATA Training',                     id:'training' },
      { label:'R Programming',                      id:'training' },
      { label:'Python for Data Analysis',            id:'training' },
      { label:'Excel for Data Analysis',             id:'training' },
      { label:'Power BI Training',                   id:'training' },
      { label:'Research Methods Training',           id:'training' }
    ]}
  ];
  window.STATVISION_SERVICE_MENU = SERVICE_MENU; // exposed for reuse/testing

  function escapeHtmlLocal(s){
    return String(s||'').replace(/[&<>"']/g,function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]
    })
  }

  function buildGroupsHTML(groupClass){
    return SERVICE_MENU.map(function(g){
      var items = g.items.map(function(it){
        return '<li><a href="#service-'+it.id+'" data-service-id="'+it.id+'" data-nav-link>'+escapeHtmlLocal(it.label)+'</a></li>'
      }).join('')
      return '<div class="'+groupClass+'-group"><h5>'+escapeHtmlLocal(g.group)+'</h5><ul>'+items+'</ul></div>'
    }).join('')
  }

  function renderMenus(){
    var desktop = document.getElementById('servicesMegaMenu')
    var mobile  = document.getElementById('servicesMobilePanel')
    if(desktop) desktop.innerHTML = buildGroupsHTML('services-mega')
    if(mobile)  mobile.innerHTML  = buildGroupsHTML('mm-services')
  }

  // ---- Desktop: hover to open, click to toggle, outside click / Esc to close, arrow keys to navigate ----
  function wireDesktopDropdown(){
    var wrap = document.getElementById('navServicesItem')
    if(!wrap) return
    var trigger = wrap.querySelector('.nav-dropdown-trigger')
    var closeTimer = null

    function open(){
      wrap.classList.add('open')
      trigger.setAttribute('aria-expanded','true')
    }
    function close(){
      wrap.classList.remove('open')
      trigger.setAttribute('aria-expanded','false')
    }

    wrap.addEventListener('mouseenter',function(){ clearTimeout(closeTimer); open() })
    wrap.addEventListener('mouseleave',function(){ closeTimer=setTimeout(close,180) })

    trigger.addEventListener('click',function(e){
      e.preventDefault()
      if(wrap.classList.contains('open')) close(); else open()
    })
    trigger.addEventListener('keydown',function(e){
      if(e.key==='Enter' || e.key===' ' || e.key==='ArrowDown'){
        e.preventDefault()
        open()
        var first = wrap.querySelector('.services-mega a')
        if(first) first.focus()
      }
    })

    document.addEventListener('click',function(e){
      if(!wrap.contains(e.target)) close()
    })

    wrap.addEventListener('keydown',function(e){
      if(e.key==='Escape'){
        close()
        trigger.focus()
        return
      }
      if(e.key==='ArrowDown' || e.key==='ArrowUp'){
        var links = Array.prototype.slice.call(wrap.querySelectorAll('.services-mega a'))
        if(!links.length) return
        e.preventDefault()
        var idx = links.indexOf(document.activeElement)
        var next
        if(e.key==='ArrowDown') next = links[idx+1] || links[0]
        else next = links[idx-1] || links[links.length-1]
        next.focus()
      }
    })
  }

  // ---- Mobile: tap to expand/collapse the accordion panel ----
  function wireMobileDropdown(){
    var wrap = document.getElementById('mmServicesItem')
    if(!wrap) return
    var trigger = wrap.querySelector('.mm-dropdown-trigger')
    trigger.addEventListener('click',function(){
      var isOpen = wrap.classList.toggle('open')
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
    })
  }

  // ---- Any click on a menu leaf link opens that service page ----
  function wireServiceLinkClicks(){
    document.addEventListener('click',function(e){
      var link = e.target.closest ? e.target.closest('[data-nav-link]') : null
      if(!link) return
      e.preventDefault()
      var id = link.getAttribute('data-service-id')
      var wrap = document.getElementById('navServicesItem')
      if(wrap) wrap.classList.remove('open')
      var mm = document.getElementById('mmenu')
      if(mm) mm.classList.remove('open')
      var mmSvc = document.getElementById('mmServicesItem')
      if(mmSvc) mmSvc.classList.remove('open')
      if(typeof window.openServiceModal === 'function'){
        window.openServiceModal(id)
      }
    })
  }

  // ---- Highlight the active service link (called from app.js when a service page opens/closes) ----
  window.setActiveServiceNav = function(id){
    var links = document.querySelectorAll('[data-nav-link]')
    for(var i=0;i<links.length;i++){
      var a = links[i]
      if(id && a.getAttribute('data-service-id')===id) a.classList.add('is-active')
      else a.classList.remove('is-active')
    }
  }

  // ---- Deep link support: opening the site on #service-<id> jumps straight to that page ----
  function openFromHash(){
    var m = location.hash.match(/^#service-(.+)$/)
    if(m && typeof window.openServiceModal === 'function'){
      window.openServiceModal(decodeURIComponent(m[1]))
    }
  }

  document.addEventListener('DOMContentLoaded',function(){
    renderMenus()
    wireDesktopDropdown()
    wireMobileDropdown()
    wireServiceLinkClicks()
    openFromHash()
  })
})();
