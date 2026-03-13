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
      }
    });
  }, observerOptions);

  animatedElements.forEach(el => observer.observe(el));
}

/* =========================================================
   3. Digital Particle Network Animation (Canvas)
   デジタルネットワークパーティクルアニメーション
   ========================================================= */
function initDigitalParticles() {
  const canvas = document.getElementById('digitalParticles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId;
  let width, height;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.radius = Math.random() * 1.5 + 0.5;
      this.opacity = Math.random() * 0.3 + 0.1;
      // Warm orange or cool cyan
      this.isWarm = Math.random() > 0.3;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      if (this.isWarm) {
        ctx.fillStyle = `rgba(255, 109, 45, ${this.opacity})`;
      } else {
        ctx.fillStyle = `rgba(100, 210, 255, ${this.opacity * 0.8})`;
      }
      ctx.fill();
    }
  }

  // Create particles
  const particleCount = Math.min(Math.floor(width * height / 25000), 60);
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function drawConnections() {
    const maxDist = 150;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const opacity = (1 - dist / maxDist) * 0.08;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          if (particles[i].isWarm || particles[j].isWarm) {
            ctx.strokeStyle = `rgba(255, 109, 45, ${opacity})`;
          } else {
            ctx.strokeStyle = `rgba(100, 210, 255, ${opacity})`;
          }
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    drawConnections();
    animationId = requestAnimationFrame(animate);
  }

  // Only animate when page is visible
  let isVisible = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isVisible = false;
      cancelAnimationFrame(animationId);
    } else {
      isVisible = true;
      animate();
    }
  });

  animate();
}

/* =========================================================
   4. Parallax Effect on Scroll
   スクロール時のパララックス効果
   ========================================================= */
function initParallax() {
  const heroCard = document.querySelector('.hero-card');
  const heroBadge = document.querySelector('.hero-badge');
  
  let ticking = false;

  function updateParallax() {
    const scrollY = window.scrollY;
    
    if (heroCard && scrollY < 600) {
      const translateY = scrollY * 0.08;
      heroCard.style.transform = `translateY(${translateY}px)`;
    }
    
    if (heroBadge && scrollY < 400) {
      const translateX = scrollY * 0.03;
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
   5. Magnetic Button Effect
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
   6. Typing Effect for Hero Title
   ========================================================= */
function initTypingEffect() {
  const heroTitle = document.querySelector('.hero-title');
  if (!heroTitle) return;

  const strongElement = heroTitle.querySelector('strong');
  if (strongElement) {
    strongElement.style.borderRight = '3px solid var(--accent)';
    strongElement.style.paddingRight = '4px';
    
    setTimeout(() => {
      strongElement.style.borderRight = 'none';
      strongElement.style.paddingRight = '0';
    }, 2000);
  }
}

/* =========================================================
   7. Smooth Counter Animation for Prices
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
   8. FAQ開閉
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
   9. ページ内リンクのスムーススクロール
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
   10. 先頭へ戻る固定ボタンの表示制御
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
   11. Digital Glow Effect on Section Headers
   セクションヘッダーにデジタルグロー効果
   ========================================================= */
function initSectionGlow() {
  const sectionTitles = document.querySelectorAll('.section-title');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.textShadow = '0 0 30px rgba(100, 210, 255, 0.08)';
        setTimeout(() => {
          entry.target.style.textShadow = 'none';
          entry.target.style.transition = 'text-shadow 1s ease';
        }, 1500);
      }
    });
  }, { threshold: 0.5 });

  sectionTitles.forEach(el => observer.observe(el));
}

/* =========================================================
   12. Image Lazy Load with Fade Effect
   画像の遅延読み込みとフェード効果
   ========================================================= */
function initImageEffects() {
  const images = document.querySelectorAll('.role-card-image img, .hero-card-image img');
  
  images.forEach(img => {
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.6s ease';
    
    if (img.complete) {
      img.style.opacity = '1';
    } else {
      img.addEventListener('load', () => {
        img.style.opacity = '1';
      });
    }
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
      card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
  });
}

/* =========================================================
   14. 初期表示時の実行
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all features
  initDigitalParticles();
  initScrollAnimations();
  initParallax();
  initMagneticButtons();
  initTypingEffect();
  animateCounters();
  initCardHoverEffects();
  initSectionGlow();
  initImageEffects();
  toggleBackToTopButton();
});

// Fallback for load event
window.addEventListener('load', () => {
  toggleBackToTopButton();
  document.body.classList.add('loaded');
});
