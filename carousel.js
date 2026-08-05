// carousel.js — StatVision service page image carousel
// Autoplay, arrows, dot indicators, pause-on-hover, touch swipe, fade transition.
// Depends on: openLightbox() from gallery.js

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
