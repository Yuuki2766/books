let books = [];
let currentMainView = 'list'; // 'list' または 'slide'

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
    document.getElementById('detail-view').style.display = 'none';
    document.getElementById('main-header').style.display = 'block';
    changeMainView(currentMainView);
}

function changeMainView(mode) {
    currentMainView = mode;
    const isList = mode === 'list';
    document.getElementById('list-view').style.display = isList ? 'block' : 'none';
    document.getElementById('slide-view').style.display = isList ? 'none' : 'block';
    
    const btnList = document.getElementById('btn-list-view');
    const btnSlide = document.getElementById('btn-slide-view');
    if (btnList) btnList.classList.toggle('active', isList);
    if (btnSlide) btnSlide.classList.toggle('active', !isList);
    
    applyFilters();
}

function applyFilters() {
    const searchInput = document.getElementById('search');
    const pubFilter = document.getElementById('publisherFilter');
    const genFilter = document.getElementById('genreFilter');
    const sortFilter = document.getElementById('sortFilter');
    const r18Toggle = document.getElementById('r18Toggle');

    if (!searchInput || !pubFilter || !genFilter || !sortFilter) return;

    const keyword = searchInput.value.toLowerCase();
    const publisher = pubFilter.value;
    const genre = genFilter.value;
    const sort = sortFilter.value;
    
    const isSafeMode = r18Toggle ? !r18Toggle.checked : false;
    const safeStatusLabel = document.getElementById('safe-status');
    if (safeStatusLabel) safeStatusLabel.textContent = isSafeMode ? "ON" : "OFF";

    let filtered = books.filter(book => {
        const isR18 = book.genre && book.genre.includes('R18');
        if (isSafeMode && isR18) return false;

        const title = book.title || "";
        const author = book.author || "";
        const bGenre = book.genre || "";
        const matchText = title.toLowerCase().includes(keyword) || author.toLowerCase().includes(keyword) || bGenre.toLowerCase().includes(keyword);
        const matchPub = publisher === '' || book.publisher === publisher;
        const matchGen = genre === '' || book.genre.includes(genre);
        return matchText && matchPub && matchGen;
    });

    if (sort === 'favorite') {
        filtered.sort((a, b) => (a.favorite === b.favorite) ? 0 : (a.favorite ? -1 : 1));
    } else if (sort === 'title') {
        filtered.sort((a, b) => {
            const isNonJP1 = /^[^ぁ-んァ-ヶー一-龠々]/.test(a.title);
            const isNonJP2 = /^[^ぁ-んァ-ヶー一-龠々]/.test(b.title);
            if (isNonJP1 !== isNonJP2) return isNonJP1 ? 1 : -1;
            return a.title.localeCompare(b.title, 'ja');
        });
    } else if (sort === 'author') {
        filtered.sort((a, b) => a.author.localeCompare(b.author, 'ja'));
    } else if (sort === 'progress') {
        filtered.sort((a, b) => (b.owned.length / b.total) - (a.owned.length / a.total));
    }

    if (currentMainView === 'list') {
        renderBooks(filtered);
    } else {
        renderNetflixView(filtered);
    }
}

