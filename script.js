let books = [];
let viewMode = 'grid'; // 'grid' または 'list'

// データの読み込み
fetch('books.json')
    .then(res => res.json())
    .then(data => {
        books = data;
        applyFilters(); 
        checkRoute();
    });

window.addEventListener('hashchange', checkRoute);

// ルーティング制御
function checkRoute() {
    const hash = window.location.hash;
    if (hash.startsWith('#detail/')) {
        const params = decodeURIComponent(hash.replace('#detail/', '')).split('/');
        const publisher = params[0];
        const title = params[1];
        const book = books.find(b => b.title === title && b.publisher === publisher);
        if (book) showDetail(book); else showList();
    } else {
        showList();
    }
}

// 一覧表示への切り替え
function showList() {
    document.getElementById('list-view').style.display = 'block';
    document.getElementById('main-header').style.display = 'block';
    document.getElementById('detail-view').style.display = 'none';
    applyFilters();
}

// 詳細表示への切り替え
function showDetail(book) {
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    const detailView = document.getElementById('detail-view');
    detailView.style.display = 'block';

    const ownedCount = book.owned.length;
    const percent = Math.round((ownedCount / book.total) * 100);

    document.getElementById('detail-content').innerHTML = `
        <div class="detail-container">
            <img src="${book.image || 'https://via.placeholder.com/240x340?text=No+Image'}" class="detail-cover">
            <div class="detail-info">
                <h2>${book.favorite ? '⭐ ' : ''}${book.title}</h2>
                <p class="meta"><strong>著者:</strong> ${book.author}</p>
                <p class="meta"><strong>出版社:</strong> ${book.publisher}</p>
                <p class="meta"><strong>ジャンル:</strong> ${book.genre}</p>
                
                <div class="summary-section">
                    <h3>あらすじ</h3>
                    <p class="summary-text">${book.summary || 'あらすじ情報は未登録です。'}</p>
                </div>

                <div class="detail-progress">
                    <p class="meta"><strong>所持状況:</strong> ${ownedCount} / ${book.total}巻 (${percent}%)</p>
                    <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
                    <p style="font-size:12px; color:#666; margin-top:10px;">既刊: ${book.owned.join(', ')}</p>
                </div>
            </div>
        </div>
    `;
}

// 書籍リストのレンダリング
function renderBooks(list) {
    const container = document.getElementById('book-list');
    container.innerHTML = '';
    
    // 表示モードによってコンテナのクラスを切り替え
    container.className = viewMode === 'grid' ? 'book-grid' : 'book-shelf-mode';

    list.forEach(book => {
        const owned = book.owned.length;
        const percent = Math.round((owned / book.total) * 100);
        const card = document.createElement('div');
        
        // モードに応じたクラス付与
        card.className = viewMode === 'grid' ? 'book-card' : 'shelf-item';
        if (book.favorite) card.classList.add('favorite-card');

        card.onclick = () => {
            window.location.hash = `detail/${encodeURIComponent(book.publisher)}/${encodeURIComponent(book.title)}`;
        };

        if (viewMode === 'grid') {
            card.innerHTML = `
                <div class="card-content">
                    <img src="${book.image || 'https://via.placeholder.com/80x110?text=No+Image'}" class="book-cover">
                    <div class="book-info">
                        <div class="book-title">${book.favorite ? '⭐ ' : ''}${book.title}</div>
                        <div class="meta">${book.publisher} / ${book.author}</div>
                    </div>
                </div>
            `;
        } else {
            // 本棚（アイコン付きリスト）表示
            card.innerHTML = `
                <div class="shelf-content">
                    <span class="book-icon">📖</span>
                    <div class="shelf-info">
                        <span class="shelf-title">${book.favorite ? '⭐ ' : ''}${book.title}</span>
                        <span class="shelf-meta">${book.author} | ${book.publisher}</span>
                    </div>
                    <span class="shelf-badge">${owned}/${book.total}</span>
                </div>
            `;
        }
        container.appendChild(card);
    });
    updateSummary(list);
}

// 統計情報の更新
function updateSummary(list) {
    const total = list.reduce((sum, b) => sum + b.owned.length, 0);
    const summary = document.getElementById('summary');
    if(summary) summary.textContent = `全 ${list.length} 作品 / 合計 ${total} 冊`;
}

// フィルタリングとソートの適用
function applyFilters() {
    const keyword = document.getElementById('search').value.toLowerCase();
    const publisher = document.getElementById('publisherFilter').value;
    const genre = document.getElementById('genreFilter').value;
    const sort = document.getElementById('sortFilter').value;
    
    // セーフモードの判定（チェックされていない時にONとする）
    const isSafeMode = !document.getElementById('r18Toggle').checked;
    const statusLabel = document.getElementById('safe-status');
    if(statusLabel) statusLabel.textContent = isSafeMode ? "ON" : "OFF";

    let filtered = books.filter(book => {
        // セーフモードONの時、R18関連を除外
        const isR18 = (book.genre && book.genre.includes('R18')) || (book.tags && book.tags.includes('R18'));
        if (isSafeMode && isR18) return false;

        const title = (book.title || "").toLowerCase();
        const author = (book.author || "").toLowerCase();
        
        const matchText = title.includes(keyword) || author.includes(keyword);
        const matchPub = publisher === '' || book.publisher === publisher;
        const matchGen = genre === '' || book.genre.includes(genre);
        
        return matchText && matchPub && matchGen;
    });

    // ソート処理
    if (sort === 'favorite') {
        // お気に入り順の時は、JSON内の登場順を維持しつつお気に入りを上に
        filtered.sort((a, b) => (a.favorite === b.favorite) ? 0 : (a.favorite ? -1 : 1));
    } else if (sort === 'title') {
        filtered.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
    } else if (sort === 'progress') {
        filtered.sort((a, b) => (b.owned.length / b.total) - (a.owned.length / a.total));
    }

    renderBooks(filtered);
}

// 表示モードの切り替え
function setViewMode(mode) {
    viewMode = mode;
    const btnGrid = document.getElementById('btn-grid');
    const btnList = document.getElementById('btn-list');
    
    if(btnGrid) btnGrid.classList.toggle('active', mode === 'grid');
    if(btnList) btnList.classList.toggle('active', mode === 'list');
    
    applyFilters();
}

function goBack() { window.location.hash = ''; }

// イベントリスナーの登録
document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('publisherFilter').addEventListener('change', applyFilters);
document.getElementById('genreFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);
document.getElementById('r18Toggle').addEventListener('change', applyFilters);