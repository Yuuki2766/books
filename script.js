let books = [];
let currentMainView = 'list'; 
let savedScrollPosition = 0;   
let draggedItemIndex = null;   

// データの読み込み（localStorage最優先）
const localSavedData = localStorage.getItem('local_books_data');
if (localSavedData) {
    books = JSON.parse(localSavedData);
    applyFilters(); 
    checkRoute();
} else {
    fetch('books.json')
        .then(res => res.json())
        .then(data => {
            books = data;
            applyFilters(); 
            checkRoute();
        }).catch(err => {
            alert("books.json のロードに失敗しました。");
        });
}

window.addEventListener('hashchange', checkRoute);

function checkRoute() {
    const hash = window.location.hash;
    if (hash.startsWith('#detail/')) {
        if (document.getElementById('detail-view').style.display === 'none' && 
            document.getElementById('admin-view').style.display === 'none') {
            savedScrollPosition = window.scrollY;
        }
        const params = decodeURIComponent(hash.replace('#detail/', '')).split('/');
        const publisher = params[0];
        const title = params[1];
        const book = books.find(b => b.title === title && b.publisher === publisher);
        if (book) showDetail(book); else showList();
    } else if (hash === '#admin') {
        if (document.getElementById('detail-view').style.display === 'none' && 
            document.getElementById('admin-view').style.display === 'none') {
            savedScrollPosition = window.scrollY;
        }
        showAdmin();
    } else {
        showList();
    }
}

function showList() {
    document.getElementById('detail-view').style.display = 'none';
    document.getElementById('admin-view').style.display = 'none';
    document.getElementById('main-header').style.display = 'block';
    changeMainView(currentMainView);

    setTimeout(() => {
        window.scrollTo(0, savedScrollPosition);
    }, 10);
}

function showAdmin() {
    document.getElementById('detail-view').style.display = 'none';
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('slide-view').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('admin-view').style.display = 'block';
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
    const depressToggle = document.getElementById('depressToggle'); 
    const editModeToggle = document.getElementById('editModeToggle'); // 編集モード状態

    if (!searchInput || !pubFilter || !genFilter || !sortFilter) return;

    const keyword = searchInput.value.toLowerCase();
    const publisher = pubFilter.value;
    const genre = genFilter.value;
    const sort = sortFilter.value;
    const isEditMode = editModeToggle ? editModeToggle.checked : false;
    
    const isSafeMode = r18Toggle ? !r18Toggle.checked : false;
    const safeStatusLabel = document.getElementById('safe-status');
    if (safeStatusLabel) safeStatusLabel.textContent = isSafeMode ? "ON" : "OFF";

    const hideDepressing = depressToggle ? depressToggle.checked : false;

    // ソートやフィルタ前の一番の根っこのインデックスを持たせる
    let indexedBooks = books.map((book, originalIndex) => ({ book, originalIndex }));

    let filtered = indexedBooks.filter(item => {
        const book = item.book;
        const isR18 = book.genre && book.genre.includes('R18');
        if (isSafeMode && isR18) return false;

        const isDepress = book.isDepressing || (book.genre && book.genre.includes('鬱'));
        if (hideDepressing && isDepress) return false;

        const title = book.title || "";
        const author = book.author || "";
        const bGenre = book.genre || "";
        const matchText = title.toLowerCase().includes(keyword) || author.toLowerCase().includes(keyword) || bGenre.toLowerCase().includes(keyword);
        const matchPub = publisher === '' || book.publisher === publisher;
        const matchGen = genre === '' || book.genre.includes(genre);
        return matchText && matchPub && matchGen;
    });

    // 編集（並び替え）モードがONの時はソートを無効化（元配列順固定）してドラッグを破綻させない
    if (isEditMode) {
        filtered.sort((a, b) => a.originalIndex - b.originalIndex);
    } else {
        if (sort === 'favorite') {
            filtered.sort((a, b) => (a.book.favorite === b.book.favorite) ? 0 : (a.book.favorite ? -1 : 1));
        } else if (sort === 'title') {
            filtered.sort((a, b) => {
                const isNonJP1 = /^[^ぁ-んァ-ヶー一-龠々]/.test(a.book.title);
                const isNonJP2 = /^[^ぁ-んァ-ヶー一-龠々]/.test(b.book.title);
                if (isNonJP1 !== isNonJP2) return isNonJP1 ? 1 : -1;
                return a.book.title.localeCompare(b.book.title, 'ja');
            });
        } else if (sort === 'author') {
            filtered.sort((a, b) => a.book.author.localeCompare(b.book.author, 'ja'));
        } else if (sort === 'progress') {
            filtered.sort((a, b) => (b.book.owned.length / b.book.total) - (a.book.owned.length / a.book.total));
        }
    }

    if (currentMainView === 'list') {
        renderBooks(filtered, isEditMode);
    } else {
        renderNetflixView(filtered.map(item => item.book));
    }
}

