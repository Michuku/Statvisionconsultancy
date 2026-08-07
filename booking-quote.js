/* ===================================================================
   StatVision — Quotation Calculator & Booking System (Phase 4)
   Vanilla JS. Writes bookings to Firestore collection "bookings"
   (public create; admin-only read/update/delete — see firestore.rules).
   Consultants reuse the existing `teamMembers` object from app.js.

   NOTE ON PRICING: the base rates and multipliers below are placeholder
   figures so the calculator is fully functional out of the box. Ask
   StatVision for real pricing and update BASE_RATES / MULTIPLIERS
   before relying on this for real client quotes.
   =================================================================== */
(function(){

  /* =================================================================
     QUOTATION CALCULATOR
     ================================================================= */
  var SERVICES = [
    {key:'statistical', label:'Statistical Analysis', base:15000},
    {key:'monitoring',  label:'Monitoring & Evaluation', base:45000},
    {key:'research',    label:'Research Consultancy', base:35000},
    {key:'cleaning',    label:'Data Cleaning & Management', base:12000},
    {key:'powerbi',     label:'Power BI Dashboards & Data Visualization', base:30000},
    {key:'training',    label:'Learning & Capacity Building', base:20000}
  ]
  var ORG_TYPES = [
    {key:'individual',label:'Individual / Student',mult:0.8},
    {key:'private',   label:'Private Sector / SME',mult:1.0},
    {key:'academic',  label:'Academic / Research',mult:0.9},
    {key:'ngo',       label:'NGO',mult:1.1},
    {key:'gov',       label:'Government',mult:1.3},
    {key:'intl',      label:'International Development Partner',mult:1.3}
  ]
  var TIMELINES = [
    {key:'standard', label:'Standard (2–3 weeks)',mult:1.0},
    {key:'expedited',label:'Expedited (1 week)',mult:1.3},
    {key:'rush',     label:'Rush (48–72 hrs)',mult:1.6}
  ]
  var DATASET_SIZES = [
    {key:'small',   label:'Small (< 500 records)',mult:1.0},
    {key:'medium',  label:'Medium (500–5,000)',mult:1.3},
    {key:'large',   label:'Large (5,000–50,000)',mult:1.7},
    {key:'enterprise',label:'Enterprise (50,000+)',mult:2.3}
  ]
  var DELIVERABLES = [
    {key:'report',      label:'Statistical Report',cost:8000},
    {key:'dashboard',   label:'Power BI Dashboard',cost:15000},
    {key:'cleaning',    label:'Data Cleaning',cost:10000},
    {key:'presentation',label:'Presentation Deck',cost:6000},
    {key:'training',    label:'Training Session',cost:12000}
  ]

  var qState = { service:null, org:null, timeline:null, size:null, deliverables:[] }

  function chipGroup(containerId, items, stateKey, multi){
    var wrap = document.getElementById(containerId)
    if(!wrap) return
    wrap.innerHTML = items.map(function(it){
      return '<button type="button" class="quote-chip" data-key="'+it.key+'">'+it.label+'</button>'
    }).join('')
    wrap.addEventListener('click',function(e){
      var btn = e.target.closest('.quote-chip'); if(!btn) return
      var key = btn.getAttribute('data-key')
      if(multi){
        var idx = qState[stateKey].indexOf(key)
        if(idx>-1){ qState[stateKey].splice(idx,1); btn.classList.remove('active') }
        else{ qState[stateKey].push(key); btn.classList.add('active') }
      } else {
        wrap.querySelectorAll('.quote-chip').forEach(function(b){b.classList.remove('active')})
        btn.classList.add('active')
        qState[stateKey]=key
      }
      renderQuote()
    })
  }

  function findBy(list,key){ return list.find(function(i){return i.key===key}) }

  function renderQuote(){
    var resultEl = document.getElementById('quoteResult')
    if(!resultEl) return
    var svc = findBy(SERVICES,qState.service)
    if(!svc){
      resultEl.innerHTML = '<p class="quote-note">Select a service to see your estimate.</p>'
      return
    }
    var org = findBy(ORG_TYPES,qState.org) || {mult:1,label:'—'}
    var time = findBy(TIMELINES,qState.timeline) || {mult:1,label:'—'}
    var size = findBy(DATASET_SIZES,qState.size) || {mult:1,label:'—'}
    var base = svc.base * org.mult * time.mult * size.mult
    var deliverablesCost = qState.deliverables.reduce(function(sum,k){
      var d = findBy(DELIVERABLES,k); return sum + (d?d.cost:0)
    },0)
    var total = base + deliverablesCost
    var low = Math.round((total*0.9)/500)*500
    var high = Math.round((total*1.15)/500)*500

    var rows = [
      '<li><span>'+svc.label+'</span><span>KES '+Math.round(base).toLocaleString()+'</span></li>'
    ]
    qState.deliverables.forEach(function(k){
      var d=findBy(DELIVERABLES,k)
      if(d) rows.push('<li><span>+ '+d.label+'</span><span>KES '+d.cost.toLocaleString()+'</span></li>')
    })

    resultEl.innerHTML =
      '<div class="quote-range">KES '+low.toLocaleString()+' <small>–</small> '+high.toLocaleString()+'</div>'+
      '<p class="quote-note">Indicative estimate based on '+org.label+' rates, a '+time.label.toLowerCase()+' timeline and a '+size.label.toLowerCase()+' dataset. Your final quotation is confirmed after a short consultation.</p>'+
      '<ul class="quote-breakdown">'+rows.join('')+'</ul>'+
      '<a href="#booking" class="btn btn-primary" style="width:100%;justify-content:center" onclick="window.prefillBookingService && window.prefillBookingService(\''+svc.key+'\')">Request Formal Quotation &rarr;</a>'
  }

  function initQuote(){
    if(!document.getElementById('quoteServiceChips')) return
    chipGroup('quoteServiceChips', SERVICES, 'service', false)
    chipGroup('quoteOrgChips', ORG_TYPES, 'org', false)
    chipGroup('quoteTimelineChips', TIMELINES, 'timeline', false)
    chipGroup('quoteSizeChips', DATASET_SIZES, 'size', false)
    chipGroup('quoteDeliverableChips', DELIVERABLES, 'deliverables', true)
    renderQuote()
  }

  /* =================================================================
     BOOKING SYSTEM
     ================================================================= */
  var BOOK_SERVICES = SERVICES // same six core services
  var CONSULTANTS = [
    {key:'any',   name:'No preference', role:'Any available consultant', initials:'SV'},
    {key:'henry', name:'Henry Gitau Michuku', role:'Chief Executive Officer', initials:'HM'},
    {key:'simon', name:'Simon Macharia', role:'Data Analyst', initials:'SM'},
    {key:'joseph',name:'Joseph Machuki', role:'Economist & Statistician', initials:'JM'}
  ]
  var TIME_SLOTS = ['9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM']

  var bState = { service:'', consultant:'any', date:'', time:'' }

  function renderConsultants(){
    var wrap=document.getElementById('bookConsultantGrid'); if(!wrap) return
    wrap.innerHTML = CONSULTANTS.map(function(c){
      return '<div class="book-consultant" data-key="'+c.key+'">'+
        '<span class="book-consultant-avatar">'+c.initials+'</span>'+
        '<strong>'+c.name+'</strong><span>'+c.role+'</span></div>'
    }).join('')
    wrap.querySelectorAll('.book-consultant').forEach(function(card,i){
      if(i===0) card.classList.add('active')
      card.addEventListener('click',function(){
        wrap.querySelectorAll('.book-consultant').forEach(function(c){c.classList.remove('active')})
        card.classList.add('active')
        bState.consultant = card.getAttribute('data-key')
        updateBookSummary()
      })
    })
  }
  function renderSlots(){
    var wrap=document.getElementById('bookSlotGrid'); if(!wrap) return
    wrap.innerHTML = TIME_SLOTS.map(function(t){return '<div class="book-slot" data-time="'+t+'">'+t+'</div>'}).join('')
    wrap.addEventListener('click',function(e){
      var el=e.target.closest('.book-slot'); if(!el||el.classList.contains('disabled')) return
      wrap.querySelectorAll('.book-slot').forEach(function(s){s.classList.remove('active')})
      el.classList.add('active')
      bState.time = el.getAttribute('data-time')
      updateBookSummary()
    })
  }
  function updateBookSummary(){
    var el=document.getElementById('bookSummary'); if(!el) return
    var svc = findBy(BOOK_SERVICES,bState.service)
    var cons = CONSULTANTS.find(function(c){return c.key===bState.consultant})
    if(!svc || !bState.date || !bState.time){ el.classList.remove('show'); return }
    el.classList.add('show')
    el.innerHTML = 'You\u2019re booking a <strong>'+svc.label+'</strong> consultation with <strong>'+(cons?cons.name:'any consultant')+
      '</strong> on <strong>'+bState.date+'</strong> at <strong>'+bState.time+'</strong>.'
  }

  window.prefillBookingService = function(serviceKey){
    var sel = document.getElementById('bookServiceSelect')
    if(sel){ sel.value = serviceKey; bState.service = serviceKey; updateBookSummary() }
  }

  window.submitBooking = async function(){
    var v = function(id){ var el=document.getElementById(id); return el?el.value.trim():'' }
    bState.service = v('bookServiceSelect')
    bState.date = v('bookDateInput')
    var data = {
      name:v('bookName'), email:v('bookEmail'), phone:v('bookPhone'), org:v('bookOrg')||'—',
      service:bState.service, consultant:bState.consultant, date:bState.date, time:bState.time,
      notes:v('bookNotes')||'', status:'Pending', createdAt:Date.now()
    }
    var statusEl=document.getElementById('bookStatus')
    if(!data.name||!data.email||!data.service||!data.date||!data.time){
      statusEl.style.color='#D13438'
      statusEl.textContent='⚠ Please fill in your name, email, service, date and time.'
      return
    }
    statusEl.style.color='var(--sl)'; statusEl.textContent='Submitting your booking...'
    try{
      await fbDB.collection('bookings').add(data)
      document.getElementById('bookFormWrap').style.display='none'
      var confirm=document.getElementById('bookConfirm')
      var svc=findBy(BOOK_SERVICES,data.service)
      document.getElementById('bookConfirmDetails').textContent =
        (svc?svc.label:data.service)+' on '+data.date+' at '+data.time+'. A confirmation email will be sent to '+data.email+' within 4 business hours.'
      confirm.classList.add('show')
    }catch(e){
      statusEl.style.color='#D13438'
      statusEl.textContent='⚠ Could not submit online. Please email hello@statvisionconsultancy.co.ke or call +254 748 216 918 directly.'
    }
  }
  window.resetBookingForm = function(){
    ;['bookName','bookEmail','bookPhone','bookOrg','bookNotes'].forEach(function(id){var el=document.getElementById(id);if(el)el.value=''})
    bState = { service:'', consultant:'any', date:'', time:'' }
    var svcSel=document.getElementById('bookServiceSelect'); if(svcSel) svcSel.value=''
    var dateInp=document.getElementById('bookDateInput'); if(dateInp) dateInp.value=''
    document.querySelectorAll('.book-slot').forEach(function(s){s.classList.remove('active')})
    document.querySelectorAll('.book-consultant').forEach(function(c,i){c.classList.toggle('active',i===0)})
    updateBookSummary()
    document.getElementById('bookConfirm').classList.remove('show')
    document.getElementById('bookFormWrap').style.display='block'
    document.getElementById('bookStatus').textContent=''
  }

  function initBooking(){
    var svcSel=document.getElementById('bookServiceSelect')
    if(!svcSel) return
    svcSel.innerHTML = '<option value="">Select service...</option>' + BOOK_SERVICES.map(function(s){return '<option value="'+s.key+'">'+s.label+'</option>'}).join('')
    svcSel.addEventListener('change',function(){ bState.service=svcSel.value; updateBookSummary() })
    var dateInp=document.getElementById('bookDateInput')
    var today=new Date(); today.setDate(today.getDate()+1)
    dateInp.min = today.toISOString().slice(0,10)
    dateInp.addEventListener('change',function(){ bState.date=dateInp.value; updateBookSummary() })
    renderConsultants()
    renderSlots()
  }

  /* =================================================================
     ADMIN — bookings list (Firestore-backed) for staff to manage
     ================================================================= */
  var BOOK_STATUSES = ['Pending','Confirmed','Completed','Cancelled']
  window.loadBookingsAdmin = async function(){
    var wrap=document.getElementById('bookingsAdminList'); if(!wrap) return
    wrap.innerHTML='<div style="color:var(--sl);font-size:.8rem">Loading...</div>'
    try{
      var snap=await fbDB.collection('bookings').orderBy('createdAt','desc').get()
      if(snap.empty){ wrap.innerHTML='<div style="color:var(--sl);font-size:.8rem">No bookings yet.</div>'; return }
      wrap.innerHTML = snap.docs.map(function(d){
        var b=d.data()
        var svc=findBy(BOOK_SERVICES,b.service)
        var cons=CONSULTANTS.find(function(c){return c.key===b.consultant})
        return '<div style="padding:.7rem .85rem;background:#F4F6FA;border-radius:8px;margin-bottom:.5rem">'+
          '<div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap">'+
          '<strong style="font-size:.85rem">'+(b.name||'').replace(/</g,'&lt;')+'</strong>'+
          '<select onchange="updateBookingStatus(\''+d.id+'\',this.value)" style="font-size:.76rem;padding:.2rem .4rem;border-radius:6px;border:1px solid var(--br)">'+
            BOOK_STATUSES.map(function(s){return '<option value="'+s+'"'+(b.status===s?' selected':'')+'>'+s+'</option>'}).join('')+
          '</select></div>'+
          '<div style="font-size:.78rem;color:var(--sl);margin-top:.3rem">'+(svc?svc.label:b.service)+' · '+(cons?cons.name:b.consultant)+' · '+b.date+' at '+b.time+'</div>'+
          '<div style="font-size:.75rem;color:var(--sl);margin-top:.2rem">'+(b.email||'')+(b.phone?' · '+b.phone:'')+'</div>'+
          '</div>'
      }).join('')
    }catch(e){ wrap.innerHTML='<div style="color:#D13438;font-size:.8rem">Could not load: '+e.message+'</div>' }
  }
  window.updateBookingStatus = async function(id,status){
    try{ await fbDB.collection('bookings').doc(id).update({status:status}) }
    catch(e){ alert('Could not update: '+e.message) }
  }

  document.addEventListener('DOMContentLoaded',function(){
    initQuote()
    initBooking()
  })
})();
