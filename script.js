/* =========================================================
   ささエール LP 共通JS 完全版
   未来感・デジタル感 + あたたかさ・安心感のアニメーション
   ========================================================= */

/* =========================================================
   1. DOM取得
   ========================================================= */
const faqItems = document.querySelectorAll('.faq-item');
const faqButtons = document.querySelectorAll('.faq-q');
const pageLinks = document.querySelectorAll('a[href^="#"]');
const backToTopButton = document.getElementById('backToTop');

/* =========================================================
   2. Intersection Observer for Scroll Animations
   要素がビューポートに入ったときにアニメーションを発火
   ========================================================= */
function initScrollAnimations() {
  const animatedElements = document.querySelectorAll(
    '.worry-card, .role-card, .service-card, .flow-card, .package, .faq-item, .timeline-step, .section-head'
  );

  // Add animation class to elements
  animatedElements.forEach((el, index) => {
    el.classList.add('animate-on-scroll');
    // Add staggered delays for grid items
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => 
        child.classList.contains('animate-on-scroll')
      );
      const siblingIndex = siblings.indexOf(el);
      if (siblingIndex > 0 && siblingIndex < 4) {
        el.classList.add(`delay-${siblingIndex}`);
      }
    }
  });

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -50px 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        // Optionally unobserve after animation
        // observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  animatedElements.forEach(el => observer.observe(el));
}

/* =========================================================
   3. Create Floating Particles in Hero
   ヒーローセクションにフローティングパーティクルを追加
   ========================================================= */
