let books = [];
let viewMode = 'grid'; // 'grid' または 'list'
let showR18 = false;   // R18作品を表示するかどうか

// データの読み込み
fetch('books.json')
    .then(res => res.json())
    .then(data => {
        books = data;
        applyFilters(); 
        checkRoute();
    });

window.addEventListener('hashchange', checkRoute);

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
            <img src="${book.image || 'https://via.placeholder.com/240x340?text=No+Image'}" class="detail-cover">
            <div class="detail-info">
                <h2>${book.favorite ? '⭐ ' : ''}${book.title}</h2>
                <p class="meta"><strong>著者:</strong> ${book.author}</p>
                <p class="meta"><strong>イラスト:</strong> ${book.illustrator || 'なし'}</p>
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

function renderBooks(list) {
    const container = document.getElementById('book-list');
    container.innerHTML = '';
    
    // 表示モードによってコンテナのクラスを切り替え
    container.className = viewMode === 'grid' ? 'book-grid' : 'book-list-mode';

    list.forEach(book => {
        const owned = book.owned.length;
        const percent = Math.round((owned / book.total) * 100);
        const card = document.createElement('div');
        
        // モードに応じたクラス付与
        card.className = viewMode === 'grid' ? 'book-card' : 'book-list-item';
        if (book.favorite) card.classList.add('favorite-card');

        card.onclick = () => {
            window.location.hash = `detail/${encodeURIComponent(book.publisher)}/${encodeURIComponent(book.title)}`;
        };

        if (viewMode === 'grid') {
            // グリッド表示のHTML
            card.innerHTML = `
                <div class="card-content">
                    <img src="${book.image || 'https://via.placeholder.com/80x110?text=No+Image'}" class="book-cover">
                    <div class="book-info">
                        <div class="book-title">${book.favorite ? '⭐ ' : ''}${book.title}</div>
                        <div class="meta">${book.publisher} / ${book.author}</div>
                        <div class="tag">${book.genre}</div>
                        <div class="progress-container">
                            <div class="progress-text">${owned}/${book.total}巻 (${percent}%)</div>
                            <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // リスト表示のHTML（1行でコンパクトに）
            card.innerHTML = `
                <div class="list-item-content">
                    <span class="list-title">${book.favorite ? '⭐ ' : ''}${book.title}</span>
                    <span class="list-meta">${book.author} | ${book.publisher}</span>
                    <span class="list-progress">${owned}/${book.total}巻</span>
                </div>
            `;
        }
        container.appendChild(card);
    });
    updateSummary(list);
}

function updateSummary(list) {
    const total = list.reduce((sum, b) => sum + b.owned.length, 0);
    const summary = document.getElementById('summary');
    if(summary) summary.textContent = `全 ${list.length} 作品 / 合計 ${total} 冊`;
}

function applyFilters() {
    const keyword = document.getElementById('search').value.toLowerCase();
    const publisher = document.getElementById('publisherFilter').value;
    const genre = document.getElementById('genreFilter').value;
    const sort = document.getElementById('sortFilter').value;
    
    // セーフモードのチェック状態を取得
    showR18 = document.getElementById('r18Toggle').checked;

    let filtered = books.filter(book => {
        // R18フィルタ: showR18がオフで、作品にR18タグが含まれる場合は除外
        const isR18 = book.genre.includes('R18') || (book.tags && book.tags.includes('R18'));
        if (!showR18 && isR18) return false;

        const title = (book.title || "").toLowerCase();
        const author = (book.author || "").toLowerCase();
        const bGenre = (book.genre || "").toLowerCase();
        
        const matchText = title.includes(keyword) || author.includes(keyword) || bGenre.includes(keyword);
        const matchPub = publisher === '' || book.publisher === publisher;
        const matchGen = genre === '' || book.genre.includes(genre);
        
        return matchText && matchPub && matchGen;
    });

    // ソート処理
    if (sort === 'favorite') {
        filtered.sort((a, b) => (a.favorite === b.favorite) ? 0 : (a.favorite ? -1 : 1));
    } else if (sort === 'title') {
        filtered.sort((a, b) => {
            const isNonJP1 = /^[^ぁ-んァ-ヶー一-龠々]/.test(a.title);
            const isNonJP2 = /^[^ぁ-んァ-ヶー一-龠々]/.test(b.title);
            if (isNonJP1 !== isNonJP2) return isNonJP1 ? 1 : -1;
            return a.title.localeCompare(b.title, 'ja');
        });
    } else if (sort === 'progress') {
        filtered.sort((a, b) => (b.owned.length / b.total) - (a.owned.length / a.total));
    }

    renderBooks(filtered);
}

// モード切り替え
function setViewMode(mode) {
    viewMode = mode;
    // ボタンの見た目管理（activeクラスなど）
    document.getElementById('btn-grid').classList.toggle('active', mode === 'grid');
    document.getElementById('btn-list').classList.toggle('active', mode === 'list');
    applyFilters();
}

function goBack() { window.location.hash = ''; }

// イベントリスナー
document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('publisherFilter').addEventListener('change', applyFilters);
document.getElementById('genreFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);
document.getElementById('r18Toggle').addEventListener('change', applyFilters);