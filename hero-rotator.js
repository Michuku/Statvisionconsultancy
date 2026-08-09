// ══════════════════════════════════════════════════════════════════
// hero-rotator.js — cycles the hero headline + photo together every
// 5 seconds, crossfading between them, looping continuously.
// Add more entries to HERO_SLIDES to extend the rotation.
// ══════════════════════════════════════════════════════════════════
const HERO_SLIDES = [
  {
    headline: 'Turning Complex Data Into Powerful <span class="highlight">Business Intelligence.</span>',
    image: 'hero-consultant.jpg',
    alt: 'StatVision data professional working on a laptop'
  },
  {
    headline: 'Empowering Decisions Through <span class="highlight">Data and Research.</span>',
    image: 'hero-consultant-2.jpg',
    alt: 'StatVision research professional working on a laptop'
  }
]

;(function initHeroRotator(){
  const headlineEl = document.getElementById('heroHeadline')
  const imageEl = document.getElementById('heroImage')
  if(!headlineEl || !imageEl || HERO_SLIDES.length < 2) return

  let index = 0
  const FADE_MS = 500
  const INTERVAL_MS = 5000

  function showSlide(i){
    headlineEl.classList.add('hero-fade')
    imageEl.classList.add('hero-fade')
    setTimeout(()=>{
      headlineEl.innerHTML = HERO_SLIDES[i].headline
      imageEl.src = HERO_SLIDES[i].image
      imageEl.alt = HERO_SLIDES[i].alt
      headlineEl.classList.remove('hero-fade')
      imageEl.classList.remove('hero-fade')
    }, FADE_MS)
  }

  setInterval(()=>{
    index = (index + 1) % HERO_SLIDES.length
    showSlide(index)
  }, INTERVAL_MS)
})()
