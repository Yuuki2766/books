let books = [];
let currentMainView = 'list'; 
let savedScrollPosition = 0;   
let draggedItemIndex = null;   

// データの読み込み
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
        
        // タイトルと出版社（および空白トリム）を考慮して対象データを厳密に検索
        const book = books.find(b => (b.title || "").trim() === title.trim() && (b.publisher || "").trim() === publisher.trim());
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
    
    const header = document.getElementById('main-header');
    if (header) header.style.display = ''; 

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

function toggleEditModeUi() {
    const toggle = document.getElementById('editModeToggle');
    const label = document.getElementById('edit-mode-label');
    if (!toggle || !label) return;

    if (toggle.checked) {
        label.style.background = '#f43f5e';
        label.style.color = '#fff';
        label.style.borderColor = '#f43f5e';
    } else {
        label.style.background = '#333';
        label.style.color = '#aaa';
        label.style.borderColor = '#444';
    }
    applyFilters();
}

// メディア種別を自動判定する内部関数
function getMediaType(book) {
    const genreStr = book.genre || '';
    const pubStr = book.publisher || '';
    if (genreStr.includes('漫画') || genreStr.includes('コミック') || pubStr.includes('コミックス')) {
        return { name: '漫画', color: '#e11d48' };
    } else if (pubStr.includes('なろう') || pubStr.includes('カクヨム') || genreStr.includes('ネット')) {
        return { name: 'Web', color: '#2563eb' };
    } else {
        return { name: '小説', color: '#16a34a' };
    }
}

function applyFilters() {
    const searchInput = document.getElementById('search');
    const pubFilter = document.getElementById('publisherFilter');
    const genFilter = document.getElementById('genreFilter');
    const sortFilter = document.getElementById('sortFilter');
    const r18Toggle = document.getElementById('r18Toggle');
    const depressToggle = document.getElementById('depressToggle'); 
    const editModeToggle = document.getElementById('editModeToggle'); 

    if (!searchInput || !pubFilter || !genFilter || !sortFilter) return;

    const keyword = searchInput.value.toLowerCase();
    const publisher = pubFilter.value;
    const genre = genFilter.value;
    const sort = sortFilter.value;
    const isEditMode = editModeToggle ? editModeToggle.checked : false;
    
    const isSafeMode = r18Toggle ? r18Toggle.checked : false;
    const safeStatusLabel = document.getElementById('safe-status');
    if (safeStatusLabel) safeStatusLabel.textContent = isSafeMode ? "ON" : "OFF";

    const hideDepressing = depressToggle ? depressToggle.checked : false;

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
        if (isEditMode) {
            renderBooks(filtered, isEditMode);
        } else {
            // 通常モード時：同一タイトルかつ同一作者のアイテムをマージしてグループ化（空白文字トリム適用）
            const grouped = [];
            filtered.forEach(item => {
                const cleanTitle = (item.book.title || "").trim();
                const cleanAuthor = (item.book.author || "").trim();
                
                const existing = grouped.find(g => g.title === cleanTitle && g.author === cleanAuthor);
                if (existing) {
                    existing.variants.push(item);
                } else {
                    grouped.push({
                        title: cleanTitle,
                        author: cleanAuthor,
                        variants: [item]
                    });
                }
            });
            renderGroupedBooks(grouped);
        }
    } else {
        renderNetflixView(filtered.map(item => item.book));
    }
}

// 編集モード(並び替え等)の時に動く、従来型の全展開レンダリング
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
        
        if (isEditMode) {
            card.draggable = true;
            card.style.cursor = 'move';
            card.style.border = '2px dashed rgba(244, 63, 94, 0.4)'; 
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

        const clickAction = "";

        const starHtml = `
            <div class="fav-star-container" onclick="toggleFavoriteInline(event, ${originalIndex})" style="cursor:pointer; font-size:20px;">
                ${book.favorite ? '⭐' : '☆'}
            </div>`;

        const progressHtml = `<div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                <button class="vol-btn" onclick="changeOwnedVolume(event, ${originalIndex}, -1)">-</button>
                <span style="font-size:14px; font-weight:bold; color:#222;">所持: ${owned} / 総: ${total}巻</span>
                <button class="vol-btn" onclick="changeOwnedVolume(event, ${originalIndex}, 1)">+</button>
               </div>`;

        const mobileOrderControls = `<div class="edit-controls-right" onclick="event.stopPropagation();">
                <button class="order-btn" onclick="moveOrderInline(${originalIndex}, -1)">▲</button>
                <button class="order-btn" onclick="moveOrderInline(${originalIndex}, 1)">▼</button>
               </div>`;

        card.innerHTML = `
            <div class="card-content" ${clickAction}>
                ${starHtml}
                <div style="flex:1; display:flex; min-width:0;">
                    <img src="${book.image || 'https://via.placeholder.com/80x110?text=No+Image'}" class="book-cover">
                    <div class="book-info" style="flex:1; min-width:0; padding-left:10px;">
                        <div class="book-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${book.title}${webLinkHtml}</div>
                        <div class="meta" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${book.publisher} / ${book.author}${illustText}</div>
                        <div class="tag">${book.genre}</div>
                        ${progressHtml}
                    </div>
                </div>
                ${mobileOrderControls}
            </div>`;
        container.appendChild(card);
    });
    updateSummary(list.map(item => item.book));
}

