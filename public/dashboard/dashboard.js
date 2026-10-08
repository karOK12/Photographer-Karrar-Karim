document.addEventListener('DOMContentLoaded', () => {
  const content = document.querySelector('.dashboard-content');
  const navigationItems = document.querySelectorAll(
    '.top-nav-item, .bottom-nav-item'
  );

  if (!content) return;

  const sections = {
    studio: {
      label: 'الاستوديو',
      title: 'الاستوديو',
      icon: '📷',
      text: 'من هنا يمكنك إدارة محتوى الاستوديو والصور الفوتوغرافية.'
    },
    poetry: {
      label: 'قصائد شعرية',
      title: 'قصائد شعرية',
      icon: '🪶',
      text: 'من هنا يمكنك إدارة القصائد الشعرية والمحتوى المرتبط بها.'
    },
    theatre: {
      label: 'مسرحي',
      title: 'مسرحي',
      icon: '🎭',
      text: 'من هنا يمكنك إدارة المحتوى المسرحي والأعمال المرتبطة به.'
    },
    events: {
      label: 'المناسبات',
      title: 'المناسبات',
      icon: '📅',
      text: 'من هنا يمكنك إدارة المناسبات والفعاليات.'
    },
    festivals: {
      label: 'المهرجانات',
      title: 'المهرجانات',
      icon: '🏆',
      text: 'من هنا يمكنك إدارة المهرجانات والمشاركات.'
    },
    articles: {
      label: 'المقالات',
      title: 'المقالات',
      icon: '📰',
      text: 'من هنا يمكنك إدارة المقالات والمنشورات.'
    },
    menu: {
      label: 'القائمة',
      title: 'القائمة',
      icon: '☰',
      text: 'من هنا يمكنك الوصول إلى إعدادات وأقسام لوحة التحكم.'
    }
  };

  function getSectionFromHref(href) {
    if (!href) return null;

    const file = href.split('/').pop().split('?')[0];

    if (file === 'index.html' || file === '') {
      return 'home';
    }

    return file.replace('.html', '');
  }

  function setActive(item) {
    const group = item.classList.contains('top-nav-item')
      ? '.top-nav-item'
      : '.bottom-nav-item';

    document.querySelectorAll(group).forEach((navItem) => {
      navItem.classList.remove('active');
    });

    item.classList.add('active');
  }

  function showSection(sectionName, clickedItem) {
    const section = sections[sectionName];

    if (!section) return;

    content.innerHTML = `
      <section class="welcome-section">
        <span class="welcome-label">${section.label}</span>
        <h1>${section.title}</h1>
        <p>
          من هنا يمكنك إدارة محتوى قسم ${section.title}.
        </p>
      </section>

      <section class="content-placeholder">
        <div class="placeholder-icon">${section.icon}</div>
        <h2>${section.title}</h2>
        <p>${section.text}</p>
      </section>
    `;

    if (clickedItem) {
      setActive(clickedItem);
    }
  }

  navigationItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      const href = item.getAttribute('href');
      const sectionName = getSectionFromHref(href);

      if (sectionName && sectionName !== 'home' && sections[sectionName]) {
        event.preventDefault();
        showSection(sectionName, item);
      }
    });
  });
});

/* =========================
   التحكم بالشريط الجانبي
========================= */

document.addEventListener('DOMContentLoaded', () => {
  const sideMenu = document.getElementById('sideMenu');
  const sideMenuToggle = document.getElementById('sideMenuToggle');
  const sideMenuClose = document.getElementById('sideMenuClose');
  const sideMenuOverlay = document.getElementById('sideMenuOverlay');

  if (!sideMenu || !sideMenuToggle || !sideMenuClose || !sideMenuOverlay) {
    return;
  }

  function openSideMenu() {
    sideMenu.classList.add('open');
    sideMenuOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSideMenu() {
    sideMenu.classList.remove('open');
    sideMenuOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  sideMenuToggle.addEventListener('click', openSideMenu);
  sideMenuClose.addEventListener('click', closeSideMenu);
  sideMenuOverlay.addEventListener('click', closeSideMenu);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSideMenu();
    }
  });

  sideMenu.querySelectorAll('a').forEach((item) => {
    item.addEventListener('click', closeSideMenu);
  });
});

const logoutBtn = document.getElementById('logoutBtn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        window.location.href = '/login.html';
        return;
      }

      alert('تعذر تسجيل الخروج');
    } catch (error) {
      console.error('Logout error:', error);
      alert('حدث خطأ أثناء تسجيل الخروج');
    }
  });
}

/* إظهار النشر للمالك فقط */
document.addEventListener('DOMContentLoaded', async () => {
  const publishNavItem = document.getElementById('publishNavItem');

  if (!publishNavItem) return;

  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) return;

    const data = await response.json();

    if (data.success && data.user && data.user.role === 'owner') {
      publishNavItem.hidden = false;
    }
  } catch (error) {
    console.error('Owner check error:', error);
  }
});
