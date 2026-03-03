document.addEventListener('DOMContentLoaded', () => {

  // --- Navbar scroll effect ---
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });

  // --- Scroll reveal ---
  const revealTargets = document.querySelectorAll(
    'section, .pain-card, .feature-card, .step, .faq-item, .pricing-card, .preview-card'
  );
  revealTargets.forEach(el => el.classList.add('reveal'));
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 60);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  revealTargets.forEach(el => revealObserver.observe(el));

  // --- Smooth scroll for nav links ---
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // --- Preview tabs ---
  const tabs = document.querySelectorAll('.preview-tab');
  const panes = document.querySelectorAll('.preview-pane');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('pane-' + tab.dataset.tab).classList.add('active');
    });
  });

  // --- FAQ accordion ---
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  // --- Currency toggle (landing page) ---
  let isUSD = false;
  const currencyToggle = document.getElementById('currencyToggle');
  const currencyLabel = document.getElementById('currencyLabel');
  const starterPriceLanding = document.getElementById('starterPriceLanding');
  const proLandingPrice = document.getElementById('proPriceLanding');
  const starterLandingBtn = document.getElementById('starterLandingBtn');
  const proLandingBtn = document.getElementById('proLandingBtn');

  if (currencyToggle) {
    currencyToggle.addEventListener('click', () => {
      isUSD = !isUSD;
      if (isUSD) {
        if (starterPriceLanding) starterPriceLanding.innerHTML = '$6.99<span>/mo</span>';
        if (proLandingPrice) proLandingPrice.innerHTML = '$14.99<span>/mo</span>';
        if (starterLandingBtn) { starterLandingBtn.textContent = 'Get Starter — $6.99/mo'; starterLandingBtn.href = 'checkout.html?plan=starter&currency=usd'; }
        if (proLandingBtn) { proLandingBtn.textContent = 'Get Pro — $14.99/mo'; proLandingBtn.href = 'checkout.html?plan=pro&currency=usd'; }
        currencyLabel.textContent = '🌍 Global Pricing';
        currencyToggle.textContent = 'Switch to INR (₹)';
      } else {
        if (starterPriceLanding) starterPriceLanding.innerHTML = '₹499<span>/mo</span>';
        if (proLandingPrice) proLandingPrice.innerHTML = '₹999<span>/mo</span>';
        if (starterLandingBtn) { starterLandingBtn.textContent = 'Get Starter — ₹499/mo'; starterLandingBtn.href = 'checkout.html?plan=starter'; }
        if (proLandingBtn) { proLandingBtn.textContent = 'Get Pro — ₹999/mo'; proLandingBtn.href = 'checkout.html?plan=pro'; }
        currencyLabel.textContent = '🇮🇳 India Pricing';
        currencyToggle.textContent = 'Switch to USD ($)';
      }
    });
  }

});
