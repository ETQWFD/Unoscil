'use strict';

const api = window.unoscil;

const state = {
  items: [],
  filter: 'all',
  query: '',
  info: null,
};

const els = {
  list: document.getElementById('list'),
  empty: document.getElementById('empty'),
  search: document.getElementById('search'),
  filters: document.getElementById('filters'),
  listTitle: document.getElementById('list-title'),
  listSub: document.getElementById('list-sub'),
  statTotal: document.getElementById('stat-total'),
  statPinned: document.getElementById('stat-pinned'),
  statImage: document.getElementById('stat-image'),
  toast: document.getElementById('toast'),
  sheet: document.getElementById('sheet'),
  aboutVersion: document.getElementById('about-version'),
};

const TITLES = {
  all: ['全部记录', '最近复制的文本与图片会出现在这里'],
  text: ['文本记录', '从各应用复制的文字内容'],
  image: ['图片记录', '从截图与图像复制中收录的内容'],
  pinned: ['收藏记录', '置顶保留，不会被批量清理'],
};

let toastTimer = null;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function formatTime(timestamp) {
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return '刚刚';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  const date = new Date(timestamp);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return sameYear
    ? `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function fileUrl(filePath) {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

function iconSvg(kind, pinned) {
  if (kind === 'image') {
    return '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 3.5 3.5L15 12l5 6"/></svg>';
  }
  return '<svg viewBox="0 0 24 24"><path d="M6 4h9l5 5v11H6z"/><path d="M14 4v5h5"/><path d="M9 14h7M9 17h5"/></svg>';
}

function visibleItems() {
  const query = state.query.trim().toLowerCase();
  return state.items.filter((item) => {
    if (state.filter === 'text' && item.kind !== 'text') return false;
    if (state.filter === 'image' && item.kind !== 'image') return false;
    if (state.filter === 'pinned' && !item.pinned) return false;
    if (!query) return true;
    const haystack = `${item.text || ''} ${item.preview || ''} ${item.width || ''} ${item.height || ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderStats() {
  els.statTotal.textContent = String(state.items.length);
  els.statPinned.textContent = String(state.items.filter((item) => item.pinned).length);
  els.statImage.textContent = String(state.items.filter((item) => item.kind === 'image').length);
}

function render() {
  renderStats();
  const [title, sub] = TITLES[state.filter] || TITLES.all;
  els.listTitle.textContent = title;
  els.listSub.textContent = sub;

  const items = visibleItems();
  els.list.replaceChildren();
  els.empty.hidden = items.length > 0;

  for (const item of items) {
    const card = document.createElement('article');
    card.className = `card${item.pinned ? ' pinned' : ''}`;
    card.dataset.id = item.id;

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    if (item.kind === 'image' && item.file) {
      const img = document.createElement('img');
      img.src = fileUrl(item.file);
      img.alt = '剪贴板图片';
      img.loading = 'lazy';
      icon.append(img);
    } else {
      icon.innerHTML = iconSvg(item.kind);
    }

    const main = document.createElement('div');
    main.className = 'card-main';

    const text = document.createElement('p');
    text.className = `card-text${item.kind === 'image' ? ' single' : ''}`;
    text.textContent = item.kind === 'image'
      ? `图片 · ${item.width} × ${item.height} 像素`
      : item.text;

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const kindBadge = document.createElement('span');
    kindBadge.className = 'badge';
    kindBadge.textContent = item.kind === 'image' ? '图片' : '文本';
    const time = document.createElement('span');
    time.textContent = formatTime(item.createdAt);
    meta.append(kindBadge, time);
    if (item.pinned) {
      const pinBadge = document.createElement('span');
      pinBadge.className = 'badge pin';
      pinBadge.textContent = '已收藏';
      meta.append(pinBadge);
    }

    main.append(text, meta);

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.append(
      actionButton('copy', '复制', '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M6 16V6h10"/></svg>'),
      actionButton('pin', item.pinned ? '取消收藏' : '收藏', '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>', 'pin'),
      actionButton('delete', '删除', '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>', 'del'),
    );

    card.append(icon, main, actions);
    els.list.append(card);
  }
}

function actionButton(action, label, svg, extraClass = '') {
  const button = document.createElement('button');
  button.className = `icon-btn ${extraClass}`.trim();
  button.title = label;
  button.setAttribute('aria-label', label);
  button.dataset.action = action;
  button.innerHTML = svg;
  return button;
}

async function refresh() {
  state.items = await api.list();
  render();
}

els.list.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const card = button.closest('.card');
  if (!card) return;
  const id = card.dataset.id;
  const action = button.dataset.action;

  if (action === 'copy') {
    const ok = await api.copy(id);
    toast(ok ? '已复制到剪贴板' : '复制失败');
  } else if (action === 'pin') {
    await api.togglePin(id);
    toast('已更新收藏状态');
  } else if (action === 'delete') {
    await api.remove(id);
    toast('已删除该记录');
  }
});

els.filters.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  state.filter = chip.dataset.filter;
  for (const item of els.filters.querySelectorAll('.chip')) {
    item.classList.toggle('active', item === chip);
  }
  render();
});

els.search.addEventListener('input', () => {
  state.query = els.search.value;
  render();
});

document.getElementById('btn-refresh').addEventListener('click', async () => {
  await refresh();
  toast('已刷新');
});

document.getElementById('btn-clear-unpinned').addEventListener('click', async () => {
  const unpinned = state.items.filter((item) => !item.pinned).length;
  if (unpinned === 0) {
    toast('没有可清理的记录');
    return;
  }
  const confirmed = window.confirm(`确定清空 ${unpinned} 条未收藏记录吗？此操作不可撤销。`);
  if (!confirmed) return;
  await api.clearUnpinned();
  toast('已清空未收藏记录');
});

document.getElementById('btn-clear').addEventListener('click', async () => {
  if (state.items.length === 0) {
    toast('历史记录已经为空');
    return;
  }
  const confirmed = window.confirm('确定清空全部剪贴板历史吗？此操作不可撤销。');
  if (!confirmed) return;
  await api.clear();
  toast('已清空全部历史');
});

document.getElementById('btn-data-dir').addEventListener('click', () => api.openDataDir());

const sheet = els.sheet;
function openSheet() {
  sheet.hidden = false;
}
function closeSheet() {
  sheet.hidden = true;
}
document.getElementById('btn-about').addEventListener('click', openSheet);
document.getElementById('about-mail').addEventListener('click', () => api.contact());
document.getElementById('about-datadir').addEventListener('click', () => api.openDataDir());
document.getElementById('sheet-close').addEventListener('click', closeSheet);
sheet.addEventListener('click', (event) => {
  if (event.target === sheet) closeSheet();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSheet();
});

document.getElementById('btn-min').addEventListener('click', () => api.minimize());
document.getElementById('btn-max').addEventListener('click', () => api.toggleMaximize());
document.getElementById('btn-close').addEventListener('click', () => api.close());

api.onHistoryChanged((items) => {
  state.items = items;
  render();
});

api.onWindowState(() => {});

(async function init() {
  state.info = await api.info();
  els.aboutVersion.textContent = `版本 ${state.info.version} · Windows 桌面版`;
  els.search.focus();
  await refresh();
})();
