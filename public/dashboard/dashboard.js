document.addEventListener('DOMContentLoaded', () => {
  const navigationItems = document.querySelectorAll(
    '.top-nav-item, .bottom-nav-item'
  );

  navigationItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      const href = item.getAttribute('href');

      if (!href || href === '#') {
        event.preventDefault();
      }

      const group = item.classList.contains('top-nav-item')
        ? '.top-nav-item'
        : '.bottom-nav-item';

      document.querySelectorAll(group).forEach((navItem) => {
        navItem.classList.remove('active');
      });

      item.classList.add('active');
    });
  });
});
