// gallery.js — StatVision service page image grids + full-screen lightbox
// Shared by the Gallery tab and the Dashboards tab.

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

function openLightbox(url){
  document.getElementById('serviceLightboxImg').src=url
  document.getElementById('serviceLightbox').classList.add('open')
}
function closeLightbox(){
  document.getElementById('serviceLightbox').classList.remove('open')
}
