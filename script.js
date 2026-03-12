/* =========================================================
   ささエール LP 共通JS 完全版
   このファイルを script.js にそのままコピペしてください
   ========================================================= */

/* =========================================================
   1. DOM取得
   このあと使う要素をまとめて取得しています
   FAQ、ページ内リンク、先頭へ戻るボタンが対象です
   ========================================================= */
const faqItems = document.querySelectorAll('.faq-item');
const faqButtons = document.querySelectorAll('.faq-q');
const pageLinks = document.querySelectorAll('a[href^="#"]');
const backToTopButton = document.getElementById('backToTop');


/* =========================================================
   2. FAQ開閉
   質問をクリックしたら、その項目だけ開閉します
   他を自動で閉じたい場合は、closeOtherFaqs を使います
   ========================================================= */
function closeOtherFaqs(currentItem) {
  faqItems.forEach((item) => {
    if (item !== currentItem) {
      item.classList.remove('is-open');
    }
  });
}

faqButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const currentItem = button.closest('.faq-item');
    const isOpen = currentItem.classList.contains('is-open');

    closeOtherFaqs(currentItem);

    if (isOpen) {
      currentItem.classList.remove('is-open');
    } else {
      currentItem.classList.add('is-open');
    }
  });
});


/* =========================================================
   3. ページ内リンクのスムーススクロール
   #services や #faq などのリンクを自然に移動させます
   外部URL（officeplata.com）には影響しません
   ========================================================= */
pageLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.getAttribute('href');

    if (!targetId || targetId === '#') {
      return;
    }

    const targetElement = document.querySelector(targetId);

    if (!targetElement) {
      return;
    }

    event.preventDefault();

    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
});


/* =========================================================
   4. 先頭へ戻る固定ボタンの表示制御
   一定量スクロールしたらボタンを表示し、押すと先頭へ戻ります
   ========================================================= */
function toggleBackToTopButton() {
  if (!backToTopButton) {
    return;
  }

  if (window.scrollY > 400) {
    backToTopButton.classList.add('is-show');
  } else {
    backToTopButton.classList.remove('is-show');
  }
}

window.addEventListener('scroll', toggleBackToTopButton);

if (backToTopButton) {
  backToTopButton.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}


/* =========================================================
   5. 初期表示時の実行
   ページ読み込み直後にも、表示状態を整えておきます
   ========================================================= */
window.addEventListener('load', () => {
  toggleBackToTopButton();
});
