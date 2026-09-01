let books = [];
let currentMainView = 'list'; 
let currentContentMode = 'all'; // 'normal', 'syosetu', 'web', 'r18'
let savedScrollPosition = 0;   
let draggedItemIndex = null;   
let selectedPublishers = new Set();
let selectedGenres = new Set();
let genreLogic = 'or';
let readStatusFilter = 'all';
let filterOptionsSignature = '';
const readingStates = JSON.parse(localStorage.getItem('book_reading_states') || '{}');
const recentBooksKey = 'recent_books_v1';
let lastCollectionRoute = '#library';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function forceScrollTop() {
    const reset = () => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
    };
    reset();
    requestAnimationFrame(() => requestAnimationFrame(reset));
    setTimeout(reset, 120);
}

// ⚡ 起動時は、現在のモード（normal）のデータを読み込む
loadBooksDataByMode();

window.addEventListener('hashchange', checkRoute);

function checkRoute() {
    const hash = window.location.hash;
    if (hash.startsWith('#detail/')) {
        if (document.getElementById('detail-view').style.display === 'none' && 
            document.getElementById('admin-view').style.display === 'none') {
            savedScrollPosition = window.scrollY;
        }
        const params = decodeURIComponent(hash.replace('#detail/', '')).split('/');
        const hasSource = params.length >= 3;
        const sourceMode = hasSource ? params[0] : '';
        const publisher = params[hasSource ? 1 : 0];
        const title = params[hasSource ? 2 : 1];
        const book = books.find(b => b.title === title && b.publisher === publisher && (!sourceMode || b._sourceMode === sourceMode));
        if (book) showDetail(book); else showList();
    } else if (hash === '#admin') {
        if (document.getElementById('detail-view').style.display === 'none' && 
            document.getElementById('admin-view').style.display === 'none') {
            savedScrollPosition = window.scrollY;
        }
        showAdmin();
    } else if (hash === '#reading') {
        showReadingPage();
    } else if (hash === '#library') {
        showList();
    } else {
        showHome();
    }
}

async function navigateApp(page) {
    const target = `#${page}`;
    if ((page === 'home' || page === 'reading') && currentContentMode !== 'all') {
        currentContentMode = 'all';
        syncContentModeUi('all');
        await loadBooksDataByMode();
    }
    if (window.location.hash === target) checkRoute();
    else window.location.hash = target;
}

function syncContentModeUi(mode) {
    const tabs = {
        all: document.getElementById('tab-mode-all'),
        normal: document.getElementById('tab-mode-normal'),
        syosetu: document.getElementById('tab-mode-syosetu'),
        web: document.getElementById('tab-mode-web'),
        r18: document.getElementById('tab-mode-r18')
    };
    Object.values(tabs).forEach(tab => tab?.classList.remove('active-all', 'active-normal', 'active-syosetu', 'active-web', 'active-r18'));
    tabs[mode]?.classList.add(`active-${mode}`);
    const isAll = mode === 'all';
    const editLabel = document.getElementById('edit-mode-label');
    const adminRow = document.getElementById('link-admin-view')?.parentElement;
    if (editLabel) editLabel.style.display = isAll ? 'none' : 'inline-flex';
    if (adminRow) adminRow.style.display = isAll ? 'none' : 'block';
}

