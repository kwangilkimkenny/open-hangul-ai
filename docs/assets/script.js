// Copy to clipboard functionality
// Updated: 2026-04-20 - Canvas Particle System
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

// Add scroll-based navbar background (uses .is-scrolled class — see CSS)
document.addEventListener('scroll', function () {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  navbar.classList.toggle('is-scrolled', window.scrollY > 12);
});

// Mobile hamburger toggle
document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (!toggle || !menu) return;

  const closeMenu = () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '메뉴 열기');
  };

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
  });

  // Close on link click (mobile)
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  // Close on escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  // Close when resizing back to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMenu();
  });
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

// Reveal-on-scroll for elements marked with .reveal (style is in CSS)
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  });
}

// ===== Background Canvas Particle System =====

class TextParticle {
  constructor(canvas, text) {
    this.canvas = canvas;
    this.text = text;
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.fontSize = Math.random() * 20 + 12;
    this.opacity = Math.random() * 0.1 + 0.05;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.002;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;

    // Wrap around screen
    if (this.x > this.canvas.width + 50) this.x = -50;
    if (this.x < -50) this.x = this.canvas.width + 50;
    if (this.y > this.canvas.height + 50) this.y = -50;
    if (this.y < -50) this.y = this.canvas.height + 50;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.font = `${this.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = '#2d3748';
    ctx.textAlign = 'center';

    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillText(this.text, 0, 0);

    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.canvas = document.getElementById('backgroundCanvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.keywords = [
      // 한글 키워드
      '문서',
      '편집',
      '한글',
      '워드',
      '엑셀',
      '파워포인트',
      '보안',
      '검증',
      '신뢰',
      '편집기',
      '뷰어',
      '파일',

      // 영어 키워드
      'HWPX',
      'Document',
      'Security',
      'AI',
      'Verification',
      'React',
      'TypeScript',
      'AEGIS',
      'TruthAnchor',
      'Canvas',
      'Editor',
      'Viewer',
      'Parser',

      // 기술 키워드
      'JavaScript',
      'Node.js',
      'Vite',
      'npm',
      'PDF',
      'DOCX',
      'Excel',
      'PowerPoint',
    ];

    this.init();
    this.setupEventListeners();
    this.animate();
  }

  init() {
    this.resizeCanvas();
    this.createParticles();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createParticles() {
    const density = Math.min(100, Math.floor((this.canvas.width * this.canvas.height) / 15000));

    this.particles = [];
    for (let i = 0; i < density; i++) {
      const randomKeyword = this.keywords[Math.floor(Math.random() * this.keywords.length)];
      this.particles.push(new TextParticle(this.canvas, randomKeyword));
    }
  }

  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.createParticles();
    });

    // Pause animation when tab is not visible (performance optimization)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopAnimation();
      } else {
        this.animate();
      }
    });
  }

  animate() {
    if (document.hidden) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(particle => {
      particle.update();
      particle.draw(this.ctx);
    });

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// Initialize particle system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add a small delay to ensure canvas is rendered
  setTimeout(() => {
    new ParticleSystem();
  }, 100);
});

// Accessibility: Respect user's motion preferences
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Don't initialize particle system for users who prefer reduced motion
  const canvas = document.getElementById('backgroundCanvas');
  if (canvas) {
    canvas.style.display = 'none';
  }
}
