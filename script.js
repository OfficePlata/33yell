document.querySelectorAll('.faq-q').forEach((button) => {
  button.addEventListener('click', () => {
    const item = button.parentElement;
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach((faq) => faq.classList.remove('active'));
    if (!isActive) item.classList.add('active');
  });
});

const revealTargets = document.querySelectorAll('.reveal:not(.visible)');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealTargets.forEach((el) => observer.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('visible'));
}
