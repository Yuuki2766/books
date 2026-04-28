let books = [];

fetch('books.json')
  .then(res => res.json())
  .then(data => {
    books = data;
    // 初回読み込み時の状態確認
    checkRoute();
  });

// ルーティング制御（戻るボタン対応）
window.addEventListener('hashchange', checkRoute);

function checkRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#detail/')) {
    const title = decodeURIComponent(hash.replace('#detail/', ''));
    const book = books.find(b => b.title === title);
    if (book) showDetail(book);
  } else {
    showList();
  }
}

function showList() {
  document.getElementById('list-view').style.display = 'block';
  document.getElementById('main-header').style.display = 'block';
  document.getElementById('detail-view').style.display = 'none';
  applyFilters();
}

function showDetail(book) {
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('main-header').style.display = 'none';
  const detailView = document.getElementById('detail-view');
  detailView.style.display = 'block';

  const owned = book.owned.length;
  const percent = Math.round((owned / book.total) * 100);

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-header">
      <img src="${book.image || 'https://via.placeholder.com/200x280?text=No+Image'}" alt="容姿画像" class="detail-img">
      <div class="detail-main-info">
        <h2>${book.title}</h2>
        <p><strong>作者:</strong> ${book.author}</p>
        <p><strong>イラスト:</strong> ${book.illustrator || '-'}</p>
        <p><strong>ジャンル:</strong> ${book.genre}</p>
        <p><strong>出版社:</strong> ${book.publisher}</p>
      </div>
    </div>
    <div class="detail-section">
      <h3>あらすじ</h3>
      <p class="summary-text">${book.summary || 'あらすじ情報はまだ登録されていません。'}</p>
    </div>
    <div class="detail-section">
      <h3>収集ステータス</h3>
      <p>所持巻: ${book.owned.join(', ')} / 全${book.total}巻 (${percent}%)</p>
      <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
    </div>
  `;
}

function goBack() {
  window.location.hash = '';
}

function renderBooks(list) {
  const container = document.getElementById('book-list');
  container.innerHTML = '';

  list.forEach(book => {
    const owned = book.owned.length;
    const percent = Math.round((owned / book.total) * 100);

    const card = document.createElement('div');
    card.className = 'book-card';
    // クリックでハッシュを変更（詳細へ移動）
    card.onclick = () => window.location.hash = `detail/${encodeURIComponent(book.title)}`;

    card.innerHTML = `
      <div class="book-title">${book.title}</div>
      <div class="meta">作者: ${book.author} / ${book.genre}</div>
      <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
      <div class="meta-small">クリックで詳細を表示</div>
    `;
    container.appendChild(card);
  });
  updateSummary(list);
}

function updateSummary(list) {
  const total = list.reduce((sum, b) => sum + b.owned.length, 0);
  document.getElementById('summary').innerHTML = `シリーズ数: ${list.length} / 総冊数: ${total}`;
}

function applyFilters() {
  const keyword = document.getElementById('search').value.toLowerCase();
  const publisher = document.getElementById('publisherFilter').value;
  const genre = document.getElementById('genreFilter').value;
  const sort = document.getElementById('sortFilter').value;

  let filtered = books.filter(book => {
    return (book.title.toLowerCase().includes(keyword) || book.author.toLowerCase().includes(keyword)) &&
           (publisher === '' || book.publisher.includes(publisher)) &&
           (genre === '' || book.genre.includes(genre));
  });

  if (sort === 'title') filtered.sort((a,b) => a.title.localeCompare(b.title, 'ja'));
  if (sort === 'author') filtered.sort((a,b) => a.author.localeCompare(b.author, 'ja'));
  if (sort === 'progress') filtered.sort((a,b) => (a.owned.length/a.total) - (b.owned.length/b.total));

  renderBooks(filtered);
}

// イベント設定
document.querySelectorAll('header input, header select').forEach(el => {
  el.addEventListener('input', applyFilters);
});