function createFloatingParticles() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  // Create orbs container
  const orbsContainer = document.createElement('div');
  orbsContainer.className = 'floating-orbs-container';
  orbsContainer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  `;

  // Create multiple orbs with different sizes and positions
  const orbConfigs = [
    { size: 12, left: '15%', top: '20%', color: 'var(--accent)', delay: 0, duration: 6 },
    { size: 8, left: '80%', top: '40%', color: 'var(--yellow)', delay: 2, duration: 8 },
    { size: 16, left: '30%', top: '70%', color: 'linear-gradient(135deg, var(--accent), var(--yellow))', delay: 1, duration: 7 },
    { size: 6, left: '65%', top: '60%', color: 'var(--brown)', delay: 3, duration: 5 },
    { size: 10, left: '50%', top: '30%', color: 'var(--accent)', delay: 1.5, duration: 9 },
    { size: 14, left: '10%', top: '50%', color: 'var(--yellow)', delay: 2.5, duration: 6.5 },
  ];

  orbConfigs.forEach(config => {
    const orb = document.createElement('div');
    orb.style.cssText = `
      position: absolute;
      width: ${config.size}px;
      height: ${config.size}px;
      left: ${config.left};
      top: ${config.top};
      background: ${config.color};
      border-radius: 50%;
      opacity: 0.6;
      animation: float ${config.duration}s ease-in-out infinite;
      animation-delay: ${config.delay}s;
    `;
    orbsContainer.appendChild(orb);
  });

  hero.insertBefore(orbsContainer, hero.firstChild);
}

/* =========================================================
   4. Add Digital Grid Background
   デジタルグリッドの背景を追加
   ========================================================= */
function createDigitalGrid() {
  const grid = document.createElement('div');
  grid.className = 'digital-grid';
  document.body.insertBefore(grid, document.body.firstChild);
}

/* =========================================================
   5. Create Connection Lines Animation
   セクション間の接続線アニメーション
   ========================================================= */
function createConnectionLines() {
  const sections = document.querySelectorAll('.section');
  
  sections.forEach((section, index) => {
    if (index % 2 === 0) {
      const lines = document.createElement('div');
      lines.className = 'connection-lines';
      lines.innerHTML = `
        <svg width="100" height="200" style="top: 20%; right: 5%;">
          <path 
            d="M0,0 Q50,100 0,200" 
            stroke="var(--accent)" 
            stroke-width="1" 
            fill="none" 
            stroke-dasharray="5,5"
            opacity="0.2"
          />
        </svg>
        <svg width="80" height="150" style="bottom: 10%; left: 8%;">
          <circle cx="40" cy="75" r="30" stroke="var(--yellow)" stroke-width="1" fill="none" opacity="0.15"/>
        </svg>
      `;
      section.style.position = 'relative';
      section.insertBefore(lines, section.firstChild);
    }
  });
}

/* =========================================================
   6. Parallax Effect on Scroll
   スクロール時のパララックス効果
   ========================================================= */
function initParallax() {
  const heroCard = document.querySelector('.hero-card');
  const heroBadge = document.querySelector('.hero-badge');
  
  let ticking = false;

  function updateParallax() {
    const scrollY = window.scrollY;
    
    if (heroCard && scrollY < 600) {
      const translateY = scrollY * 0.1;
      const rotate = scrollY * 0.02;
      heroCard.style.transform = `translateY(${translateY}px) rotate(${rotate}deg)`;
    }
    
    if (heroBadge && scrollY < 400) {
      const translateX = scrollY * 0.05;
      heroBadge.style.transform = `translateX(${translateX}px)`;
    }
    
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  });
}

/* =========================================================
   7. Magnetic Button Effect
   ボタンのマグネット効果
   ========================================================= */
function initMagneticButtons() {
  const buttons = document.querySelectorAll('.btn-primary');

  buttons.forEach(button => {
    button.addEventListener('mousemove', (e) => {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      button.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translate(0, 0)';
    });
  });
}

/* =========================================================
   8. Typing Effect for Hero Title (Optional Enhancement)
   ========================================================= */
function initTypingEffect() {
  const heroTitle = document.querySelector('.hero-title');
  if (!heroTitle) return;

  // Add cursor effect to strong element
  const strongElement = heroTitle.querySelector('strong');
  if (strongElement) {
    strongElement.style.borderRight = '3px solid var(--accent)';
    strongElement.style.paddingRight = '4px';
    
    // Remove cursor after animation
    setTimeout(() => {
      strongElement.style.borderRight = 'none';
      strongElement.style.paddingRight = '0';
    }, 2000);
  }
}

/* =========================================================
   9. Smooth Counter Animation for Prices
   価格のカウントアップアニメーション
   ========================================================= */
function animateCounters() {
  const priceElements = document.querySelectorAll('.big-price');
  
  const observerOptions = {
    threshold: 0.5
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = 'true';
        
        // Add pulse animation
        entry.target.style.animation = 'pulse-glow 0.6s ease-out';
        
        setTimeout(() => {
          entry.target.style.animation = '';
        }, 600);
      }
    });
  }, observerOptions);

  priceElements.forEach(el => observer.observe(el));
}

/* =========================================================
   10. FAQ開閉
   ========================================================= */
function closeOtherFaqs(currentItem) {
  faqItems.forEach((item) => {
    if (item !== currentItem) {
      item.classList.remove('is-open');
    }
  });
}

faqButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const currentItem = button.closest('.faq-item');
    const isOpen = currentItem.classList.contains('is-open');

    closeOtherFaqs(currentItem);

    if (isOpen) {
      currentItem.classList.remove('is-open');
    } else {
      currentItem.classList.add('is-open');
    }
  });
});

/* =========================================================
   11. ページ内リンクのスムーススクロール
   ========================================================= */
pageLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.getAttribute('href');

    if (!targetId || targetId === '#') {
      return;
    }

    const targetElement = document.querySelector(targetId);

    if (!targetElement) {
      return;
    }

    event.preventDefault();

    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
});

/* =========================================================
   12. 先頭へ戻る固定ボタンの表示制御
   ========================================================= */
function toggleBackToTopButton() {
  if (!backToTopButton) {
    return;
  }

  if (window.scrollY > 400) {
    backToTopButton.classList.add('is-show');
  } else {
    backToTopButton.classList.remove('is-show');
  }
}

window.addEventListener('scroll', toggleBackToTopButton);

if (backToTopButton) {
  backToTopButton.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/* =========================================================
   13. Card Hover Sound Effect (Visual Feedback)
   カードホバー時の視覚的フィードバック強化
   ========================================================= */
function initCardHoverEffects() {
  const cards = document.querySelectorAll('.worry-card, .role-card, .service-card, .flow-card, .package');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      // Add subtle scale pulse
      card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
  });
}

/* =========================================================
   14. Progressive Loading Effect
   プログレッシブローディング効果
   ========================================================= */
function initProgressiveLoad() {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.5s ease';
  
  window.addEventListener('load', () => {
    document.body.style.opacity = '1';
  });
}

/* =========================================================
   15. 初期表示時の実行
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all features
  createDigitalGrid();
  createFloatingParticles();
  initScrollAnimations();
  initParallax();
  initMagneticButtons();
  initTypingEffect();
  animateCounters();
  initCardHoverEffects();
  toggleBackToTopButton();
  
  // Create connection lines for visual interest
  createConnectionLines();
});

// Fallback for load event
window.addEventListener('load', () => {
  toggleBackToTopButton();
  
  // Ensure animations are ready
  document.body.classList.add('loaded');
});