// 一覧画面の描画（イラストレーター表示・Webリンク追加・バー修正）
function renderBooks(list) {
    const container = document.getElementById('book-list');
    container.innerHTML = '';

    list.forEach(book => {
        const owned = book.owned ? book.owned.length : 0;
        const total = book.total || 1;
        const percent = Math.round((owned / total) * 100);
        
        const illustText = book.illustrator ? ` / 絵: ${book.illustrator}` : '';
        const webLinkHtml = book.info_url 
            ? `<span style="margin-left:8px; color:#4f46e5; font-size:12px;">🔗Web</span>` 
            : '';

        const card = document.createElement('div');
        card.className = 'book-card';
        card.onclick = () => window.location.hash = `detail/${encodeURIComponent(book.publisher)}/${encodeURIComponent(book.title)}`;

        card.innerHTML = `
            <div class="card-content">
                <img src="${book.image || 'https://via.placeholder.com/80x110?text=No+Image'}" class="book-cover">
                <div class="book-info" style="flex:1;">
                    <div class="book-title">
                        ${book.favorite ? '⭐ ' : ''}${book.title}${webLinkHtml}
                    </div>
                    <div class="meta">${book.publisher} / ${book.author}${illustText}</div>
                    <div class="tag">${book.genre}</div>
                    <div class="progress-container" style="width: 100%;">
                        <div class="progress-text">${owned}/${total}巻 (${percent}%)</div>
                        <div class="progress" style="width: 100%; background:#e5e7eb; height:8px; border-radius:4px; overflow:hidden;">
                            <div class="bar" style="width:${percent}%; background:#4f46e5; height:100%;"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        container.appendChild(card);
    });
    updateSummary(list);
}

function renderNetflixView(list) {
    const container = document.getElementById('genre-rows-container');
    container.innerHTML = '';
    const targetGenres = ["青春", "ファンタジー", "ミステリー", "ラブコメ", "日常", "SF"];
    const genreMap = {};
    
    list.forEach(book => {
        const bookGenres = book.genre ? book.genre.split(/[・/]/) : ["その他"];
        targetGenres.forEach(target => {
            if (bookGenres.some(bg => bg.includes(target))) {
                if (!genreMap[target]) genreMap[target] = [];
                genreMap[target].push(book);
            }
        });
    });

    const displayGenres = targetGenres.filter(g => genreMap[g]);
    if (displayGenres.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:50px; color:#666;">該当する作品がありません</p>';
        return;
    }

    displayGenres.forEach(gName => {
        const row = document.createElement('div');
        row.className = 'genre-row';
        row.innerHTML = `
            <div class="genre-header"><h3>${gName}</h3></div>
            <div class="horizontal-scroll">
                ${genreMap[gName].map(b => `
                    <div class="mini-card" onclick="window.location.hash='detail/${encodeURIComponent(b.publisher)}/${encodeURIComponent(b.title)}'">
                        <img src="${b.image || 'https://via.placeholder.com/100x140?text=No+Image'}" loading="lazy">
                        <div class="mini-title">${b.title}</div>
                    </div>
                `).join('')}
            </div>`;
        container.appendChild(row);
    });
}

function showDetail(book) {
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('slide-view').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('detail-view').style.display = 'block';

    const ownedCount = book.owned ? book.owned.length : 0;
    const totalCount = book.total || 1;
    const percent = Math.round((ownedCount / totalCount) * 100);

    const infoLinkHtml = book.info_url 
        ? `<p class="meta"><strong>作品URL:</strong> <a href="${book.info_url}" target="_blank" style="color: #4f46e5; text-decoration: underline;">作品ページを開く</a></p>` 
        : '';
    const pdfButtonHtml = book.pdf_url 
        ? `<button class="read-btn" onclick="openPdf('${book.pdf_url}')" style="background:#4f46e5; color:white; border:none; padding:15px; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:15px; width:100%; font-size:16px;">📖 本を読む</button>` 
        : '';

    document.getElementById('detail-content').innerHTML = `
        <div class="detail-container">
            <img src="${book.image || 'https://via.placeholder.com/240x340?text=No+Image'}" class="detail-cover">
            <div class="detail-info">
                <h2>${book.favorite ? '⭐ ' : ''}${book.title}</h2>
                <div class="meta-info">
                    <p class="meta"><strong>著者:</strong> ${book.author}</p>
                    ${book.illustrator ? `<p class="meta"><strong>イラスト:</strong> ${book.illustrator}</p>` : ''}
                    ${infoLinkHtml}
                </div>
                <div class="summary-section">
                    <h3>あらすじ</h3>
                    <p class="summary-text">${book.summary || 'あらすじ情報は未登録です。'}</p>
                </div>
                <div class="detail-progress">
                    <p class="meta"><strong>所持状況:</strong> ${ownedCount} / ${totalCount}巻 (${percent}%)</p>
                    <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
                    <p style="font-size:12px; color:#666; margin-top:10px;">既刊: ${book.owned ? book.owned.join(', ') : ''}</p>
                </div>
                ${pdfButtonHtml}
            </div>
        </div>`;
}

function openPdf(url) {
    if (url.toLowerCase().endsWith('.txt')) {
        window.open(`viewer.html?file=${encodeURIComponent(url)}`, '_blank');
    } else {
        window.open(url, '_blank');
    }
}

function updateSummary(list) {
    const total = list.reduce((sum, b) => sum + (b.owned ? b.owned.length : 0), 0);
    const summary = document.getElementById('summary');
    if(summary) summary.textContent = `全 ${list.length} 作品 / 合計 ${total} 冊`;
}

function goBack() { window.location.hash = ''; }

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('publisherFilter').addEventListener('change', applyFilters);
document.getElementById('genreFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);
const r18Toggle = document.getElementById('r18Toggle');
if (r18Toggle) r18Toggle.addEventListener('change', applyFilters);