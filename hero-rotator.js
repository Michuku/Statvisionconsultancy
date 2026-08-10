// ══════════════════════════════════════════════════════════════════
// hero-rotator.js — cycles the hero headline + photo together every
// 5 seconds. The headline fades out/in; the two photo layers
// crossfade simultaneously (new one fades in as the old one fades
// out, at the same time — not a fade-to-blank). Loops continuously.
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
  },
  {
    headline: 'Research. Insights. Decisions. <span class="highlight">Impact.</span>',
    image: 'hero-consultant-3.jpg',
    alt: 'StatVision consultants reviewing research findings together'
  }
]

;(function initHeroRotator(){
  const headlineEl = document.getElementById('heroHeadline')
  const layerA = document.getElementById('heroImageA')
  const layerB = document.getElementById('heroImageB')
  if(!headlineEl || !layerA || !layerB || HERO_SLIDES.length < 2) return

  let index = 0
  let activeLayer = layerA
  let idleLayer = layerB
  const HEADLINE_FADE_MS = 500
  const INTERVAL_MS = 5000

  function advance(){
    index = (index + 1) % HERO_SLIDES.length
    const slide = HERO_SLIDES[index]

    // Preload into the currently-hidden layer, then crossfade both layers at once
    idleLayer.src = slide.image
    idleLayer.alt = slide.alt
    idleLayer.classList.add('active')
    activeLayer.classList.remove('active')
    const tmp = activeLayer
    activeLayer = idleLayer
    idleLayer = tmp

    // Headline: simple fade-out/fade-in, timed to sit inside the same 5s beat
    headlineEl.classList.add('hero-fade')
    setTimeout(()=>{
      headlineEl.innerHTML = slide.headline
      headlineEl.classList.remove('hero-fade')
    }, HEADLINE_FADE_MS)
  }

  setInterval(advance, INTERVAL_MS)
})()