function renderBooks(list, isEditMode) {
    const container = document.getElementById('book-list');
    container.innerHTML = '';

    list.forEach((item) => {
        const book = item.book;
        const originalIndex = item.originalIndex;
        const owned = book.owned ? book.owned.length : 0;
        const total = book.total || 1;
        const percent = Math.round((owned / total) * 100);
        
        const illustText = book.illustrator ? ` / 絵: ${book.illustrator}` : '';
        const webLinkHtml = book.info_url ? `<span style="margin-left:8px; color:#4f46e5; font-size:12px;">🔗Web</span>` : '';

        const card = document.createElement('div');
        card.className = 'book-card';
        
        // ★ 編集モードスイッチがONの時だけ、ドラッグ関連のリスナーを有効化して移動可能にする
        if (isEditMode) {
            card.draggable = true;
            card.style.cursor = 'move';
            card.style.border = '2px dashed #f43f5e'; // 編集状態だとわかりやすくする枠線
            card.setAttribute('data-index', originalIndex);
            
            card.addEventListener('dragstart', (e) => {
                draggedItemIndex = originalIndex;
                card.style.opacity = '0.4';
            });
            card.addEventListener('dragend', () => {
                card.style.opacity = '1';
                draggedItemIndex = null;
            });
            card.addEventListener('dragover', (e) => e.preventDefault());
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedItemIndex !== null && draggedItemIndex !== originalIndex) {
                    const movedItem = books.splice(draggedItemIndex, 1)[0];
                    books.splice(originalIndex, 0, movedItem);
                    saveToLocalStorage();
                    applyFilters();
                }
            });
        }

        // 通常時は全体クリックで詳細へ。編集モード時は星のタップのみ受け付ける
        const clickAction = isEditMode 
            ? "" 
            : `onclick="window.location.hash = 'detail/${encodeURIComponent(book.publisher)}/${encodeURIComponent(book.title)}'"`;

        // 編集モードONの時だけ星を表示し、誤タップを防ぐ
        const starHtml = isEditMode 
            ? `<div class="fav-star-btn" style="cursor:pointer; font-size:24px; padding:0 15px 0 0; z-index:10;" onclick="toggleFavoriteInline(event, ${originalIndex})">
                ${book.favorite ? '⭐' : '☆'}
               </div>`
            : (book.favorite ? `<div style="font-size:18px; padding:0 10px 0 0;">⭐</div>` : `<div style="width:28px;"></div>`);

        card.innerHTML = `
            <div class="card-content" ${clickAction} style="display:flex; align-items:center; width:100%;">
                ${starHtml}
                <div style="flex:1; display:flex;">
                    <img src="${book.image || 'https://via.placeholder.com/80x110?text=No+Image'}" class="book-cover">
                    <div class="book-info" style="flex:1;">
                        <div class="book-title">${book.title}${webLinkHtml}</div>
                        <div class="meta">${book.publisher} / ${book.author}${illustText}</div>
                        <div class="tag">${book.genre}</div>
                        <div class="progress-container" style="width: 100%;">
                            <div class="progress-text">${owned}/${total}巻 (${percent}%)</div>
                            <div class="progress" style="width: 100%; background:#e5e7eb; height:8px; border-radius:4px; overflow:hidden;">
                                <div class="bar" style="width:${percent}%; background:#4f46e5; height:100%;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        container.appendChild(card);
    });
    updateSummary(list.map(item => item.book));
}

function renderNetflixView(list) {
    const container = document.getElementById('genre-rows-container');
    container.innerHTML = '';
    const targetGenres = ["青春", "ファンタジー", "ミステリー", "ラブコメ", "日常", "ライトノベル", "漫画", "小説", "ネット", "R18", "鬱"];
    const genreMap = {};
    
    list.forEach(book => {
        const bookGenres = book.genre ? book.genre.split(/[・/]/) : ["その他"];
        if (book.isDepressing && !bookGenres.includes("鬱")) {
            bookGenres.push("鬱");
        }
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

    const originalIndex = books.findIndex(b => b.title === book.title && b.publisher === book.publisher);

    document.getElementById('detail-content').innerHTML = `
        <div class="detail-container">
            <img src="${book.image || 'https://via.placeholder.com/240x340?text=No+Image'}" class="detail-cover">
            <div class="detail-info">
                <h2 style="display:flex; align-items:center; gap:10px;">
                    <span id="detail-fav-star" style="cursor:pointer;" onclick="toggleFavoriteInline(event, ${originalIndex}, true)">${book.favorite ? '⭐' : '☆'}</span>
                    ${book.title}
                </h2>
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