function setActiveAppPage(page) {
    const nav = document.getElementById('app-nav');
    if (nav) nav.style.display = 'flex';
    document.querySelectorAll('#app-nav [data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
}

function hideAppPages() {
    ['home-view','reading-view','list-view','slide-view','grid-view','detail-view','admin-view'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
}

// ⚡ 現在のモードに対応するJSONのファイル名を取得する関数
// ⚡ 現在のモードに対応するJSONのファイル名を取得する関数
function getJsonFileNameByMode() {
    if (currentContentMode === 'syosetu') return 'books-syosetu.json'; // 小説と漫画をここに集約
    if (currentContentMode === 'r18') return 'books-r18.json';
    if (currentContentMode === 'web') return 'books-web.json';
    return 'books-normal.json';
}

function modeFromFile(file) {
    return ({'books-normal.json':'normal','books-syosetu.json':'syosetu','books-web.json':'web','books-r18.json':'r18'})[file] || currentContentMode;
}

function tagBookSource(book, mode) {
    Object.defineProperty(book, '_sourceMode', {value: mode, writable: true, configurable: true, enumerable: false});
    return book;
}

// ⚡ モードに応じたJSONファイルを読み込む関数
async function loadBooksDataByMode() {
    syncContentModeUi(currentContentMode);
    const storageKey = `local_books_data_${currentContentMode}`;
    const localSavedData = localStorage.getItem(storageKey);

    if (currentContentMode === 'all') localStorage.removeItem('local_books_data_all');
    if (localSavedData && currentContentMode !== 'all') {
        books = JSON.parse(localSavedData).map(book => tagBookSource(book, currentContentMode));
        applyFilters(); 
        checkRoute();
        return;
    }

    try {
        if (currentContentMode === 'all') {
            const isR18Unlocked = localStorage.getItem('r18_unlocked') === 'true';
            // 全モードのファイルを並列で取得
            const files = ['books-normal.json', 'books-syosetu.json', 'books-web.json'];
            if (isR18Unlocked) {
                files.push('books-r18.json');
            }
            const results = await Promise.all(
                files.map(file => fetch(`${file}?_=${new Date().getTime()}`).then(res => res.ok ? res.json() : []))
            );
            books = results.flatMap((list, index) => list.map(book => tagBookSource(book, modeFromFile(files[index]))));
        } else {
            // 既存の単一ファイル取得
            const jsonFileName = getJsonFileNameByMode();
            const res = await fetch(`${jsonFileName}?_=${new Date().getTime()}`);
            if (!res.ok) throw new Error();
            books = (await res.json()).map(book => tagBookSource(book, currentContentMode));
        }
    } catch (err) {
        // エラー時は空配列で初期化
        books = [];
    }

    applyFilters();
    checkRoute();
}

// ⚡ タブを切り替えたら、アクティブクラスを変更してJSONデータごとリロード
function switchContentMode(mode) {
    if (currentContentMode === mode) return; 
    
    currentContentMode = mode;
    
    // UIの表示切り替え（「全体」の時だけ隠す）
    const isAdminMode = (mode === 'all');
    const adminLink = document.getElementById('link-admin-view')?.parentElement; // 管理リンクの親
    const editLabel = document.getElementById('edit-mode-label'); // 🛠️ 編集ラベル
    if (editLabel) {
        // 'all' なら隠し、それ以外なら表示する
        editLabel.style.display = (mode === 'all') ? 'none' : 'inline-flex';
    }
    
    if (adminLink) adminLink.style.display = isAdminMode ? 'none' : 'block';
    if (editLabel) editLabel.style.display = isAdminMode ? 'none' : 'inline-flex';
    
    // タブの管理（IDはHTMLに合わせて適宜調整してください）
    const tabs = {
        all: document.getElementById('tab-mode-all'),
        normal: document.getElementById('tab-mode-normal'),
        syosetu: document.getElementById('tab-mode-syosetu'),
        web: document.getElementById('tab-mode-web'),
        r18: document.getElementById('tab-mode-r18')
    };
    
    // 全てのタブからactiveクラスを削除（クラス名は定義に合わせてください）
    Object.values(tabs).forEach(tab => {
        if(tab) tab.classList.remove('active-all', 'active-normal', 'active-syosetu', 'active-web', 'active-r18');
    });
    
    // 選択されたタブにクラスを付与
    if (tabs[mode]) {
        tabs[mode].classList.add('active-' + mode);
    }
    
    savedScrollPosition = 0;
    loadBooksDataByMode();
}

function showList() {
    hideAppPages();
    setActiveAppPage('library');
    
    const header = document.getElementById('main-header');
    if (header) {
        header.style.display = 'block';
    }

    // 【修正箇所】一覧に戻った時、ヘッダーが開いていればボタンを隠し、閉じていればボタンを出す
    const triggerBtn = document.getElementById('btn-trigger-search');
    if (triggerBtn) {
        // ヘッダーがpanel-hideクラスを持っている（＝閉じている）ならボタンを表示
        triggerBtn.style.display = header.classList.contains('panel-hide') ? 'flex' : 'none';
    }
    
    changeMainView(currentMainView);

    setTimeout(() => {
        window.scrollTo(0, savedScrollPosition);
    }, 10);
}

function showHome() {
    hideAppPages();
    setActiveAppPage('home');
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('btn-trigger-search').style.display = 'none';
    document.getElementById('home-view').style.display = 'block';
    renderHomeDashboard();
    forceScrollTop();
}

function showReadingPage() {
    hideAppPages();
    setActiveAppPage('reading');
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('btn-trigger-search').style.display = 'none';
    document.getElementById('reading-view').style.display = 'block';
    const readingBooks = books.filter(book => getReadingStatus(book) === 'reading');
    const container = document.getElementById('reading-page-list');
    container.innerHTML = readingBooks.length
        ? readingBooks.map(book => createShelfBookHtml(book, true)).join('')
        : '<div class="empty-state"><strong>読書中の本はありません</strong><p>本の詳細ページで「読書中」を選ぶと、ここへ追加されます。</p><button onclick="navigateApp(\'library\')">蔵書から探す</button></div>';
    forceScrollTop();
}

function renderHomeDashboard() {
    const counts = {unread: 0, reading: 0, finished: 0};
    books.forEach(book => counts[getReadingStatus(book)]++);
    const favoriteCount = books.filter(book => book.favorite).length;
    document.getElementById('dashboard-stats').innerHTML = `
        <button onclick="openStatusInLibrary('all')"><strong>${books.length}</strong><span>全作品</span></button>
        <button onclick="openStatusInLibrary('unread')"><strong>${counts.unread}</strong><span>未読</span></button>
        <button onclick="navigateApp('reading')"><strong>${counts.reading}</strong><span>読書中</span></button>
        <button onclick="openStatusInLibrary('finished')"><strong>${counts.finished}</strong><span>読了</span></button>
        <button onclick="openFavoritesInLibrary()"><strong>${favoriteCount}</strong><span>お気に入り</span></button>`;

    renderDailyPick();
    const reading = books.filter(book => getReadingStatus(book) === 'reading').slice(0, 4);
    document.getElementById('home-reading-list').innerHTML = reading.length
        ? reading.map(book => createShelfBookHtml(book, false)).join('')
        : '<div class="empty-state small"><p>「読書中」にした本がここに表示されます。</p></div>';
    renderRecentBooks();
}

function isWebBook(book) {
    return book?._sourceMode === 'web' || currentContentMode === 'web';
}

function episodeNumber(value) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) && number >= 0 ? number : 0;
}

function createShelfBookHtml(book, showActions) {
    const mode = book._sourceMode || currentContentMode;
    const episodeText = isWebBook(book) ? `<span class="shelf-episodes">公開 ${episodeNumber(book.published_episodes)}話・保存 ${episodeNumber(book.saved_episodes)}話・読了 ${episodeNumber(book.read_episodes)}話</span>` : '';
    return `<article class="shelf-book clickable-shelf" onclick="openEncodedBookDetail('${mode}','${encodeURIComponent(book.publisher || '')}','${encodeURIComponent(book.title || '')}')">
        <img src="${book.image || 'https://via.placeholder.com/80x110?text=No+Image'}" alt="${escapeHtml(book.title)}" loading="lazy">
        <div><h3>${escapeHtml(book.title)}</h3><p>${escapeHtml(book.author || '作者未登録')}・${escapeHtml(book.publisher || '出版社未登録')}</p>${episodeText}
        ${showActions ? `<div class="shelf-actions">${book.pdf_url ? `<button onclick="event.stopPropagation();openPdf('${book.pdf_url}')">続きを読む</button>` : ''}<button onclick="event.stopPropagation();openEncodedBookDetail('${mode}','${encodeURIComponent(book.publisher || '')}','${encodeURIComponent(book.title || '')}')">詳細</button><button onclick="event.stopPropagation();quickFinishBook('${mode}','${encodeURIComponent(book.publisher || '')}','${encodeURIComponent(book.title || '')}')">読了</button></div>` : ''}</div>
    </article>`;
}

function dailyCandidates() {
    const isUnlocked = localStorage.getItem('r18_unlocked') === 'true';
    const scope = isUnlocked ? (localStorage.getItem('daily_pick_scope') || 'general') : 'general';
    const statusScope = getDailyStatusScope();
    return books.filter(book => {
        const isR18 = book._sourceMode === 'r18' || (book.genre || '').includes('R18');
        const matchesScope = scope === 'r18' ? isR18 : !isR18;
        const readingStatus = getReadingStatus(book);
        const matchesStatus = statusScope === 'all' || (statusScope === 'not-finished' ? readingStatus !== 'finished' : readingStatus === 'unread');
        return matchesScope && matchesStatus && !(book.genre || '').includes('未完') && !(book.genre || '').includes('鬱') && !book.isDepressing;
    });
}

function getDailyPickScope() {
    return localStorage.getItem('r18_unlocked') === 'true' ? (localStorage.getItem('daily_pick_scope') || 'general') : 'general';
}

function setDailyPickScope(scope) {
    if (scope === 'r18' && localStorage.getItem('r18_unlocked') !== 'true') return;
    localStorage.setItem('daily_pick_scope', scope);
    renderDailyPick();
}

function getDailyStatusScope() {
    const scope = localStorage.getItem('daily_status_scope') || 'unread';
    return ['unread', 'not-finished', 'all'].includes(scope) ? scope : 'unread';
}

