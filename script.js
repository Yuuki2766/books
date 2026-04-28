let books = [];

fetch('books.json')
  .then(res => res.json())
  .then(data => {
    books = data;
    checkRoute();
  });

// ルーティング制御
window.addEventListener('hashchange', checkRoute);

function checkRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#detail/')) {
    // ハッシュから出版社とタイトルを分離する
    // 例: #detail/小学館/名探偵コナン
    const params = decodeURIComponent(hash.replace('#detail/', '')).split('/');
    const publisher = params[0];
    const title = params[1];

    // タイトルだけでなく、出版社も一致するものを探す
    const book = books.find(b => b.title === title && b.publisher === publisher);
    if (book) {
      showDetail(book);
    } else {
      showList();
    }
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

  const ownedCount = book.owned.length;
  const percent = Math.round((ownedCount / book.total) * 100);

  document.getElementById('detail-content').innerHTML = `
        <div class="detail-container">
            <img src="${book.image || 'https://via.placeholder.com/200x280?text=No+Image'}" class="detail-cover">
            <div class="detail-info">
                <h2>${book.title}</h2>
                <p><strong>著者:</strong> ${book.author}</p>
                <p><strong>イラスト:</strong> ${book.illustrator || 'なし'}</p>
                <p><strong>出版社:</strong> ${book.publisher}</p>
                <p><strong>ジャンル:</strong> ${book.genre}</p>
                <div class="detail-progress">
                    <p>所持巻: ${book.owned.join(', ')} / 全${book.total}巻</p>
                    <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
                </div>
            </div>
        </div>
    `;
}

function renderBooks(list) {
  const container = document.getElementById('book-list');
  container.innerHTML = '';

  list.forEach(book => {
    const ownedCount = book.owned.length;
    const percent = Math.round((ownedCount / book.total) * 100);

    const card = document.createElement('div');
    card.className = 'book-card';
    
    // クリック時に「出版社」と「タイトル」をセットにする
    card.onclick = () => {
      window.location.hash = `detail/${encodeURIComponent(book.publisher)}/${encodeURIComponent(book.title)}`;
    };

    card.innerHTML = `
      <div class="book-title">${book.title}</div>
      <div class="meta">${book.publisher} / ${book.author}</div>
      <div class="tag">${book.genre}</div>
      <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
    `;
    container.appendChild(card);
  });
  updateSummary(list);
}

function updateSummary(list) {
  const total = list.reduce((sum, b) => sum + b.owned.length, 0);
  document.getElementById('summary').textContent = `作品数: ${list.length} / 合計冊数: ${total}`;
}

function applyFilters() {
  const keyword = document.getElementById('search').value.toLowerCase();
  const publisher = document.getElementById('publisherFilter').value;
  const genre = document.getElementById('genreFilter').value;
  const sort = document.getElementById('sortFilter').value;

  let filtered = books.filter(book => {
    const matchText = book.title.toLowerCase().includes(keyword) || book.author.toLowerCase().includes(keyword);
    // 出版社フィルタ（部分一致判定）
    const matchPublisher = publisher === '' || book.publisher.includes(publisher);
    const matchGenre = genre === '' || book.genre.includes(genre);
    return matchText && matchPublisher && matchGenre;
  });

  if (sort === 'title') filtered.sort((a,b) => a.title.localeCompare(b.title, 'ja'));
  if (sort === 'author') filtered.sort((a,b) => a.author.localeCompare(b.author, 'ja'));
  if (sort === 'progress') filtered.sort((a,b) => (a.owned.length/a.total) - (b.owned.length/b.total));

  renderBooks(filtered);
}

function goBack() {
  window.location.hash = '';
}

// イベント登録
document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('publisherFilter').addEventListener('change', applyFilters);
document.getElementById('genreFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);