function toggleFavoriteInline(event, index, isDetail = false) {
    event.stopPropagation(); 
    books[index].favorite = !books[index].favorite;
    saveToLocalStorage();
    if (isDetail) {
        document.getElementById('detail-fav-star').textContent = books[index].favorite ? '⭐' : '☆';
    } else {
        applyFilters();
    }
}

function addNewBookLocal() {
    const title = document.getElementById('new-title').value.trim();
    const author = document.getElementById('new-author').value.trim();
    const illustrator = document.getElementById('new-illustrator').value.trim();
    const publisher = document.getElementById('new-publisher').value.trim();
    const genre = document.getElementById('new-genre').value.trim();
    const ownedInput = document.getElementById('new-owned').value.trim();
    const totalInput = document.getElementById('new-total').value;
    const summary = document.getElementById('new-summary').value.trim();
    const pdf_url = document.getElementById('new-pdf').value.trim();
    const info_url = document.getElementById('new-info').value.trim();
    
    const isDepressing = document.getElementById('new-depress').checked;
    const favorite = document.getElementById('new-favorite').checked;

    if (!title) {
        alert('作品タイトルは必須です。');
        return;
    }

    let ownedArray = [1];
    if (ownedInput !== "") {
        ownedArray = ownedInput.split(',').map(item => {
            const num = parseFloat(item.trim());
            return isNaN(num) ? item.trim() : num;
        });
    }

    const newBook = {
        title: title,
        author: author,
        illustrator: illustrator,
        publisher: publisher,
        genre: genre,
        owned: ownedArray,
        total: parseInt(totalInput, 10) || 1,
        summary: summary,
        image: "", 
        favorite: favorite,
        isDepressing: isDepressing,
        pdf_url: pdf_url,
        info_url: info_url
    };

    books.push(newBook);
    saveToLocalStorage();
    
    alert(`「${title}」をマネージャーに追加しました！`);
    document.getElementById('add-book-form').reset();
    applyFilters();
    window.location.hash = ''; 
}

function copyJsonToClipboard() {
    const jsonString = JSON.stringify(books, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
        alert('最新のJSONデータをクリップボードにコピーしました！\nGitHubの books.json にそのまま貼り付けて保存してください。');
    }).catch(err => {
        alert('コピーに失敗しました。');
    });
}

function saveToLocalStorage() {
    localStorage.setItem('local_books_data', JSON.stringify(books));
}
function clearLocalChanges() {
    if (confirm('ローカルの変更をすべて削除し、元の books.json を再読込しますか？')) {
        localStorage.removeItem('local_books_data');
        location.reload();
    }
}

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('publisherFilter').addEventListener('change', applyFilters);
document.getElementById('genreFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);
const r18Toggle = document.getElementById('r18Toggle');
if (r18Toggle) r18Toggle.addEventListener('change', applyFilters);
const depressToggle = document.getElementById('depressToggle');
if (depressToggle) depressToggle.addEventListener('change', applyFilters);