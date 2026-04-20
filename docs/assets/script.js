// Copy to clipboard functionality
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showNotification('Copied to clipboard!');
      })
      .catch(err => {
        fallbackCopy(text);
      });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
    showNotification('Copied to clipboard!');
  } catch (err) {
    showNotification('Copy failed. Please select and copy manually.');
  }

  document.body.removeChild(textArea);
}

// Show notification
function showNotification(message) {
  // Remove existing notification if any
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        font-weight: 500;
        transition: all 0.3s ease;
        transform: translateX(100px);
        opacity: 0;
    `;

  document.body.appendChild(notification);

  // Animate in
  requestAnimationFrame(() => {
    notification.style.transform = 'translateX(0)';
    notification.style.opacity = '1';
  });

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100px)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function () {
  const navLinks = document.querySelectorAll('.nav-menu a[href^="#"]');

  navLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        const navHeight = document.querySelector('.navbar').offsetHeight;
        const targetPosition = targetElement.offsetTop - navHeight - 20;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth',
        });
      }
    });
  });
});

// Add scroll-based navbar background
document.addEventListener('scroll', function () {
  const navbar = document.querySelector('.navbar');
  const scrolled = window.scrollY > 50;

  if (scrolled) {
    navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.98)';
    navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
  } else {
    navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    navbar.style.boxShadow = 'none';
  }
});

// Analytics and tracking (placeholder)
function trackEvent(action, category, label) {
  if (typeof gtag !== 'undefined') {
    gtag('event', action, {
      event_category: category,
      event_label: label,
    });
  }

  // Console log for development
  console.log(`Event tracked: ${action} - ${category} - ${label}`);
}

// Track link clicks
document.addEventListener('click', function (e) {
  const link = e.target.closest('a');
  if (link) {
    const href = link.getAttribute('href');
    const text = link.textContent.trim();

    if (href && href.startsWith('http')) {
      trackEvent('external_link_click', 'Navigation', text);
    } else if (href && href.startsWith('#')) {
      trackEvent('internal_link_click', 'Navigation', text);
    }
  }
});

// Track copy button clicks
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('copy-btn')) {
    trackEvent('copy_command', 'User Interaction', 'Install Command');
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
  // Ctrl/Cmd + K to focus search (future feature)
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    // Future: focus search input
    console.log('Search shortcut triggered');
  }

  // Escape to close modals (future feature)
  if (e.key === 'Escape') {
    // Future: close any open modals
    console.log('Escape key pressed');
  }
});

// Progressive enhancement for better performance
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    }
  );

  // Observe cards and sections for animation
  document.addEventListener('DOMContentLoaded', function () {
    const animatableElements = document.querySelectorAll('.card, .api-section, .example-card');
    animatableElements.forEach(el => observer.observe(el));
  });
}

// Add CSS for animations
const animationStyles = `
    .card, .api-section, .example-card {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease, transform 0.6s ease;
    }

    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = animationStyles;
document.head.appendChild(styleSheet);
