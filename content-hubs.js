/* ===================================================================
   StatVision — Content Hubs (Phase 3)
   Dashboards showcase · Portfolio Gallery · Resources Centre · Blog
   Vanilla JS. Reads/writes Firestore collections:
     dashboardShowcase, galleryItems, resourcesLib, blogPosts
   Storage paths:
     dashboard-showcase/{fileName}, gallery-items/{fileName},
     resources/{fileName}, blog-media/{fileName}
   Uses the same fbDB/fbStorage globals initialized in firebase-config.js
   and reuses window.openLightbox/closeLightbox (app.js) for zoom.
   =================================================================== */
(function(){

  function svg(inner,w){ w=w||18; return '<svg viewBox="0 0 24 24" width="'+w+'" height="'+w+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+inner+'</svg>' }
  var ICO = {
    search:   svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    download: svg('<path d="M12 3v13"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>'),
    camera:   svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>'),
    file:     svg('<path d="M6 2h9l5 5v15H6V2z"/><path d="M15 2v5h5"/>')
  }

  /* =================================================================
     1) DASHBOARDS SHOWCASE
     ================================================================= */
  var DASH_TOOLS = [
    {key:'powerbi',label:'Power BI',color:'#C9930A'},
    {key:'excel',  label:'Excel',   color:'#1C7A42'},
    {key:'spss',   label:'SPSS',    color:'#0D5FA6'},
    {key:'r',      label:'R',       color:'#2758A6'},
    {key:'python', label:'Python',  color:'#2C5E86'},
    {key:'sql',    label:'SQL',     color:'#0C6B80'},
    {key:'tableau',label:'Tableau', color:'#C15A1D'}
  ]
  var dashboardItems=[], dashFilter='all'

  function toolInfo(key){ return DASH_TOOLS.find(function(t){return t.key===key}) || {key:key,label:key,color:'#1E4DB7'} }

  function dashSampleCard(t){
    return '<div class="dash-card dash-card--sample" style="--tool-color:'+t.color+'">'+
      '<span class="dash-tool-badge">'+t.label+'</span>'+
      '<div class="dash-card-body">'+ICO.file.replace('width="18" height="18"','width="34" height="34"').replace('class=""','')+
      '<small>Sample dashboard coming soon</small></div></div>'
  }

  function dashRealCard(d){
    var t = toolInfo(d.tool)
    var title = (d.title||'Dashboard preview').replace(/"/g,'&quot;')
    return '<div class="dash-card">'+
      '<span class="dash-tool-badge" style="background:'+t.color+'22;color:'+t.color+'">'+t.label+'</span>'+
      '<img src="'+d.url+'" alt="'+title+'" loading="lazy" onclick="window.openLightbox(\''+d.url+'\',\''+d.url+'\')"/>'+
      '<div class="dash-card-foot"><span>'+title+'</span>'+
      '<a href="'+d.url+'" download class="dash-download" title="Download sample">'+ICO.download+'</a></div></div>'
  }

  function renderDashboards(){
    var grid=document.getElementById('dashShowcaseGrid'); if(!grid) return
    var items = dashboardItems.filter(function(d){return dashFilter==='all'||d.tool===dashFilter})
    if(!items.length){
      var tools = dashFilter==='all' ? DASH_TOOLS : [toolInfo(dashFilter)]
      grid.innerHTML = tools.map(dashSampleCard).join('')
      return
    }
    grid.innerHTML = items.map(dashRealCard).join('')
  }

  async function loadDashboards(){
    try{
      var snap = await fbDB.collection('dashboardShowcase').orderBy('uploadedAt','desc').get()
      dashboardItems = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()) })
    }catch(e){ dashboardItems=[] }
    renderDashboards()
  }

  function wireDashFilters(){
    var wrap=document.getElementById('dashFilterTabs'); if(!wrap) return
    var tabs = '<button type="button" class="hub-tab active" data-tool="all">All</button>' +
      DASH_TOOLS.map(function(t){return '<button type="button" class="hub-tab" data-tool="'+t.key+'">'+t.label+'</button>'}).join('')
    wrap.innerHTML = tabs
    wrap.addEventListener('click',function(e){
      var btn=e.target.closest('[data-tool]'); if(!btn) return
      wrap.querySelectorAll('.hub-tab').forEach(function(b){b.classList.remove('active')})
      btn.classList.add('active')
      dashFilter = btn.getAttribute('data-tool')
      renderDashboards()
    })
  }

  /* =================================================================
     2) PORTFOLIO / GALLERY
     ================================================================= */
  var GALLERY_CATS = [
    {key:'office',label:'Office'},{key:'training',label:'Training'},
    {key:'fieldwork',label:'Field Work'},{key:'dashboards',label:'Dashboards'},
    {key:'presentations',label:'Presentations'},{key:'research',label:'Research'},
    {key:'events',label:'Events'}
  ]
  var galleryItems=[], galleryFilter='all'

  function gallerySampleCard(c){
    return '<div class="gallery-item gallery-item--sample">'+ICO.camera+'<small>'+c.label+' photos coming soon</small></div>'
  }
  function galleryRealCard(g){
    var cat = GALLERY_CATS.find(function(c){return c.key===g.category})
    var name=(g.name||'Gallery photo').replace(/"/g,'&quot;')
    return '<div class="gallery-item" onclick="window.openLightbox(\''+g.url+'\')">'+
      '<img src="'+g.url+'" alt="'+name+'" loading="lazy"/>'+
      (cat?'<span class="gallery-item-cat">'+cat.label+'</span>':'')+'</div>'
  }
  function renderGallery(){
    var grid=document.getElementById('galleryGrid'); if(!grid) return
    var items = galleryItems.filter(function(g){return galleryFilter==='all'||g.category===galleryFilter})
    if(!items.length){
      var cats = galleryFilter==='all'? GALLERY_CATS : GALLERY_CATS.filter(function(c){return c.key===galleryFilter})
      grid.innerHTML = cats.map(gallerySampleCard).join('')
      return
    }
    grid.innerHTML = items.map(galleryRealCard).join('')
  }
  async function loadGallery(){
    try{
      var snap = await fbDB.collection('galleryItems').orderBy('uploadedAt','desc').get()
      galleryItems = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()) })
    }catch(e){ galleryItems=[] }
    renderGallery()
  }
  function wireGalleryFilters(){
    var wrap=document.getElementById('galleryFilterTabs'); if(!wrap) return
    wrap.innerHTML = '<button type="button" class="hub-tab active" data-cat="all">All</button>' +
      GALLERY_CATS.map(function(c){return '<button type="button" class="hub-tab" data-cat="'+c.key+'">'+c.label+'</button>'}).join('')
    wrap.addEventListener('click',function(e){
      var btn=e.target.closest('[data-cat]'); if(!btn) return
      wrap.querySelectorAll('.hub-tab').forEach(function(b){b.classList.remove('active')})
      btn.classList.add('active')
      galleryFilter = btn.getAttribute('data-cat')
      renderGallery()
    })
  }

  /* =================================================================
     3) RESOURCES CENTRE
     ================================================================= */
  var RESOURCE_CATS = [
    {key:'articles',label:'Research Articles'},{key:'templates',label:'Templates'},
    {key:'reports',label:'Reports'},{key:'datasets',label:'Datasets'},
    {key:'training',label:'Training Materials'}
  ]
  var resourceItems=[], resourceFilter='all', resourceQuery=''

  function resourceSampleCard(c){
    return '<div class="resource-card"><span class="resource-ico">'+ICO.file+'</span>'+
      '<div class="resource-body"><span class="resource-cat">'+c.label+'</span>'+
      '<h4>Coming soon</h4><p>New '+c.label.toLowerCase()+' are added regularly — check back shortly.</p>'+
      '<span class="resource-dl disabled">'+ICO.download+' Not yet available</span></div></div>'
  }
  function resourceRealCard(r){
    var cat = RESOURCE_CATS.find(function(c){return c.key===r.category})
    var title=(r.title||'Resource').replace(/</g,'&lt;')
    var desc=(r.description||'').replace(/</g,'&lt;')
    return '<div class="resource-card"><span class="resource-ico">'+ICO.file+'</span>'+
      '<div class="resource-body">'+(cat?'<span class="resource-cat">'+cat.label+'</span>':'')+
      '<h4>'+title+'</h4><p>'+desc+'</p>'+
      '<a class="resource-dl" href="'+r.fileUrl+'" target="_blank" rel="noopener">'+ICO.download+' Download</a></div></div>'
  }
  function renderResources(){
    var grid=document.getElementById('resourceGrid'); if(!grid) return
    var items = resourceItems.filter(function(r){
      var matchCat = resourceFilter==='all'||r.category===resourceFilter
      var matchQ = !resourceQuery || (r.title||'').toLowerCase().indexOf(resourceQuery)>-1 || (r.description||'').toLowerCase().indexOf(resourceQuery)>-1
      return matchCat && matchQ
    })
    if(!items.length){
      if(resourceQuery){ grid.innerHTML='<div class="hub-empty">No resources match “'+resourceQuery.replace(/</g,'')+'”.</div>'; return }
      var cats = resourceFilter==='all'? RESOURCE_CATS : RESOURCE_CATS.filter(function(c){return c.key===resourceFilter})
      grid.innerHTML = cats.map(resourceSampleCard).join('')
      return
    }
    grid.innerHTML = items.map(resourceRealCard).join('')
  }
  async function loadResources(){
    try{
      var snap = await fbDB.collection('resourcesLib').orderBy('uploadedAt','desc').get()
      resourceItems = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()) })
    }catch(e){ resourceItems=[] }
    renderResources()
  }
  function wireResourceControls(){
    var wrap=document.getElementById('resourceFilterTabs')
    if(wrap){
      wrap.innerHTML = '<button type="button" class="hub-tab active" data-cat="all">All</button>' +
        RESOURCE_CATS.map(function(c){return '<button type="button" class="hub-tab" data-cat="'+c.key+'">'+c.label+'</button>'}).join('')
      wrap.addEventListener('click',function(e){
        var btn=e.target.closest('[data-cat]'); if(!btn) return
        wrap.querySelectorAll('.hub-tab').forEach(function(b){b.classList.remove('active')})
        btn.classList.add('active')
        resourceFilter = btn.getAttribute('data-cat')
        renderResources()
      })
    }
    var search=document.getElementById('resourceSearch')
    if(search){
      search.addEventListener('input',function(){
        resourceQuery = search.value.trim().toLowerCase()
        renderResources()
      })
    }
  }

  /* =================================================================
     4) BLOG / INSIGHTS
     ================================================================= */
  var BLOG_CATS = [
    {key:'statistics',label:'Statistics'},{key:'research',label:'Research'},
    {key:'monitoring',label:'Monitoring'},{key:'datascience',label:'Data Science'},
    {key:'powerbi',label:'Power BI'},{key:'spss',label:'SPSS'},
    {key:'r',label:'R'},{key:'python',label:'Python'},{key:'sql',label:'SQL'}
  ]
  var FALLBACK_POSTS = [
    {id:'fb1',category:'research',title:'5 Signs Your Organization Needs an M&E Framework',excerpt:'How to know when it\u2019s time to move from ad-hoc reporting to a structured monitoring & evaluation system.',body:['Many organizations only invest in a formal M&E framework after a funder asks a question they can\u2019t answer with data. By then, months of programme evidence may already be unrecoverable.','The signs are usually visible earlier: inconsistent indicator definitions across teams, reports that describe activities rather than outcomes, and no clear baseline to measure change against.','A well-built M&E framework fixes this at the source — a logical framework, a monitoring plan, and clear ownership of data collection from day one.'],tags:['M&E','frameworks','indicators']},
    {id:'fb2',category:'powerbi',title:'Power BI vs Excel: Choosing the Right Tool',excerpt:'A practical comparison for organizations deciding how to modernize their reporting stack.',body:['Excel remains unmatched for quick, ad-hoc analysis and small datasets that one person owns end-to-end.','Power BI earns its place once reporting needs to be shared, refreshed automatically, and explored interactively by people who aren\u2019t analysts themselves.','The right choice usually isn\u2019t either/or — most of our clients keep Excel for fast internal working files and use Power BI for the dashboards that go in front of leadership and donors.'],tags:['Power BI','Excel','business intelligence']},
    {id:'fb3',category:'spss',title:'Common Data Cleaning Mistakes in SPSS',excerpt:'The most frequent errors we see in raw datasets — and how to fix them before analysis.',body:['The most common issue we see is inconsistent coding of missing values — blanks, "N/A", "999", and true system-missing all mixed in the same variable.','A close second is duplicate respondent records from multiple data collection rounds, which silently inflate sample sizes and skew results.','Before any analysis begins, we run a standard checklist: variable types, missing value definitions, duplicate detection, and range checks on every numeric field.'],tags:['SPSS','data cleaning','statistics']}
  ]
  var blogPosts=[], blogFilter='all', blogQuery=''

  function postCardHTML(p){
    var cat = BLOG_CATS.find(function(c){return c.key===p.category})
    return '<article class="insight-card reveal" onclick="window.openBlogPost(\''+p.id+'\')">'+
      '<span class="insight-tag">'+(cat?cat.label:(p.category||'Insight'))+'</span>'+
      '<h3>'+p.title+'</h3><p>'+p.excerpt+'</p>'+
      '<div class="insight-meta">'+(p.tags&&p.tags.length?p.tags.slice(0,3).map(function(t){return '#'+t}).join(' &nbsp; '):'')+'</div>'+
      '<a href="#" onclick="event.stopPropagation();window.openBlogPost(\''+p.id+'\');return false">Read More &rarr;</a>'+
      '</article>'
  }
  function renderBlog(){
    var grid=document.getElementById('blogGrid'); if(!grid) return
    var all = blogPosts.length ? blogPosts : FALLBACK_POSTS
    var items = all.filter(function(p){
      var matchCat = blogFilter==='all'||p.category===blogFilter
      var matchQ = !blogQuery || p.title.toLowerCase().indexOf(blogQuery)>-1 || p.excerpt.toLowerCase().indexOf(blogQuery)>-1
      return matchCat && matchQ
    })
    if(!items.length){ grid.innerHTML='<div class="hub-empty">No articles match your search yet.</div>'; return }
    grid.innerHTML = items.map(postCardHTML).join('')
  }
  async function loadBlog(){
    try{
      var snap = await fbDB.collection('blogPosts').orderBy('createdAt','desc').get()
      blogPosts = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()) })
    }catch(e){ blogPosts=[] }
    renderBlog()
  }
  function wireBlogControls(){
    var wrap=document.getElementById('blogFilterTabs')
    if(wrap){
      wrap.innerHTML = '<button type="button" class="hub-tab active" data-cat="all">All</button>' +
        BLOG_CATS.map(function(c){return '<button type="button" class="hub-tab" data-cat="'+c.key+'">'+c.label+'</button>'}).join('')
      wrap.addEventListener('click',function(e){
        var btn=e.target.closest('[data-cat]'); if(!btn) return
        wrap.querySelectorAll('.hub-tab').forEach(function(b){b.classList.remove('active')})
        btn.classList.add('active')
        blogFilter = btn.getAttribute('data-cat')
        renderBlog()
      })
    }
    var search=document.getElementById('blogSearch')
    if(search){
      search.addEventListener('input',function(){
        blogQuery = search.value.trim().toLowerCase()
        renderBlog()
      })
    }
  }

  window.openBlogPost = function(id){
    var all = blogPosts.length ? blogPosts : FALLBACK_POSTS
    var post = all.find(function(p){return p.id===id})
    if(!post) return
    var modal=document.getElementById('blogModal'); if(!modal) return
    var cat = BLOG_CATS.find(function(c){return c.key===post.category})
    document.getElementById('blogModalTitle').textContent = post.title
    document.getElementById('blogModalTag').textContent = (cat?cat.label:(post.category||'Insight'))
    var cover = document.getElementById('blogModalCover')
    if(post.coverUrl){ cover.src=post.coverUrl; cover.style.display='block' } else { cover.style.display='none' }
    document.getElementById('blogModalBody').innerHTML = (post.body||[]).map(function(p){return '<p>'+p+'</p>'}).join('')
    var tagsWrap = document.getElementById('blogModalTags')
    tagsWrap.innerHTML = (post.tags||[]).map(function(t){return '<span class="blog-tag">#'+t+'</span>'}).join('')
    var related = all.filter(function(p){return p.id!==post.id && p.category===post.category}).slice(0,3)
    if(!related.length) related = all.filter(function(p){return p.id!==post.id}).slice(0,3)
    var relWrap=document.getElementById('blogModalRelated')
    relWrap.innerHTML = related.length ? ('<h5>Related Articles</h5><div class="blog-related-list">'+
      related.map(function(p){return '<button type="button" onclick="window.openBlogPost(\''+p.id+'\')">'+p.title+'</button>'}).join('')+'</div>') : ''
    modal.classList.add('open')
    document.body.style.overflow='hidden'
  }
  window.closeBlogPost = function(){
    var modal=document.getElementById('blogModal'); if(!modal) return
    modal.classList.remove('open')
    document.body.style.overflow=''
  }

  /* =================================================================
     ADMIN — upload handlers (Storage + Firestore) for staff/admin use.
     Mirrors the existing site-media uploader pattern in app.js.
     ================================================================= */
  window.uploadDashboardShowcase = async function(){
    var input=document.getElementById('dashUploadInput')
    var toolSel=document.getElementById('dashUploadTool')
    var titleInp=document.getElementById('dashUploadTitle')
    var statusEl=document.getElementById('dashUploadStatus')
    if(!input||!input.files||!input.files.length){ if(statusEl){statusEl.style.color='#D13438';statusEl.textContent='⚠ Choose an image first.'} return }
    statusEl.style.color='var(--sl)';statusEl.textContent='Uploading...'
    try{
      var f=input.files[0]
      var path='dashboard-showcase/'+Date.now()+'_'+f.name
      var ref=fbStorage.ref(path)
      await ref.put(f)
      var url=await ref.getDownloadURL()
      await fbDB.collection('dashboardShowcase').add({url:url,path:path,tool:toolSel.value,title:titleInp.value||'',uploadedAt:Date.now()})
      statusEl.style.color='#107C10';statusEl.textContent='✓ Uploaded!'
      input.value=''; titleInp.value=''
      loadDashboards()
    }catch(e){ statusEl.style.color='#D13438';statusEl.textContent='⚠ Upload failed: '+e.message }
  }
  window.uploadGalleryItem = async function(){
    var input=document.getElementById('galleryUploadInput')
    var catSel=document.getElementById('galleryUploadCat')
    var statusEl=document.getElementById('galleryUploadStatus')
    if(!input||!input.files||!input.files.length){ if(statusEl){statusEl.style.color='#D13438';statusEl.textContent='⚠ Choose at least one image.'} return }
    statusEl.style.color='var(--sl)';statusEl.textContent='Uploading...'
    try{
      for(var i=0;i<input.files.length;i++){
        var f=input.files[i]
        var path='gallery-items/'+Date.now()+'_'+f.name
        var ref=fbStorage.ref(path)
        await ref.put(f)
        var url=await ref.getDownloadURL()
        await fbDB.collection('galleryItems').add({url:url,path:path,name:f.name,category:catSel.value,uploadedAt:Date.now()})
      }
      statusEl.style.color='#107C10';statusEl.textContent='✓ Uploaded!'
      input.value=''
      loadGallery()
    }catch(e){ statusEl.style.color='#D13438';statusEl.textContent='⚠ Upload failed: '+e.message }
  }
  window.uploadResource = async function(){
    var fileInput=document.getElementById('resourceUploadFile')
    var titleInp=document.getElementById('resourceUploadTitle')
    var descInp=document.getElementById('resourceUploadDesc')
    var catSel=document.getElementById('resourceUploadCat')
    var statusEl=document.getElementById('resourceUploadStatus')
    if(!fileInput||!fileInput.files||!fileInput.files.length||!titleInp.value){ if(statusEl){statusEl.style.color='#D13438';statusEl.textContent='⚠ Title and a file are required.'} return }
    statusEl.style.color='var(--sl)';statusEl.textContent='Uploading...'
    try{
      var f=fileInput.files[0]
      var path='resources/'+Date.now()+'_'+f.name
      var ref=fbStorage.ref(path)
      await ref.put(f)
      var fileUrl=await ref.getDownloadURL()
      await fbDB.collection('resourcesLib').add({title:titleInp.value,description:descInp.value||'',category:catSel.value,fileUrl:fileUrl,filePath:path,uploadedAt:Date.now()})
      statusEl.style.color='#107C10';statusEl.textContent='✓ Uploaded!'
      fileInput.value=''; titleInp.value=''; descInp.value=''
      loadResources()
    }catch(e){ statusEl.style.color='#D13438';statusEl.textContent='⚠ Upload failed: '+e.message }
  }
  window.publishBlogPost = async function(){
    var titleInp=document.getElementById('blogUploadTitle')
    var excerptInp=document.getElementById('blogUploadExcerpt')
    var bodyInp=document.getElementById('blogUploadBody')
    var catSel=document.getElementById('blogUploadCat')
    var tagsInp=document.getElementById('blogUploadTags')
    var coverInput=document.getElementById('blogUploadCover')
    var statusEl=document.getElementById('blogUploadStatus')
    if(!titleInp.value||!excerptInp.value||!bodyInp.value){ if(statusEl){statusEl.style.color='#D13438';statusEl.textContent='⚠ Title, excerpt and body are required.'} return }
    statusEl.style.color='var(--sl)';statusEl.textContent='Publishing...'
    try{
      var coverUrl='', coverPath=''
      if(coverInput.files && coverInput.files.length){
        var f=coverInput.files[0]
        coverPath='blog-media/'+Date.now()+'_'+f.name
        var ref=fbStorage.ref(coverPath)
        await ref.put(f)
        coverUrl=await ref.getDownloadURL()
      }
      var tags = tagsInp.value.split(',').map(function(t){return t.trim()}).filter(Boolean)
      var body = bodyInp.value.split('\n').map(function(p){return p.trim()}).filter(Boolean)
      await fbDB.collection('blogPosts').add({
        title:titleInp.value, excerpt:excerptInp.value, body:body, category:catSel.value,
        tags:tags, coverUrl:coverUrl, coverPath:coverPath, createdAt:Date.now()
      })
      statusEl.style.color='#107C10';statusEl.textContent='✓ Published!'
      titleInp.value='';excerptInp.value='';bodyInp.value='';tagsInp.value='';coverInput.value=''
      loadBlog()
    }catch(e){ statusEl.style.color='#D13438';statusEl.textContent='⚠ Publish failed: '+e.message }
  }

  /* Admin list/delete panels — reuse the same visual pattern as
     loadSiteImages() in app.js. Called from the Admin page when it opens. */
  window.loadDashboardShowcaseAdmin = async function(){
    var grid=document.getElementById('dashAdminGrid'); if(!grid) return
    grid.innerHTML='<div style="color:var(--sl);font-size:.8rem">Loading...</div>'
    try{
      var snap=await fbDB.collection('dashboardShowcase').orderBy('uploadedAt','desc').get()
      if(snap.empty){ grid.innerHTML='<div style="color:var(--sl);font-size:.8rem">No dashboards uploaded yet.</div>'; return }
      grid.innerHTML=snap.docs.map(function(d){
        var v=d.data()
        return '<div style="position:relative;border-radius:8px;overflow:hidden;background:#F4F6FA">'+
          '<img src="'+v.url+'" style="width:100%;height:100px;object-fit:cover;display:block"/>'+
          '<button onclick="deleteDashboardShowcase(\''+d.id+'\',\''+(v.path||'').replace(/'/g,"\\'")+'\')" title="Remove" style="position:absolute;top:.3rem;right:.3rem;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:.8rem">✕</button></div>'
      }).join('')
    }catch(e){ grid.innerHTML='<div style="color:#D13438;font-size:.8rem">Could not load: '+e.message+'</div>' }
  }
  window.deleteDashboardShowcase = async function(id,path){
    if(!confirm('Remove this dashboard preview?')) return
    try{ if(path) await fbStorage.ref(path).delete(); await fbDB.collection('dashboardShowcase').doc(id).delete(); loadDashboardShowcaseAdmin(); loadDashboards() }
    catch(e){ alert('Could not delete: '+e.message) }
  }
  window.loadGalleryAdmin = async function(){
    var grid=document.getElementById('galleryAdminGrid'); if(!grid) return
    grid.innerHTML='<div style="color:var(--sl);font-size:.8rem">Loading...</div>'
    try{
      var snap=await fbDB.collection('galleryItems').orderBy('uploadedAt','desc').get()
      if(snap.empty){ grid.innerHTML='<div style="color:var(--sl);font-size:.8rem">No photos uploaded yet.</div>'; return }
      grid.innerHTML=snap.docs.map(function(d){
        var v=d.data()
        return '<div style="position:relative;border-radius:8px;overflow:hidden;background:#F4F6FA">'+
          '<img src="'+v.url+'" style="width:100%;height:100px;object-fit:cover;display:block"/>'+
          '<button onclick="deleteGalleryItem(\''+d.id+'\',\''+(v.path||'').replace(/'/g,"\\'")+'\')" title="Remove" style="position:absolute;top:.3rem;right:.3rem;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:.8rem">✕</button></div>'
      }).join('')
    }catch(e){ grid.innerHTML='<div style="color:#D13438;font-size:.8rem">Could not load: '+e.message+'</div>' }
  }
  window.deleteGalleryItem = async function(id,path){
    if(!confirm('Remove this photo?')) return
    try{ if(path) await fbStorage.ref(path).delete(); await fbDB.collection('galleryItems').doc(id).delete(); loadGalleryAdmin(); loadGallery() }
    catch(e){ alert('Could not delete: '+e.message) }
  }
  window.loadResourcesAdmin = async function(){
    var list=document.getElementById('resourceAdminList'); if(!list) return
    list.innerHTML='<div style="color:var(--sl);font-size:.8rem">Loading...</div>'
    try{
      var snap=await fbDB.collection('resourcesLib').orderBy('uploadedAt','desc').get()
      if(snap.empty){ list.innerHTML='<div style="color:var(--sl);font-size:.8rem">No resources uploaded yet.</div>'; return }
      list.innerHTML=snap.docs.map(function(d){
        var v=d.data()
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.5rem .7rem;background:#F4F6FA;border-radius:8px;margin-bottom:.4rem">'+
          '<span style="font-size:.82rem;font-weight:600">'+(v.title||'').replace(/</g,'&lt;')+'</span>'+
          '<button onclick="deleteResource(\''+d.id+'\',\''+(v.filePath||'').replace(/'/g,"\\'")+'\')" style="background:none;border:none;color:#D13438;cursor:pointer;font-size:.8rem">Remove</button></div>'
      }).join('')
    }catch(e){ list.innerHTML='<div style="color:#D13438;font-size:.8rem">Could not load: '+e.message+'</div>' }
  }
  window.deleteResource = async function(id,path){
    if(!confirm('Remove this resource?')) return
    try{ if(path) await fbStorage.ref(path).delete(); await fbDB.collection('resourcesLib').doc(id).delete(); loadResourcesAdmin(); loadResources() }
    catch(e){ alert('Could not delete: '+e.message) }
  }
  window.loadBlogAdmin = async function(){
    var list=document.getElementById('blogAdminList'); if(!list) return
    list.innerHTML='<div style="color:var(--sl);font-size:.8rem">Loading...</div>'
    try{
      var snap=await fbDB.collection('blogPosts').orderBy('createdAt','desc').get()
      if(snap.empty){ list.innerHTML='<div style="color:var(--sl);font-size:.8rem">No posts published yet.</div>'; return }
      list.innerHTML=snap.docs.map(function(d){
        var v=d.data()
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.5rem .7rem;background:#F4F6FA;border-radius:8px;margin-bottom:.4rem">'+
          '<span style="font-size:.82rem;font-weight:600">'+(v.title||'').replace(/</g,'&lt;')+'</span>'+
          '<button onclick="deleteBlogPost(\''+d.id+'\',\''+(v.coverPath||'').replace(/'/g,"\\'")+'\')" style="background:none;border:none;color:#D13438;cursor:pointer;font-size:.8rem">Remove</button></div>'
      }).join('')
    }catch(e){ list.innerHTML='<div style="color:#D13438;font-size:.8rem">Could not load: '+e.message+'</div>' }
  }
  window.deleteBlogPost = async function(id,coverPath){
    if(!confirm('Delete this article?')) return
    try{ if(coverPath) await fbStorage.ref(coverPath).delete(); await fbDB.collection('blogPosts').doc(id).delete(); loadBlogAdmin(); loadBlog() }
    catch(e){ alert('Could not delete: '+e.message) }
  }

  /* =================================================================
     Init
     ================================================================= */
  document.addEventListener('DOMContentLoaded',function(){
    wireDashFilters(); loadDashboards()
    wireGalleryFilters(); loadGallery()
    wireResourceControls(); loadResources()
    wireBlogControls(); renderBlog(); loadBlog()
  })
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') window.closeBlogPost && window.closeBlogPost() })

})();