// 通常表示時に動く、グループ統合型のレンダリング関数
function renderGroupedBooks(groupedList) {
    const container = document.getElementById('book-list');
    container.innerHTML = '';

    groupedList.forEach(group => {
        // GA文庫など「Webサイト以外」があればそれを優先して代表の表示オブジェクト(primaryItem)にする
        let primaryItem = group.variants.find(v => !v.book.publisher.includes('なろう') && !v.book.publisher.includes('カクヨム'));
        if (!primaryItem) {
            primaryItem = group.variants[0];
        }
        const book = primaryItem.book;

        // 包含する全メディアのインラインバッジ文字列を作る
        const badgesHtml = group.variants.map(v => {
            const media = getMediaType(v.book);
            return `<span class="title-badge" style="background:${media.color}">${media.name}</span>`;
        }).join('');

        const totalOwned = group.variants.reduce((sum, v) => sum + (v.book.owned ? v.book.owned.length : 0), 0);
        const totalMax = group.variants.reduce((sum, v) => sum + (v.book.total || 1), 0);
        const percent = Math.round((totalOwned / totalMax) * 100);

        const card = document.createElement('div');
        card.className = 'book-card';
        
        // 詳細へ飛ぶリンクのバッティング・文字化けを防ぐエンコード処理
        const clickAction = `onclick="window.location.hash = 'detail/${encodeURIComponent(book.publisher)}/${encodeURIComponent(book.title)}'"`;

        card.innerHTML = `
            <div class="card-content" ${clickAction}>
                <div class="fav-star-container" style="font-size:20px;">
                    ${group.variants.some(v => v.book.favorite) ? '⭐' : ''}
                </div>
                <div style="flex:1; display:flex; min-width:0;">
                    <img src="${book.image || 'https://via.placeholder.com/80x110?text=No+Image'}" class="book-cover">
                    <div class="book-info" style="flex:1; min-width:0; padding-left:10px;">
                        <div class="book-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${book.title}${badgesHtml}
                        </div>
                        <div class="meta" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${book.author}</div>
                        <div class="progress-container" style="width: 100%;">
                            <div class="progress-text">全メディア合計: ${totalOwned}/${totalMax}巻 (${percent}%)</div>
                            <div class="progress" style="width: 100%; background:#e5e7eb; height:8px; border-radius:4px; overflow:hidden;">
                                <div class="bar" style="width:${percent}%; background:#4f46e5; height:100%;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        container.appendChild(card);
    });

    const allBooks = groupedList.flatMap(g => g.variants.map(v => v.book));
    updateSummary(allBooks);
}

function changeOwnedVolume(event, index, direction) {
    event.stopPropagation();
    const book = books[index];
    if (!book.owned) book.owned = [];
    if (direction === 1) {
        const nextVol = book.owned.length + 1;
        book.owned.push(nextVol);
        if (book.owned.length > book.total) book.total = book.owned.length;
    } else if (direction === -1) {
        if (book.owned.length > 0) book.owned.pop();
    }
    saveToLocalStorage();
    applyFilters();
}

function moveOrderInline(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= books.length) return;
    const temp = books[index];
    books[index] = books[targetIndex];
    books[targetIndex] = temp;
    saveToLocalStorage();
    applyFilters();
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

// 詳細表示（同じタイトルのオブジェクトをまとめて内包し、サブタブで内部スイッチする）
function showDetail(book) {
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('slide-view').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('detail-view').style.display = 'block';

    // トリムした文字列状態で同一タイトル・同一作者の全バリエーションを取得
    const cleanTitle = (book.title || "").trim();
    const cleanAuthor = (book.author || "").trim();
    const variants = books.filter(b => (b.title || "").trim() === cleanTitle && (b.author || "").trim() === cleanAuthor);
    
    let activeSubIndex = variants.findIndex(b => b.publisher === book.publisher);
    if (activeSubIndex === -1) activeSubIndex = 0;

    function renderDetailContent(subIndex) {
        const currentBook = variants[subIndex];
        const ownedCount = currentBook.owned ? currentBook.owned.length : 0;
        const totalCount = currentBook.total || 1;
        const percent = Math.round((ownedCount / totalCount) * 100);

        const infoLinkHtml = currentBook.info_url 
            ? `<p class="meta"><strong>作品URL:</strong> <a href="${currentBook.info_url}" target="_blank" style="color: #4f46e5; text-decoration: underline;">作品ページを開く</a></p>` 
            : '';
        const pdfButtonHtml = currentBook.pdf_url 
            ? `<button class="read-btn" onclick="openPdf('${currentBook.pdf_url}')" style="background:#4f46e5; color:white; border:none; padding:15px; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:15px; width:100%; font-size:16px;">📖 本を読む</button>` 
            : '';

        const originalIndex = books.findIndex(b => b.title === currentBook.title && b.publisher === currentBook.publisher);

        let tabsHtml = '';
        if (variants.length > 1) {
            tabsHtml = `<div class="media-tab-container">`;
            variants.forEach((v, idx) => {
                const media = getMediaType(v);
                const activeClass = idx === subIndex ? 'active' : '';
                tabsHtml += `<button class="media-tab-btn ${activeClass}" onclick="window.switchDetailTab(${idx})">${media.name}版 (${v.publisher})</button>`;
            });
            tabsHtml += `</div>`;
        }

        document.getElementById('detail-content').innerHTML = `
            <div class="detail-container" id="detail-view-main-card">
                <img src="${currentBook.image || 'https://via.placeholder.com/240x340?text=No+Image'}" class="detail-cover">
                <div class="detail-info">
                    <h2 style="display:flex; align-items:center; gap:10px;">
                        <span id="detail-fav-star" style="cursor:pointer;" onclick="toggleFavoriteInline(event, ${originalIndex}, true)">${currentBook.favorite ? '⭐' : '☆'}</span>
                        ${currentBook.title}
                    </h2>
                    
                    ${tabsHtml}

                    <div class="meta-info">
                        <p class="meta"><strong>著者:</strong> ${currentBook.author}</p>
                        ${currentBook.illustrator ? `<p class="meta"><strong>イラスト:</strong> ${currentBook.illustrator}</p>` : ''}
                        <p class="meta"><strong>出版社・レーベル:</strong> ${currentBook.publisher}</p>
                        <p class="meta"><strong>ジャンル:</strong> ${currentBook.genre}</p>
                        ${infoLinkHtml}
                    </div>
                    <div class="summary-section">
                        <h3>あらすじ</h3>
                        <p class="summary-text">${currentBook.summary || 'あらすじ情報は未登録です。'}</p>
                    </div>
                    <div class="detail-progress">
                        <p class="meta"><strong>所持状況:</strong> ${ownedCount} / ${totalCount}巻 (${percent}%)</p>
                        <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
                        <p style="font-size:12px; color:#666; margin-top:10px;">既刊: ${currentBook.owned ? currentBook.owned.join(', ') : ''}</p>
                    </div>
                    ${pdfButtonHtml}
                    
                    <button onclick="openInlineEditForm(${originalIndex})" style="background:#0f172a; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:15px; width:100%;">
                        🛠️ この本の内容を直接編集する
                    </button>
                </div>
            </div>
            <div id="inline-edit-form-zone"></div>`;
    }

    window.switchDetailTab = function(idx) {
        renderDetailContent(idx);
    };

    renderDetailContent(activeSubIndex);
}

function openInlineEditForm(index) {
    const book = books[index];
    const zone = document.getElementById('inline-edit-form-zone');
    
    if (zone.innerHTML !== "") {
        zone.innerHTML = "";
        return;
    }

    zone.innerHTML = `
        <div class="edit-form-container">
            <h3 style="margin-top:0; color:#0f172a;">📝 作品情報の直接編集</h3>
            
            <div>
                <label>作品タイトル</label>
                <input type="text" id="edit-title" value="${book.title || ''}">
            </div>
            <div>
                <label>著者</label>
                <input type="text" id="edit-author" value="${book.author || ''}">
            </div>
            <div>
                <label>イラストレーター</label>
                <input type="text" id="edit-illustrator" value="${book.illustrator || ''}">
            </div>
            <div>
                <label>出版社・レーベル</label>
                <input type="text" id="edit-publisher" value="${book.publisher || ''}">
            </div>
            <div>
                <label>ジャンル (スラッシュ区切り)</label>
                <input type="text" id="edit-genre" value="${book.genre || ''}">
            </div>
            <div>
                <label>既刊・所持巻数 (カンマ区切り)</label>
                <input type="text" id="edit-owned" value="${book.owned ? book.owned.join(', ') : '1'}">
            </div>
            <div>
                <label>総巻数</label>
                <input type="number" id="edit-total" value="${book.total || 1}">
            </div>
            <div>
                <label>カバー画像ファイルパス</label>
                <input type="text" id="edit-image" value="${book.image || ''}">
            </div>
            <div>
                <label>あらすじ</label>
                <textarea id="edit-summary" rows="4">${book.summary || ''}</textarea>
            </div>
            <div>
                <label>PDF/TXT URLパス</label>
                <input type="text" id="edit-pdf" value="${book.pdf_url || ''}">
            </div>
            <div>
                <label>作品公式URL</label>
                <input type="text" id="edit-info" value="${book.info_url || ''}">
            </div>
            <div style="display:flex; gap:15px; margin: 5px 0;">
                <label><input type="checkbox" id="edit-depress" ${book.isDepressing ? 'checked' : ''}> 鬱展開属性を付与</label>
            </div>

            <div class="edit-form-btns">
                <button onclick="saveInlineEdit(${index})" style="flex:1; background:#10b981; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">💾 編集を完了してJSONを取得</button>
                <button onclick="document.getElementById('inline-edit-form-zone').innerHTML=''" style="background:#ef4444; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">キャンセル</button>
            </div>
        </div>`;
    
    zone.scrollIntoView({ behavior: 'smooth' });
}

function saveInlineEdit(index) {
    const title = document.getElementById('edit-title').value.trim();
    if (!title) {
        alert('タイトルは空にできません。');
        return;
    }

    const ownedInput = document.getElementById('edit-owned').value.trim();
    let ownedArray = [];
    if (ownedInput !== "") {
        ownedArray = ownedInput.split(',').map(item => {
            const num = parseFloat(item.trim());
            return isNaN(num) ? item.trim() : num;
        });
    }

    books[index].title = title;
    books[index].author = document.getElementById('edit-author').value.trim();
    books[index].illustrator = document.getElementById('edit-illustrator').value.trim();
    books[index].publisher = document.getElementById('edit-publisher').value.trim();
    books[index].genre = document.getElementById('edit-genre').value.trim();
    books[index].owned = ownedArray;
    books[index].total = parseInt(document.getElementById('edit-total').value, 10) || 1;
    books[index].image = document.getElementById('edit-image').value.trim();
    books[index].summary = document.getElementById('edit-summary').value.trim();
    books[index].pdf_url = document.getElementById('edit-pdf').value.trim();
    books[index].info_url = document.getElementById('edit-info').value.trim();
    books[index].isDepressing = document.getElementById('edit-depress').checked;

    saveToLocalStorage();
    applyFilters();
    exportCurrentJson();
    showDetail(books[index]);
}

function exportCurrentJson() {
    const jsonString = JSON.stringify(books, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
        alert('✅ 変更を保存しました！\n\n今までの「すべての追加・編集・並び替え」が含まれた最新の全部入りJSONデータをクリップボードにコピーしました。\nそのまま GitHub の books.json に上書き保存してください！');
    }).catch(err => {
        alert('変更は保存されましたが、クリップボードへの自動コピーに失敗しました。管理画面からコピーしてください。');
    });
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
    const image = document.getElementById('new-image').value.trim();
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
        image: image, 
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

// ボタン操作による手動ヘッダー開閉コントロール
function toggleHeaderPanel() {
    const header = document.getElementById('main-header');
    const triggerBtn = document.getElementById('btn-trigger-search');
    if (!header) return;

    const isHidden = header.classList.toggle('panel-hide');

    if (isHidden) {
        if (triggerBtn) triggerBtn.style.display = 'flex';
    } else {
        if (triggerBtn) triggerBtn.style.display = 'none';
    }
}