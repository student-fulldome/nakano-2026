/**
 * main.js — data.json を読み込んで作品カードを生成
 *
 * - サブ画像クリック/タップでメイン画像切り替え
 * - 作品インデックス表示（No.01 …）
 */
(function () {
  'use strict';

  /* ── XSS 対策 ── */
  function esc(str) {
    if (str == null || str === '') return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function linkify(str) {
    return str.replace(
      /(https?:\/\/[^\s&<>"]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  function toHtml(str, withLink) {
    if (!str) return '';
    const escaped = esc(str).replace(/\n/g, '<br>');
    return withLink ? linkify(escaped) : escaped;
  }

  function formatDuration(sec) {
    if (!sec || isNaN(sec)) return '';
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function schoolClass(school) {
    if (!school) return 'other';
    if (school.includes('武蔵野')) return 'musabi';
    if (school.includes('玉川'))   return 'tamagawa';
    if (school.includes('工芸'))   return 'tpu';
    return 'other';
  }

  /* ── 作品カード HTML ── */
  function renderWork(w, idx) {
    /* 全画像リスト（keyvisual を先頭に、空文字を除外） */
    const allImages = [
      w.keyvisual,
      w.subvisual01, w.subvisual02, w.subvisual03, w.subvisual04,
    ].filter(Boolean);

    /* メイン表示エリア */
    const firstSrc = allImages.length > 0 ? `img/${esc(allImages[0])}` : null;
    const mainContent = firstSrc
      ? `<img src="${firstSrc}" alt="${esc(w.title)}" class="dome-main-img" loading="lazy">`
      : `<div class="dome-no-image">NO IMAGE</div>`;

    /* サムネイルストリップ（全画像を並べる、1〜5枚） */
    const thumbsHtml = allImages.length > 0
      ? `<div class="work-thumbs" role="list" aria-label="画像一覧">
          ${allImages.map((f, i) => `
            <button
              class="work-thumb${i === 0 ? ' is-active' : ''}"
              data-src="img/${esc(f)}"
              data-alt="${i === 0 ? esc(w.title) : ''}"
              aria-label="画像 ${i + 1}"
              type="button"
            ><img src="img/${esc(f)}" alt="" loading="lazy"></button>
          `).join('')}
        </div>`
      : '';

    /* テキスト各フィールド */
    const sc          = schoolClass(w.school);
    const indexStr    = String(idx + 1).padStart(2, '0');
    const deptHtml    = w.department  ? `<span class="work-dept">${esc(w.department)}</span>`  : '';
    const seminarHtml = w.seminar     ? `<span class="work-seminar">${esc(w.seminar)}</span>`  : '';
    const durHtml     = w.videoduration
      ? `<span class="work-duration" title="上映時間">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
            <path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          ${formatDuration(w.videoduration)}
        </span>` : '';
    const creditsHtml = w.othercredits
      ? `<p class="work-credits">${toHtml(w.othercredits, true)}</p>` : '';
    const webHtml     = w.website
      ? `<a class="work-website" href="${esc(w.website)}" target="_blank" rel="noopener noreferrer">${esc(w.website)}</a>`
      : '';

    return `
      <article class="work-card" id="work-${indexStr}">
        <div class="work-visual">
          <div class="dome-image">${mainContent}</div>
          ${thumbsHtml}
        </div>
        <div class="work-info">
          <p class="work-index">No.${indexStr}</p>
          <div class="work-meta">
            <span class="badge badge-${sc}">${esc(w.school)}</span>
            ${deptHtml}
            ${seminarHtml}
            ${durHtml}
          </div>
          <h3 class="work-title">${esc(w.title)}</h3>
          <p class="work-author">${esc(w.name)}</p>
          <p class="work-desc">${toHtml(w.description)}</p>
          ${creditsHtml}
          ${webHtml}
        </div>
      </article>
    `;
  }

  /* ── サムネイルクリックでメイン画像切り替え ＋ ドームテクスチャ更新 ── */
  function bindThumbSwap(container) {
    container.addEventListener('click', function (e) {
      const thumb = e.target.closest('.work-thumb');
      if (!thumb) return;

      const card    = thumb.closest('.work-card');
      const mainImg = card.querySelector('.dome-main-img');

      /* メイン画像を差し替え */
      if (mainImg) {
        mainImg.src = thumb.dataset.src;
        mainImg.alt = thumb.dataset.alt || '';
      }

      /* アクティブ状態を更新 */
      card.querySelectorAll('.work-thumb').forEach(function (t) {
        t.classList.toggle('is-active', t === thumb);
      });

      /* ドームのテクスチャを選択中の画像に差し替え */
      document.dispatchEvent(new CustomEvent('dome:setTexture', {
        detail: { src: thumb.dataset.src }
      }));
    });
  }

  /* ── データ読み込み ── */
  fetch('./js/data.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (works) {
      var container = document.getElementById('works-container');
      if (!container) return;
      container.innerHTML = works.map(renderWork).join('');
      bindThumbSwap(container);
    })
    .catch(function (err) {
      var container = document.getElementById('works-container');
      if (container) {
        container.innerHTML =
          '<p class="loading">作品データの読み込みに失敗しました。</p>';
      }
      console.error('data.json の読み込みエラー:', err);
    });

  /* ── ハンバーガーメニュー ── */
  var toggle = document.getElementById('nav-toggle');
  var menu   = document.getElementById('nav-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    });

    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'メニューを開く');
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'メニューを開く');
        toggle.focus();
      }
    });
  }

  /* ── 画像ライトボックス（プログラムカードの画像をクリックで拡大） ── */
  var lightbox    = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightbox-img');
  var lightboxClose = document.getElementById('lightbox-close');

  if (lightbox && lightboxImg && lightboxClose) {
    function openLightbox(src, alt) {
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
    }

    function closeLightbox() {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      lightboxImg.src = '';
    }

    document.querySelectorAll('.program-card-images img, .program-card-text-img').forEach(function (img) {
      img.addEventListener('click', function () {
        openLightbox(img.src, img.alt);
      });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('is-open')) {
        closeLightbox();
      }
    });
  }

})();