function setDailyStatusScope(scope) {
    if (!['unread', 'not-finished', 'all'].includes(scope)) return;
    localStorage.setItem('daily_status_scope', scope);
    renderDailyPick();
}

function localDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDailyPick() {
    const candidates = dailyCandidates();
    if (!candidates.length) return null;
    const dateKey = localDateKey();
    const scope = getDailyPickScope();
    const statusScope = getDailyStatusScope();
    const saved = JSON.parse(localStorage.getItem(`daily_pick_${scope}_${statusScope}_${dateKey}`) || 'null');
    const existing = saved && candidates.find(book => bookKey(book) === saved.key);
    if (existing) return existing;
    const seed = [...dateKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const selected = candidates[seed % candidates.length];
    localStorage.setItem(`daily_pick_${scope}_${statusScope}_${dateKey}`, JSON.stringify({key: bookKey(selected)}));
    return selected;
}

function renderDailyPick() {
    const isUnlocked = localStorage.getItem('r18_unlocked') === 'true';
    const scope = getDailyPickScope();
    const scopeControl = document.getElementById('daily-pick-scope');
    if (scopeControl) {
        scopeControl.hidden = !isUnlocked;
        scopeControl.querySelectorAll('[data-daily-scope]').forEach(button => button.classList.toggle('active', button.dataset.dailyScope === scope));
    }
    const statusScope = getDailyStatusScope();
    document.querySelectorAll('#daily-status-scope [data-daily-status]').forEach(button => button.classList.toggle('active', button.dataset.dailyStatus === statusScope));
    const book = getDailyPick();
    const zone = document.getElementById('daily-pick');
    if (!book) {
        zone.innerHTML = `<div class="empty-state small"><p>現在の条件で選べる作品がありません。</p></div>`;
        return;
    }
    const statusText = {unread:'未読のみ', 'not-finished':'読了以外', all:'全作品'}[statusScope];
    zone.innerHTML = `<div class="daily-book"><img src="${book.image || 'https://via.placeholder.com/150x210?text=No+Image'}" alt="${escapeHtml(book.title)}"><div><span class="reading-badge ${getReadingStatus(book)}">${scope === 'r18' ? 'R18' : '一般'}・${statusText}</span><h3>${escapeHtml(book.title)}</h3><p>${escapeHtml(book.author || '')}</p><button class="primary-btn" onclick="openBookDetail(books[${books.indexOf(book)}])">この本を開く</button></div></div>`;
}

function rerollDailyPick() {
    const candidates = dailyCandidates();
    if (!candidates.length) return;
    const dateKey = localDateKey();
    const scope = getDailyPickScope();
    const statusScope = getDailyStatusScope();
    const current = getDailyPick();
    const alternatives = candidates.filter(book => bookKey(book) !== bookKey(current));
    const selected = (alternatives.length ? alternatives : candidates)[Math.floor(Math.random() * (alternatives.length || candidates.length))];
    localStorage.setItem(`daily_pick_${scope}_${statusScope}_${dateKey}`, JSON.stringify({key: bookKey(selected)}));
    renderDailyPick();
}

function recordRecentBook(book) {
    const recent = JSON.parse(localStorage.getItem(recentBooksKey) || '[]');
    const entry = {key: bookKey(book), title: book.title, author: book.author, publisher: book.publisher, image: book.image, mode: book._sourceMode || currentContentMode};
    localStorage.setItem(recentBooksKey, JSON.stringify([entry, ...recent.filter(item => item.key !== entry.key)].slice(0, 12)));
}

function renderRecentBooks() {
    const recent = JSON.parse(localStorage.getItem(recentBooksKey) || '[]');
    document.getElementById('recent-books').innerHTML = recent.length ? recent.map(item => {
        const book = books.find(candidate => candidate._sourceMode === item.mode && candidate.publisher === item.publisher && candidate.title === item.title);
        if (book) return createShelfBookHtml(book, false);
        return `<article class="shelf-book clickable-shelf" onclick="openRecentBook('${item.mode}','${encodeURIComponent(item.publisher || '')}','${encodeURIComponent(item.title || '')}')"><img src="${item.image || 'https://via.placeholder.com/80x110?text=No+Image'}" alt=""><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.author || '作者未登録')}・${escapeHtml(item.publisher || '出版社未登録')}</p></div></article>`;
    }).join('') : '<div class="empty-state small"><p>開いた本がここに並びます。</p></div>';
}

function clearRecentBooks() {
    localStorage.removeItem(recentBooksKey);
    renderRecentBooks();
}

async function openRecentBook(mode, publisher, title) {
    if (!books.some(book => book._sourceMode === mode && book.publisher === decodeURIComponent(publisher) && book.title === decodeURIComponent(title))) {
        currentContentMode = 'all';
        await loadBooksDataByMode();
    }
    openEncodedBookDetail(mode, publisher, title);
}

function openStatusInLibrary(status) {
    readStatusFilter = status;
    document.querySelectorAll('#read-status-filter [data-status]').forEach(button => button.classList.toggle('active', button.dataset.status === status));
    window.location.hash = '#library';
}

function openFavoritesInLibrary() {
    document.getElementById('favorite-only').checked = true;
    window.location.hash = '#library';
}

function filterByField(event, type, encodedValue) {
    event.stopPropagation();
    const value = decodeURIComponent(encodedValue);
    resetAdvancedFilters();
    if (type === 'publisher') selectedPublishers.add(value);
    else document.getElementById('search').value = value;
    filterOptionsSignature = '';
    window.location.hash = '#library';
    setTimeout(applyFilters, 0);
}

function quickFinishBook(mode, publisher, title) {
    const book = books.find(item => item._sourceMode === mode && item.publisher === decodeURIComponent(publisher) && item.title === decodeURIComponent(title));
    if (!book) return;
    book.reading_status = 'finished';
    readingStates[bookKey(book)] = 'finished';
    localStorage.setItem('book_reading_states', JSON.stringify(readingStates));
    showReadingPage();
}

function showAdmin() {
    hideAppPages();
    document.getElementById('app-nav').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('admin-view').style.display = 'block';
    forceScrollTop();
    const webMode = currentContentMode === 'web';
    const volumeFields = document.getElementById('new-volume-fields');
    const episodeFields = document.getElementById('new-episode-fields');
    if (volumeFields) volumeFields.style.display = webMode ? 'none' : 'flex';
    if (episodeFields) episodeFields.style.display = webMode ? 'grid' : 'none';
    
    const adminTitle = document.querySelector('#admin-view h2');
    if (adminTitle) {
        // モード名を辞書形式で管理
        const modeLabels = {
            normal: '📗 通常(ラノベ)用',
            syosetu: '📘 小説用',
            web: '📙 web用',
            r18: '🔞 R18作品用',
            all: '🌐 全件表示'
        };
        
        const modeName = modeLabels[currentContentMode] || '未定義のモード';
        adminTitle.textContent = `⚙️ ローカルデータ管理・エクスポート (${modeName})`;
    }
}

function changeMainView(mode) {
    currentMainView = mode;
    const isList = mode === 'list';
    const isSlide = mode === 'slide';
    const isGrid = mode === 'grid';
    document.getElementById('list-view').style.display = isList ? 'block' : 'none';
    document.getElementById('slide-view').style.display = isSlide ? 'block' : 'none';
    document.getElementById('grid-view').style.display = isGrid ? 'block' : 'none';
    
    const btnList = document.getElementById('btn-list-view');
    const btnSlide = document.getElementById('btn-slide-view');
    const btnGrid = document.getElementById('btn-grid-view');
    if (btnList) btnList.classList.toggle('active', isList);
    if (btnSlide) btnSlide.classList.toggle('active', isSlide);
    if (btnGrid) btnGrid.classList.toggle('active', isGrid);
    
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

function bookKey(book) { return [book.title || '', book.author || '', book.publisher || ''].join('::'); }
function openBookDetail(book) {
    if (['#home','#library','#reading'].includes(window.location.hash)) lastCollectionRoute = window.location.hash;
    const mode = book._sourceMode || currentContentMode;
    window.location.hash = `detail/${encodeURIComponent(mode)}/${encodeURIComponent(book.publisher || '')}/${encodeURIComponent(book.title || '')}`;
}
function openEncodedBookDetail(mode, publisher, title) {
    if (['#home','#library','#reading'].includes(window.location.hash)) lastCollectionRoute = window.location.hash;
    window.location.hash = `detail/${mode}/${publisher}/${title}`;
}
function getReadingStatus(book) {
    const status = readingStates[bookKey(book)] || book.reading_status;
    if (['unread', 'reading', 'finished'].includes(status)) return status;
    return (book.genre || '').includes('読了') ? 'finished' : 'unread';
}
function setReadingStatus(status, book) {
    book.reading_status = status;
    readingStates[bookKey(book)] = status;
    localStorage.setItem('book_reading_states', JSON.stringify(readingStates));
    showDetail(book);
}

function getExportBooks() {
    return books.map(book => ({
        ...book,
        reading_status: getReadingStatus(book)
    }));
}
function splitGenres(value) { return (value || '').split(/[\/／・,、]+/).map(v => v.trim()).filter(Boolean); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function buildDynamicFilterOptions() {
    const signature = books.map(b => `${b.publisher}|${b.genre}`).join('¦');
    if (signature === filterOptionsSignature) return;
    filterOptionsSignature = signature;
    const publishers = [...new Set(books.map(b => b.publisher).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ja'));
    const genres = [...new Set(books.flatMap(b => splitGenres(b.genre)))].sort((a,b) => a.localeCompare(b, 'ja'));
    renderCheckboxOptions('publisher-options', publishers, selectedPublishers, 'publisher-option');
    renderCheckboxOptions('genre-options', genres, selectedGenres, 'genre-option');
}

function renderCheckboxOptions(id, values, selected, className) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = values.map(value => `<label><input class="${className}" type="checkbox" value="${escapeHtml(value)}" ${selected.has(value) ? 'checked' : ''}>${escapeHtml(value)}</label>`).join('');
    container.querySelectorAll('input').forEach(input => input.addEventListener('change', event => {
        event.target.checked ? selected.add(event.target.value) : selected.delete(event.target.value);
        applyFilters();
    }));
}

function applyFilters() {
    const searchInput = document.getElementById('search');
    const sortFilter = document.getElementById('sortFilter');
    if (!searchInput || !sortFilter) return;
    buildDynamicFilterOptions();
    const keywords = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const isEditMode = document.getElementById('editModeToggle')?.checked || false;
    const checked = id => document.getElementById(id)?.checked || false;
    let filtered = books.map((book, originalIndex) => ({book, originalIndex})).filter(({book}) => {
        const genre = book.genre || '';
        const target = [book.title, book.author, book.illustrator, book.publisher, genre, checked('search-summary') ? book.summary : ''].join(' ').toLowerCase();
        if (!keywords.every(k => target.includes(k))) return false;
        if (selectedPublishers.size && !selectedPublishers.has(book.publisher)) return false;
        if (selectedGenres.size) {
            const matches = [...selectedGenres].map(value => genre.includes(value));
            if (genreLogic === 'and' ? !matches.every(Boolean) : !matches.some(Boolean)) return false;
        }
        if (checked('exclude-depress') && (book.isDepressing || genre.includes('鬱'))) return false;
        if (checked('exclude-short') && (genre.includes('短編') || genre.includes('読切'))) return false;
        if (checked('exclude-unfinished') && genre.includes('未完')) return false;
        if (readStatusFilter !== 'all' && getReadingStatus(book) !== readStatusFilter) return false;
        if (checked('favorite-only') && !book.favorite) return false;
        if (checked('pdf-only') && !book.pdf_url) return false;
        if (checked('info-only') && !book.info_url) return false;
        if (checked('complete-only') && (!book.total || (book.owned || []).length < book.total)) return false;
        return true;
    });
    const progress = b => (b.owned || []).length / (b.total || 1);
    const sort = sortFilter.value;
    if (!isEditMode && sort === 'favorite') filtered.sort((a,b) => Number(b.book.favorite) - Number(a.book.favorite));
    if (!isEditMode && sort === 'title') filtered.sort((a,b) => (a.book.title || '').localeCompare(b.book.title || '', 'ja'));
    if (!isEditMode && sort === 'author') filtered.sort((a,b) => (a.book.author || '').localeCompare(b.book.author || '', 'ja'));
    if (!isEditMode && sort === 'progress') filtered.sort((a,b) => progress(b.book) - progress(a.book));
    if (!isEditMode && sort === 'progress-asc') filtered.sort((a,b) => progress(a.book) - progress(b.book));
    if (!isEditMode && sort === 'volumes') filtered.sort((a,b) => (b.book.total || 0) - (a.book.total || 0));
    updateActiveFilterChips();
    if (currentMainView === 'list') renderBooks(filtered, isEditMode);
    else if (currentMainView === 'slide') renderNetflixView(filtered.map(item => item.book));
    else renderGridView(filtered.map(item => item.book));
}

function renderBooks(list, isEditMode) {
    const container = document.getElementById('book-list');
    container.innerHTML = '';
    const canEdit = (currentContentMode !== 'all') && isEditMode;

    list.forEach((item) => {
        const book = item.book;
        const originalIndex = item.originalIndex;
        const owned = book.owned ? book.owned.length : 0;
        const total = book.total || 1;
        const percent = Math.round((owned / total) * 100);
        const webBook = isWebBook(book);
        const publishedEpisodes = episodeNumber(book.published_episodes);
        const savedEpisodes = episodeNumber(book.saved_episodes);
        const readEpisodes = episodeNumber(book.read_episodes);
        
        const illustText = book.illustrator ? ` / 絵: ${book.illustrator}` : '';
        const webLinkHtml = book.info_url ? `<span style="margin-left:8px; color:#4f46e5; font-size:12px;">🔗Web</span>` : '';
        const readingStatus = getReadingStatus(book);
        const statusLabel = {unread:'未読', reading:'読書中', finished:'読了'}[readingStatus];

        const card = document.createElement('div');
        card.className = 'book-card';
        
// 修正: 編集モードかつ、allモードではない時のみ有効化
        if (isEditMode && currentContentMode !== 'all') {
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

        const clickAction = isEditMode ? "" : `onclick="openBookDetail(books[${originalIndex}])"`;

        const starHtml = `
            <div class="fav-star-container" ${canEdit ? `onclick="toggleFavoriteInline(event, ${originalIndex})"` : ''} style="cursor:${canEdit ? 'pointer' : 'default'}; font-size:20px;">
                ${book.favorite ? '⭐' : (canEdit ? '☆' : '')}
            </div>`;

        const progressHtml = webBook
            ? `<div class="episode-summary">
                <span><strong>${publishedEpisodes}</strong> 公開</span>
                <span><strong>${savedEpisodes}</strong> 保存</span>
                <span><strong>${readEpisodes}</strong> 読了</span>
               </div>`
            : canEdit
            ? `<div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                <button class="vol-btn" onclick="changeOwnedVolume(event, ${originalIndex}, -1)">-</button>
                <span class="vol-text" style="font-size:12px; font-weight:bold; color:#222;">所持: ${owned} / 総: ${total}巻</span>
                <button class="vol-btn" onclick="changeOwnedVolume(event, ${originalIndex}, 1)">+</button>
            </div>`
            : `<div class="progress-container" style="width: 100%;">
                <div class="progress-text vol-text">${owned}/${total}巻 (${percent}%)</div>
                <div class="progress" style="width: 100%; background:#e5e7eb; height:8px; border-radius:4px; overflow:hidden;">
                    <div class="bar" style="width:${percent}%; background:#4f46e5; height:100%;"></div>
                </div>
            </div>`;

        const mobileOrderControls = canEdit 
            ? `<div class="edit-controls-right" onclick="event.stopPropagation();">
                <button class="order-btn" onclick="moveOrderInline(${originalIndex}, -1)">▲</button>
                <button class="order-btn" onclick="moveOrderInline(${originalIndex}, 1)">▼</button>
               </div>`
            : '';

        card.innerHTML = `
            <div class="card-content" ${clickAction}>
                ${starHtml}
                <div style="flex:1; display:flex; min-width:0;">
                    <img src="${book.image || 'https://via.placeholder.com/80x110?text=No+Image'}" class="book-cover" loading="lazy" decoding="async">
                    <div class="book-info" style="flex:1; min-width:0; padding-left:10px;">
                        <div class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}${webLinkHtml}</div>
                        <div class="meta clickable-meta" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            <button type="button" onclick="filterByField(event,'publisher','${encodeURIComponent(book.publisher || '')}')">${escapeHtml(book.publisher || '出版社未登録')}</button>
                            <span> / </span>
                            <button type="button" onclick="filterByField(event,'author','${encodeURIComponent(book.author || '')}')">${escapeHtml(book.author || '作者未登録')}</button>${illustText}
                        </div>
                        <div class="tag">${book.genre}</div>
                        <span class="reading-badge ${readingStatus}">${statusLabel}</span>
                        ${progressHtml}
                    </div>
                </div>
                ${mobileOrderControls}
            </div>`;
        container.appendChild(card);
    });
    updateSummary(list.map(item => item.book));
}

function renderGridView(list) {
    const container = document.getElementById('book-grid');
    if (!container) return;
    if (!list.length) {
        container.innerHTML = '<p class="empty-state">該当する作品がありません。</p>';
        updateSummary([]);
        return;
    }
    container.innerHTML = list.map(book => {
        const status = getReadingStatus(book);
        return `<article class="grid-book" onclick="openEncodedBookDetail('${book._sourceMode || currentContentMode}','${encodeURIComponent(book.publisher || '')}','${encodeURIComponent(book.title || '')}')">
            <div class="grid-cover-wrap">
                <img src="${book.image || 'https://via.placeholder.com/180x250?text=No+Image'}" alt="${escapeHtml(book.title)}" loading="lazy" decoding="async">
                <span class="reading-badge ${status}">${{unread:'未読',reading:'読書中',finished:'読了'}[status]}</span>
                ${book.favorite ? '<span class="grid-favorite">⭐</span>' : ''}
            </div>
            <h3>${escapeHtml(book.title)}</h3>
            <p>${escapeHtml(book.author || '作者未登録')}</p>
        </article>`;
    }).join('');
    updateSummary(list);
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
    
    // モード別の主要表示ジャンルの定義
    let targetGenres = ["青春", "ファンタジー", "ミステリー", "日常", "ライトノベル", "ネット", "鬱"];
    if (currentContentMode === 'syosetu') targetGenres = ["推理", "サスペンス", "青春", "歴史", "SF", "文学", "小説","少年漫画", "青年漫画", "ファンタジー", "日常", "コメディ", "漫画", "鬱"];
    if (currentContentMode === 'web') targetGenres = ["青春", "ファンタジー", "ミステリー", "日常", "ライトノベル", "ネット", "鬱"];
    if (currentContentMode === 'r18') targetGenres = ["R18", "漫画", "小説", "ファンタジー", "恋愛", "日常", "鬱"];
        
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
                    <div class="mini-card" onclick="openEncodedBookDetail('${b._sourceMode || currentContentMode}','${encodeURIComponent(b.publisher || '')}','${encodeURIComponent(b.title || '')}')">
                        <img src="${b.image || 'https://via.placeholder.com/100x140?text=No+Image'}" loading="lazy">
                        <div class="mini-title">${b.title}</div>
                    </div>
                `).join('')}
            </div>`;
        container.appendChild(row);
    });
}

function showDetail(book) {
    hideAppPages();
    document.getElementById('app-nav').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('detail-view').style.display = 'block';
    recordRecentBook(book);
    const triggerBtn = document.getElementById('btn-trigger-search');
    if (triggerBtn) {
        triggerBtn.style.display = 'none';
    }

    const ownedCount = book.owned ? book.owned.length : 0;
    const totalCount = book.total || 1;
    const percent = Math.round((ownedCount / totalCount) * 100);
    const readingStatus = getReadingStatus(book);
    const webBook = isWebBook(book);
    const publishedEpisodes = episodeNumber(book.published_episodes);
    const savedEpisodes = episodeNumber(book.saved_episodes);
    const readEpisodes = episodeNumber(book.read_episodes);
    const episodePercent = publishedEpisodes ? Math.min(100, Math.round((readEpisodes / publishedEpisodes) * 100)) : 0;
    const detailProgressHtml = webBook
        ? `<div class="detail-progress episode-detail">
            <h3>話数管理</h3>
            <div class="episode-stats">
                <div><strong>${publishedEpisodes}</strong><span>公開話数</span></div>
                <div><strong>${savedEpisodes}</strong><span>保存話数</span></div>
                <div><strong>${readEpisodes}</strong><span>読了話数</span></div>
            </div>
            <div class="progress"><div class="bar" style="width:${episodePercent}%"></div></div>
            <p class="episode-progress-label">公開分の ${episodePercent}% を読了</p>
          </div>`
        : `<div class="detail-progress">
            <p class="meta"><strong>所持状況:</strong> ${ownedCount} / ${totalCount}巻 (${percent}%)</p>
            <div class="progress"><div class="bar" style="width:${percent}%"></div></div>
            <p style="font-size:12px; color:#666; margin-top:10px;">既刊: ${book.owned ? book.owned.join(', ') : ''}</p>
          </div>`;

    const infoLinkHtml = book.info_url 
        ? `<p class="meta"><strong>作品URL:</strong> <a href="${book.info_url}" target="_blank" style="color: #4f46e5; text-decoration: underline;">作品ページを開く</a></p>` 
        : '';
    const pdfButtonHtml = book.pdf_url 
        ? `<button class="read-btn" onclick="openPdf('${book.pdf_url}')" style="background:#4f46e5; color:white; border:none; padding:15px; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:15px; width:100%; font-size:16px;">📖 本を読む</button>` 
        : '';

    // 追加: allモードでなければ編集ボタンのHTMLを生成
    const originalIndex = books.findIndex(b => b.title === book.title && b.publisher === book.publisher);

    // 2. allモードでなければボタンHTMLを生成
    let editButtonHtml = '';
    if (currentContentMode !== 'all') {
        editButtonHtml = `
            <button onclick="openInlineEditForm(${originalIndex})" style="background:#0f172a; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:15px; width:100%;">
                🛠️ この本の内容を直接編集する
            </button>`;
    }

    document.getElementById('detail-content').innerHTML = `
        <div class="detail-container" id="detail-view-main-card">
            <img src="${book.image || 'https://via.placeholder.com/240x340?text=No+Image'}" class="detail-cover">
            <div class="detail-info">
                <h2 class="detail-title" style="display:flex; align-items:center; gap:10px;">
                    <span id="detail-fav-star" style="cursor:pointer;" onclick="toggleFavoriteInline(event, ${originalIndex}, true)">${book.favorite ? '⭐' : '☆'}</span>
                    ${book.title}
                </h2>
                <div class="meta-info">
                    <p class="meta"><strong>著者:</strong> <button class="detail-filter-link" onclick="filterByField(event,'author','${encodeURIComponent(book.author || '')}')">${escapeHtml(book.author || '未登録')}</button></p>
                    ${book.illustrator ? `<p class="meta"><strong>イラスト:</strong> ${book.illustrator}</p>` : ''}
                    <p class="meta"><strong>出版社・レーベル:</strong> <button class="detail-filter-link" onclick="filterByField(event,'publisher','${encodeURIComponent(book.publisher || '')}')">${escapeHtml(book.publisher || '未登録')}</button></p>
                    <p class="meta"><strong>ジャンル:</strong> ${book.genre}</p>
                    ${infoLinkHtml}
                </div>
                <div class="summary-section">
                    <h3>あらすじ</h3>
                    <p class="summary-text">${book.summary || 'あらすじ情報は未登録です。'}</p>
                </div>
                ${detailProgressHtml}
                <div class="reading-status-card">
                    <strong>読書状態</strong>
                    <div class="segmented" role="group" aria-label="この本の読書状態">
                        <button type="button" class="${readingStatus === 'unread' ? 'active' : ''}" onclick="setReadingStatus('unread', books[${originalIndex}])">未読</button>
                        <button type="button" class="${readingStatus === 'reading' ? 'active' : ''}" onclick="setReadingStatus('reading', books[${originalIndex}])">読書中</button>
                        <button type="button" class="${readingStatus === 'finished' ? 'active' : ''}" onclick="setReadingStatus('finished', books[${originalIndex}])">読了</button>
                    </div>
                    <small>変更した状態はJSON出力にも反映されます。</small>
                </div>
                ${pdfButtonHtml}
                ${editButtonHtml}
            </div>
        </div>
        <section id="related-editions" class="related-editions" aria-live="polite"></section>
        <div id="inline-edit-form-zone"></div>`;
    renderRelatedEditions(book);
    forceScrollTop();
}

function normalizeWorkTitle(value) {
    return (value || '').normalize('NFKC')
        .replace(/【[^】]*(?:発売|書籍|WEB|Web|web)[^】]*】/g, '')
        .replace(/[「」『』\s　・･,、。！？!?～〜~―—‐-]/g, '')
        .toLowerCase();
}

async function renderRelatedEditions(currentBook) {
    const zone = document.getElementById('related-editions');
    if (!zone) return;
    try {
        const files = ['books-normal.json', 'books-syosetu.json', 'books-web.json'];
        if (localStorage.getItem('r18_unlocked') === 'true') files.push('books-r18.json');
        const groups = await Promise.all(files.map(file => fetch(file).then(r => r.ok ? r.json() : [])));
        const normalizedTitle = normalizeWorkTitle(currentBook.title);
        const catalog = groups.flatMap((list, index) => list.map(book => tagBookSource(book, modeFromFile(files[index]))));
        const related = catalog.filter(book =>
            book._sourceMode !== currentBook._sourceMode &&
            (book.author || '') === (currentBook.author || '') &&
            normalizeWorkTitle(book.title) === normalizedTitle
        );
        if (!related.length || !document.body.contains(zone)) return;
        zone.innerHTML = `<h3>同じ作品の別バージョン</h3><p>Web版・書籍版などを切り替えられます。</p><div class="related-edition-list">${related.map(book => `<button type="button" onclick="openRelatedEdition('${book._sourceMode}','${encodeURIComponent(book.publisher)}','${encodeURIComponent(book.title)}')"><strong>${escapeHtml(book.publisher || '版違い')}（${{normal:'通常',syosetu:'小説',web:'Web',r18:'R18'}[book._sourceMode] || '別版'}）</strong><span>${escapeHtml(book.title)}</span></button>`).join('')}</div>`;
    } catch (error) {
        zone.innerHTML = '';
    }
}

async function openRelatedEdition(mode, publisher, title) {
    if (currentContentMode !== mode) {
        currentContentMode = mode;
        await loadBooksDataByMode();
    }
    window.location.hash = `detail/${mode}/${publisher}/${title}`;
}


function openInlineEditForm(index) {
    const book = books[index];
    const zone = document.getElementById('inline-edit-form-zone');
    const currentReadingStatus = getReadingStatus(book);
    const webBook = isWebBook(book);
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
            ${webBook ? `<div class="episode-edit-grid">
                <div><label>公開話数</label><input type="number" id="edit-published-episodes" min="0" value="${episodeNumber(book.published_episodes)}"></div>
                <div><label>保存話数</label><input type="number" id="edit-saved-episodes" min="0" value="${episodeNumber(book.saved_episodes)}"></div>
                <div><label>読了話数</label><input type="number" id="edit-read-episodes" min="0" value="${episodeNumber(book.read_episodes)}"></div>
            </div>` : `<div>
                <label>既刊・所持巻数 (カンマ区切り)</label>
                <input type="text" id="edit-owned" value="${book.owned ? book.owned.join(', ') : '1'}">
            </div>
            <div>
                <label>総巻数</label>
                <input type="number" id="edit-total" value="${book.total || 1}">
            </div>`}
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
                <label>読書状態
                    <select id="edit-reading-status">
                        <option value="unread" ${currentReadingStatus === 'unread' ? 'selected' : ''}>未読</option>
                        <option value="reading" ${currentReadingStatus === 'reading' ? 'selected' : ''}>読書中</option>
                        <option value="finished" ${currentReadingStatus === 'finished' ? 'selected' : ''}>読了</option>
                    </select>
                </label>
            </div>

            <div class="edit-form-btns">
                <button onclick="saveInlineEdit(${index})" style="flex:1; background:#10b981; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">💾 編集を完了してJSONを取得</button>
                <button onclick="document.getElementById('inline-edit-form-zone').innerHTML=''" style="background:#ef4444; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">キャンセル</button>
            </div>
        </div>`;
    
    zone.scrollIntoView({ behavior: 'smooth' });
}

function saveInlineEdit(index) {
    if (currentContentMode === 'all') {
        alert("🌐 全件表示モードでは編集できません。");
        return;
    }
    const title = document.getElementById('edit-title').value.trim();
    if (!title) {
        alert('タイトルは空にできません。');
        return;
    }

    const webBook = isWebBook(books[index]);
    const ownedInput = webBook ? '' : document.getElementById('edit-owned').value.trim();
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
    if (webBook) {
        books[index].published_episodes = episodeNumber(document.getElementById('edit-published-episodes').value);
        books[index].saved_episodes = episodeNumber(document.getElementById('edit-saved-episodes').value);
        books[index].read_episodes = episodeNumber(document.getElementById('edit-read-episodes').value);
    } else {
        books[index].owned = ownedArray;
        books[index].total = parseInt(document.getElementById('edit-total').value, 10) || 1;
    }
    books[index].image = document.getElementById('edit-image').value.trim();
    books[index].summary = document.getElementById('edit-summary').value.trim();
    books[index].pdf_url = document.getElementById('edit-pdf').value.trim();
    books[index].info_url = document.getElementById('edit-info').value.trim();
    books[index].isDepressing = document.getElementById('edit-depress').checked;
    const readingStatus = document.getElementById('edit-reading-status').value;
    books[index].reading_status = readingStatus;
    readingStates[bookKey(books[index])] = readingStatus;
    localStorage.setItem('book_reading_states', JSON.stringify(readingStates));

    saveToLocalStorage();
    applyFilters();
    
    const currentFileName = getJsonFileNameByMode();
    const jsonString = JSON.stringify(getExportBooks(), null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
        alert(`✅ 変更を保存しました！\n\n最新のデータをクリップボードにコピーしました。\n「${currentFileName}」にそのままペーストして上書きしてください！`);
    }).catch(err => {
        alert('変更はローカルに保存されました。');
    });

    showDetail(books[index]);
}

// ⚡ ダウンロードされるファイル名が現在のモードに応じて自動で変わる
function downloadJsonFile() {
    const jsonString = JSON.stringify(getExportBooks(), null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const currentFileName = getJsonFileNameByMode();
    
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFileName; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function openPdf(url) {
    if (url.toLowerCase().endsWith('.txt')) {
        window.open(`viewer.html?file=${encodeURIComponent(url)}`, '_blank');
    } else {
        window.open(url, '_blank');
    }
}

function updateSummary(list) {
    const summary = document.getElementById('summary');
    if (!summary) return;
    if (currentContentMode === 'web') {
        const savedEpisodes = list.reduce((sum, book) => sum + episodeNumber(book.saved_episodes), 0);
        summary.textContent = `全 ${list.length} 作品 / 保存済み 合計 ${savedEpisodes} 話`;
        return;
    }
    const total = list.reduce((sum, book) => sum + (book.owned ? book.owned.length : 0), 0);
    summary.textContent = `全 ${list.length} 作品 / 合計 ${total} 冊`;
}

function goBack() { window.location.hash = lastCollectionRoute || '#library'; }

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
    if (currentContentMode === 'all') {
        alert("🌐 全件表示モードでは新規追加できません。\n追加したいカテゴリモード（通常、小説、漫画、R18のいずれか）に切り替えてから追加してください。");
        return;
    }
    const webMode = currentContentMode === 'web';
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

    let ownedArray = webMode ? [] : [1];
    if (!webMode && ownedInput !== "") {
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
        total: webMode ? 1 : (parseInt(totalInput, 10) || 1),
        summary: summary,
        image: image, 
        favorite: favorite,
        isDepressing: isDepressing,
        pdf_url: pdf_url,
        info_url: info_url
    };

    if (webMode) {
        newBook.published_episodes = episodeNumber(document.getElementById('new-published-episodes').value);
        newBook.saved_episodes = episodeNumber(document.getElementById('new-saved-episodes').value);
        newBook.read_episodes = episodeNumber(document.getElementById('new-read-episodes').value);
    }

    books.push(newBook);
    saveToLocalStorage();
    
    const currentFileName = getJsonFileNameByMode();
    let displayModeName = "通常(ラノベ)";
    if(currentContentMode === 'syosetu') displayModeName = "小説・漫画";
    if(currentContentMode === 'web') displayModeName = "web";
    if(currentContentMode === 'r18') displayModeName = "R18";
    
    alert(`「${title}」を 【${displayModeName}】 リストに追加しました！\n反映するには、管理画面から「${currentFileName}」を書き出して上書き保存してください。`);
    
    document.getElementById('add-book-form').reset();
    applyFilters();
    window.location.hash = ''; 
}

function copyJsonToClipboard() {
    const jsonString = JSON.stringify(getExportBooks(), null, 2);
    const currentFileName = getJsonFileNameByMode();
    navigator.clipboard.writeText(jsonString).then(() => {
        alert(`最新のJSONデータをコピーしました！\n「${currentFileName}」にそのまま貼り付けて保存してください。`);
    }).catch(err => {
        alert('コピーに失敗しました。');
    });
}

function saveToLocalStorage() {
    const storageKey = `local_books_data_${currentContentMode}`;
    localStorage.setItem(storageKey, JSON.stringify(books));
}

function clearLocalChanges() {
    const currentFileName = getJsonFileNameByMode();
    if (confirm(`現在のローカル変更をリセットし、サーバーの「${currentFileName}」を再読込しますか？`)) {
        const storageKey = `local_books_data_${currentContentMode}`;
        localStorage.removeItem(storageKey);
        location.reload();
    }
}

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);
['exclude-depress','exclude-short','exclude-unfinished','favorite-only','pdf-only','info-only','complete-only','search-summary']
    .forEach(id => document.getElementById(id)?.addEventListener('change', applyFilters));

document.querySelectorAll('[data-genre-logic]').forEach(button => button.addEventListener('click', () => {
    genreLogic = button.dataset.genreLogic;
    document.querySelectorAll('[data-genre-logic]').forEach(item => item.classList.toggle('active', item === button));
    applyFilters();
}));

document.querySelectorAll('#read-status-filter [data-status]').forEach(button => button.addEventListener('click', () => {
    readStatusFilter = button.dataset.status;
    document.querySelectorAll('#read-status-filter [data-status]').forEach(item => item.classList.toggle('active', item === button));
    applyFilters();
}));

function toggleAdvancedFilters() {
    const panel = document.getElementById('advanced-filters');
    const button = document.getElementById('advanced-toggle');
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    button.classList.toggle('open', !panel.hidden);
}

function clearSearchKeyword() {
    document.getElementById('search').value = '';
    document.getElementById('search').focus();
    applyFilters();
}

function resetAdvancedFilters() {
    selectedPublishers.clear();
    selectedGenres.clear();
    document.querySelectorAll('#advanced-filters input[type="checkbox"]').forEach(input => input.checked = false);
    document.getElementById('sortFilter').value = 'default';
    genreLogic = 'or';
    readStatusFilter = 'all';
    document.querySelectorAll('[data-genre-logic]').forEach(button => button.classList.toggle('active', button.dataset.genreLogic === 'or'));
    document.querySelectorAll('#read-status-filter [data-status]').forEach(button => button.classList.toggle('active', button.dataset.status === 'all'));
    applyFilters();
}

function updateActiveFilterChips() {
    const zone = document.getElementById('active-filter-chips');
    if (!zone) return;
    const chips = [];
    selectedPublishers.forEach(value => chips.push(`<button onclick="removeFilterChip('publisher','${encodeURIComponent(value)}')">出版社: ${escapeHtml(value)} ×</button>`));
    selectedGenres.forEach(value => chips.push(`<button onclick="removeFilterChip('genre','${encodeURIComponent(value)}')">${escapeHtml(value)} ×</button>`));
    const labels = {'exclude-depress':'鬱を除外','exclude-short':'短編を除外','exclude-unfinished':'未完を除外','favorite-only':'お気に入り','pdf-only':'本文あり','info-only':'作品URLあり','complete-only':'全巻所持'};
    Object.entries(labels).forEach(([id,label]) => { if (document.getElementById(id)?.checked) chips.push(`<button onclick="removeFilterChip('checkbox','${id}')">${label} ×</button>`); });
    if (readStatusFilter !== 'all') chips.push(`<button onclick="removeFilterChip('status','all')">${{unread:'未読',reading:'読書中',finished:'読了'}[readStatusFilter]} ×</button>`);
    zone.innerHTML = chips.join('');
}

function removeFilterChip(type, value) {
    if (type === 'publisher') selectedPublishers.delete(decodeURIComponent(value));
    if (type === 'genre') selectedGenres.delete(decodeURIComponent(value));
    if (type === 'checkbox') document.getElementById(value).checked = false;
    if (type === 'status') readStatusFilter = 'all';
    filterOptionsSignature = '';
    applyFilters();
}

// スマートヘッダーロジック
let lastScrollY = window.scrollY;
window.removeEventListener('scroll', handleSmartHeader);
window.addEventListener('scroll', handleSmartHeader);

function handleSmartHeader() {
    const header = document.getElementById('main-header');
    if (!header) return;
    if (header.style.display === 'none') return;

    const currentScrollY = window.scrollY;

    if (currentScrollY < 50) {
        header.classList.remove('scroll-hide');
    } else if (currentScrollY > lastScrollY && currentScrollY > 120) {
        header.classList.add('scroll-hide');
    } else if (currentScrollY < lastScrollY) {
        header.classList.remove('scroll-hide');
    }
    lastScrollY = currentScrollY;
}

function toggleHeaderPanel() {
    const header = document.getElementById('main-header');
    const triggerBtn = document.getElementById('btn-trigger-search');
    if (!header || !triggerBtn) return;

    const isHidden = header.classList.toggle('panel-hide');
    triggerBtn.style.display = isHidden ? 'flex' : 'none';
}

// 検索窓でのパスワード入力チェック (Enterキーイベントを追加)
document.getElementById('search').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const password = "yuuki0721"; // ← ここにパスワードを設定
        if (this.value === password) {
            this.value = ""; 
            unlockR18();
        }
    }
});

// ログイン(解放)した時の関数
function unlockR18() {
    const r18Tab = document.getElementById('tab-mode-r18');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (r18Tab) r18Tab.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    
    localStorage.setItem('r18_unlocked', 'true');
    alert('🔞 R18モードを解放しました');
    
    // ★追加：データが現在allモードなら、R18データを含めて再読み込みして即時反映させる
    if (currentContentMode === 'all') {
        loadBooksDataByMode();
    }
}

// ログアウトした時の関数
function logoutR18() {
    const r18Tab = document.getElementById('tab-mode-r18');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (r18Tab) r18Tab.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    
    localStorage.removeItem('r18_unlocked');
    localStorage.setItem('daily_pick_scope', 'general');
    
    // ★追加：ログアウト時は強制リロードすることで、メモリ上のR18データを完全に消去する
    location.reload(); 
    
    alert('ログアウトしました');
}

// ページ読み込み時に状態を復元
window.addEventListener('DOMContentLoaded', () => {
    const r18Tab = document.getElementById('tab-mode-r18');
    const logoutBtn = document.getElementById('logout-btn');
    
    // ロード時にログイン状態をチェックし、非表示処理も確実に行う
    const isUnlocked = localStorage.getItem('r18_unlocked') === 'true';
    if (r18Tab) r18Tab.style.display = isUnlocked ? 'block' : 'none';
    if (logoutBtn) logoutBtn.style.display = isUnlocked ? 'inline-block' : 'none';
});
