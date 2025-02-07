document.addEventListener('DOMContentLoaded', () => {
    // Select all elements we want to animate
    const fadeElements = document.querySelectorAll('.facts > *, .feedbacks > *, .footer > *');
    const serviceCards = document.querySelectorAll('.service-card');
    const servicesTitle = document.querySelector('.services h2');
    
    // Initialize regular fade elements
    fadeElements.forEach((element, index) => {
        element.classList.add('fade-in');
        element.style.transitionDelay = `${index * 0.1}s`;
    });

    // Initialize services title
    if (servicesTitle) {
        servicesTitle.classList.add('fade-in');
        servicesTitle.style.transitionDelay = '0.1s';
    }

    // Initialize service cards with staggered delays
    serviceCards.forEach((card, index) => {
        card.style.transitionDelay = `${0.3 + (index * 0.2)}s`; // Longer stagger for cards
    });

    // Function to check if element is in viewport
    const isInViewport = (element) => {
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        return (
            rect.top <= windowHeight * 0.9 && // Trigger earlier at 90% of viewport
            rect.bottom >= windowHeight * 0.1 // Keep visible until almost gone
        );
    };

    // Function to check if element is above viewport
    const isAboveViewport = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom < 0;
    };

    // Function to handle scroll
    const handleScroll = () => {
        // Handle regular fade elements
        fadeElements.forEach(element => {
            element.style.transitionDelay = '0s';
            if (isInViewport(element)) {
                element.classList.add('visible');
                element.classList.remove('hidden');
            } else if (isAboveViewport(element)) {
                element.classList.remove('visible');
                element.classList.add('hidden');
            }
        });

        // Handle services title
        if (servicesTitle) {
            servicesTitle.style.transitionDelay = '0s';
            if (isInViewport(servicesTitle)) {
                servicesTitle.classList.add('visible');
            } else if (isAboveViewport(servicesTitle)) {
                servicesTitle.classList.remove('visible');
            }
        }

        // Handle service cards
        serviceCards.forEach(card => {
            card.style.transitionDelay = '0s';
            if (isInViewport(card)) {
                card.classList.add('visible');
            } else if (isAboveViewport(card)) {
                card.classList.remove('visible');
            }
        });
    };

    // Initial check for elements in viewport with a small delay
    setTimeout(() => {
        handleScroll();
        serviceCards.forEach((card, index) => {
            if (isInViewport(card)) {
                setTimeout(() => {
                    card.classList.add('visible');
                }, index * 200); // Longer delay between cards
            }
        });
    }, 200); // Slightly longer initial delay

    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';

    // Add scroll event listener with debounce for better performance
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = window.requestAnimationFrame(() => {
            handleScroll();
        });
    });
}); 