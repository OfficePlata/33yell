
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Navbar Sticky & Mobile Menu ---
    const navbar = document.getElementById('navbar');
    const mobileMenuButton = document.querySelector('[aria-controls="mobile-menu"]');
    // Mobile menu container creation (since it wasnt in HTML structure initially, or I should have added it. Let's assume I need to toggle visibility of a mobile menu).
    // Actually, I missed adding the mobile menu container in the HTML. I should probably add it or inject it here.
    // For simplicity, I'll inject a simple mobile menu or just log it for now.
    // Better: I will use the existing button to toggle a class on a created menu.

    // Let's create the mobile menu container dynamically for cleaner HTML
    const mobileMenu = document.createElement('div');
    mobileMenu.className = 'md:hidden hidden bg-white shadow-lg absolute top-20 left-0 w-full z-40';
    mobileMenu.innerHTML = `
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <a href="#about" class="text-gray-700 hover:text-navy block px-3 py-2 rounded-md text-base font-medium">About</a>
            <a href="#profile" class="text-gray-700 hover:text-navy block px-3 py-2 rounded-md text-base font-medium">1to1 Sheet</a>
            <a href="#services" class="text-gray-700 hover:text-navy block px-3 py-2 rounded-md text-base font-medium">Services</a>
            <a href="#works" class="text-gray-700 hover:text-navy block px-3 py-2 rounded-md text-base font-medium">Works</a>
            <a href="#contact" class="text-navy font-bold block px-3 py-2 rounded-md text-base">お問い合わせ</a>
        </div>
    `;
    navbar.appendChild(mobileMenu);

    mobileMenuButton.addEventListener('click', () => {
        const isExpanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';
        mobileMenuButton.setAttribute('aria-expanded', !isExpanded);
        mobileMenu.classList.toggle('hidden');
    });

    // Sticky Navbar background change
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('bg-white/90', 'backdrop-blur-md', 'shadow-md');
        } else {
            navbar.classList.remove('bg-white/90', 'backdrop-blur-md', 'shadow-md');
        }
    });


    // --- 2. Parallax Effect ---
    const parallaxLayers = document.querySelectorAll('.parallax-layer');

    window.addEventListener('scroll', () => {
        const scrollY = window.pageYOffset;

        parallaxLayers.forEach(layer => {
            const speed = layer.getAttribute('data-speed');
            const yPos = -(scrollY * speed);
            layer.style.transform = `translateY(${yPos}px)`;
        });
    });


    // --- 3. Intersection Observer for Scroll Animations ---
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optional: Stop observing once revealed
                // observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach(el => observer.observe(el));


    // --- 4. Smooth Scrolling for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Close mobile menu if open
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                    mobileMenuButton.setAttribute('aria-expanded', 'false');
                }

                const headerOffset = 80; // Navbar height
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });

});
