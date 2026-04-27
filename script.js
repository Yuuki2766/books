let books = [];

fetch('books.json')
  .then(res => res.json())
  .then(data => {
    books = data;
    applyFilters();
  });

function renderBooks(list) {
  const container = document.getElementById('book-list');
  container.innerHTML = '';

  list.forEach(book => {
    const ownedCount = book.owned.length;
    const percent = Math.round((ownedCount / book.total) * 100);
    
    // 欠けている巻を計算
    const missing = [];
    for (let i = 1; i <= book.total; i++) {
      if (!book.owned.includes(i)) missing.push(i);
    }
    const missingText = missing.length > 0 ? `不足: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}` : 'コンプリート！';

    const card = document.createElement('div');
    card.className = `book-card ${percent === 100 ? 'complete' : ''}`;

    card.innerHTML = `
      <div class="book-title">${book.title}</div>
      <div class="tag-row">
        <span class="tag genre-tag">${book.genre}</span>
        <span class="tag pub-tag">${book.publisher}</span>
      </div>
      <div class="meta"><strong>作者:</strong> ${book.author} ${book.illustrator ? `/ ${book.illustrator}` : ''}</div>
      <div class="status-row">
        <span>所持: <strong>${ownedCount}</strong> / 全${book.total}巻</span>
        <span class="percent-text">${percent}%</span>
      </div>
      <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
      <div class="missing-info">${missingText}</div>
    `;

    container.appendChild(card);
  });

  updateSummary(list);
}

function updateSummary(list) {
  const series = list.length;
  const totalOwned = list.reduce((sum, b) => sum + b.owned.length, 0);
  const completeSeries = list.filter(b => b.owned.length === b.total).length;
  
  document.getElementById('summary').innerHTML = `
    <span>シリーズ数: <strong>${series}</strong></span> | 
    <span>総冊数: <strong>${totalOwned}</strong></span> | 
    <span>読了（コンプ）: <strong>${completeSeries}</strong></span>
  `;
}

function applyFilters() {
  const keyword = document.getElementById('search').value.toLowerCase();
  const publisher = document.getElementById('publisherFilter').value;
  const genre = document.getElementById('genreFilter').value;
  const sort = document.getElementById('sortFilter').value;

  let filtered = books.filter(book => {
    // ジャンル検索を「含む」判定にして柔軟に
    const matchText = book.title.toLowerCase().includes(keyword) || 
                      book.author.toLowerCase().includes(keyword);
    
    const matchPublisher = publisher === '' || book.publisher.includes(publisher);
    const matchGenre = genre === '' || book.genre.includes(genre);
    
    return matchText && matchPublisher && matchGenre;
  });

  // ソート機能
  if (sort === 'progress') {
    filtered.sort((a, b) => (a.owned.length / a.total) - (b.owned.length / b.total));
  } else if (sort === 'total') {
    filtered.sort((a, b) => b.total - a.total);
  }

  renderBooks(filtered);
}

// イベントリスナーの登録（一括）
['input', 'change'].forEach(event => {
  document.querySelectorAll('header input, header select').forEach(el => {
    el.addEventListener(event, applyFilters);
  });
});