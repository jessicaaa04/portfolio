console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'contact/', title: 'Contact' },
    { url: 'resume/', title: 'Resume' },
    { url: 'https://github.com/jessicaaa04', title: 'GitHub' }
];

let nav = document.createElement('nav');
document.body.prepend(nav);

const ARE_WE_HOME = document.documentElement.classList.contains('home');

for (const p of pages) {
    let url = p.url;

    if (!ARE_WE_HOME && !url.startsWith('http')) {
        url = `../${url}`;
    }

    const a = document.createElement('a');
    a.href = url;
    a.textContent = p.title;

    if (a.host === location.host && a.pathname === location.pathname) {
        a.classList.add('current');
    }

    if (a.host !== location.host) {
        a.target = '_blank';
    }

    nav.append(a);
}

document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label class="color-scheme">
      Theme:
      <select id="theme-switcher">
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
    `
  );

const themeSwitcher = document.getElementById('theme-switcher');

window.addEventListener('DOMContentLoaded', () => {
    const savedScheme = localStorage.getItem('colorScheme');
    if (savedScheme) {
        document.documentElement.style.colorScheme = savedScheme;
        themeSwitcher.value = savedScheme; // Sync the dropdown with the saved theme
    }
});

themeSwitcher.addEventListener('change', (event) => {
    const selectedScheme = event.target.value;
    document.documentElement.style.colorScheme = selectedScheme;
    localStorage.setItem('colorScheme', selectedScheme); // Save to localStorage
});

const select = document.querySelector('.color-scheme select');

select.addEventListener('input', function (event) {
    console.log('Color scheme changed to', event.target.value);
});

const form = document.querySelector('#contact-form');

form?.addEventListener('submit', (event) => {
  event.preventDefault(); 

  const data = new FormData(form);

  const subject = encodeURIComponent(data.get('subject') || '');
  const message = encodeURIComponent(data.get('message') || '');

  const mailtoLink = `mailto:2089257436@qq.com?subject=${subject}&body=${message}`;

  console.log('Generated mailto link:', mailtoLink); 

  location.href = mailtoLink;
});

  