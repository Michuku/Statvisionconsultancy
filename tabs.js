// tabs.js — StatVision service page tab system
// Gallery / Dashboards / Process / Tools / Results

function switchServiceTab(name){
  document.querySelectorAll('#serviceTabBar .sm-tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name))
  document.querySelectorAll('#serviceTabPanels .sm-tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===name))
  if(name==='results') animateServiceResultCounters()
}
function resetServiceTabs(){ switchServiceTab('gallery') }
