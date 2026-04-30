let books = [];

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

    list.forEach(book => {
        const owned = book.owned.length;
        const percent = Math.round((owned / book.total) * 100);
        const card = document.createElement('div');
        card.className = 'book-card';
        if (book.favorite) card.classList.add('favorite-card'); // お気に入り用のスタイル適用

        card.onclick = () => {
            window.location.hash = `detail/${encodeURIComponent(book.publisher)}/${encodeURIComponent(book.title)}`;
        };

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
    const searchInput = document.getElementById('search');
    const pubFilter = document.getElementById('publisherFilter');
    const genFilter = document.getElementById('genreFilter');
    const sortFilter = document.getElementById('sortFilter');

    if (!searchInput || !pubFilter || !genFilter || !sortFilter) return;

    const keyword = searchInput.value.toLowerCase();
    const publisher = pubFilter.value;
    const genre = genFilter.value;
    const sort = sortFilter.value;

    let filtered = books.filter(book => {
        const title = book.title || "";
        const author = book.author || "";
        const bGenre = book.genre || "";
        const matchText = title.toLowerCase().includes(keyword) || author.toLowerCase().includes(keyword) || bGenre.toLowerCase().includes(keyword);
        const matchPub = publisher === '' || book.publisher === publisher;
        const matchGen = genre === '' || book.genre.includes(genre);
        return matchText && matchPub && matchGen;
    });

    // ソート処理（お気に入りを最優先）
    filtered.sort((a, b) => {
        // 1. お気に入り設定があるものを強制的に一番上へ
        if (a.favorite !== b.favorite) {
            return a.favorite ? -1 : 1;
        }

        // 2. お気に入り同士、または非お気に入り同士の中でのソート
        if (sort === 'title') {
            const s1 = a.title;
            const s2 = b.title;
            const isNonJP1 = /^[^ぁ-んァ-ヶー一-龠々]/.test(s1);
            const isNonJP2 = /^[^ぁ-んァ-ヶー一-龠々]/.test(s2);

            if (isNonJP1 !== isNonJP2) return isNonJP1 ? 1 : -1;
            return s1.localeCompare(s2, 'ja');
        } else if (sort === 'progress') {
            return (b.owned.length / b.total) - (a.owned.length / a.total);
        }
        return 0;
    });

    renderBooks(filtered);
}

function goBack() { window.location.hash = ''; }

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('publisherFilter').addEventListener('change', applyFilters);
document.getElementById('genreFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);