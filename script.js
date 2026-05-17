let books = [];
let currentMainView = 'list'; // 'list' または 'slide'
let savedScrollPosition = 0;   // 戻るボタン用のスクロール位置保持変数

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
        // 詳細を開く前に現在のスクロール位置を記憶（既に詳細や管理を開いている場合は上書きしない）
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
        // 管理画面を開く前に現在のスクロール位置を記憶
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

    // 一覧に戻った後、元のスクロール位置をミリ秒のズレを挟んで復元
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
    
    // 画面を開いた際、localStorageに保存されたトークン・リポジトリ情報があれば自動でセット
    if (localStorage.getItem('gh_token')) document.getElementById('ghToken').value = localStorage.getItem('gh_token');
    if (localStorage.getItem('gh_repo')) document.getElementById('ghRepo').value = localStorage.getItem('gh_repo');
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
    const depressToggle = document.getElementById('depressToggle'); // 鬱展開トグル

    if (!searchInput || !pubFilter || !genFilter || !sortFilter) return;

    const keyword = searchInput.value.toLowerCase();
    const publisher = pubFilter.value;
    const genre = genFilter.value;
    const sort = sortFilter.value;
    
    const isSafeMode = r18Toggle ? !r18Toggle.checked : false;
    const safeStatusLabel = document.getElementById('safe-status');
    if (safeStatusLabel) safeStatusLabel.textContent = isSafeMode ? "ON" : "OFF";

    const hideDepressing = depressToggle ? depressToggle.checked : false; // 鬱トグルの状態（trueなら隠す）

    let filtered = books.filter(book => {
        // R18セーフモードフィルター
        const isR18 = book.genre && book.genre.includes('R18');
        if (isSafeMode && isR18) return false;

        // 鬱展開フィルター（プロパティが存在するか、もしくはジャンル文字列に「鬱」があるか）
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

// 一覧画面の描画
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

// スライド画面の描画（「鬱」ターゲットジャンルを追加）
function renderNetflixView(list) {
    const container = document.getElementById('genre-rows-container');
    container.innerHTML = '';
    const targetGenres = ["青春", "ファンタジー", "ミステリー", "ラブコメ", "日常", "ライトノベル", "漫画", "小説", "ネット", "R18", "鬱"];
    const genreMap = {};
    
    list.forEach(book => {
        // 通常のジャンル切り出しに加えて、isDepressingプロパティがあれば「鬱」ジャンルにも配属させる
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

// ★新規追加：GitHub APIを利用して books.json に新規書籍データをオンラインコミットする関数
async function addNewBookOnline() {
    const token = document.getElementById('ghToken').value.trim();
    const repo = document.getElementById('ghRepo').value.trim(); // "ユーザー名/リポジトリ名"
    
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

    if (!token || !repo || !title) {
        alert('GitHub接続設定（トークン・リポジトリ）と作品タイトルは必須入力項目です。');
        return;
    }

    // 次回入力の手間を省くため、接続情報をローカルストレージへ保存
    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_repo', repo);

    // 所持巻数の文字列入力を数値の配列 [1, 2, 3] に変換
    let ownedArray = [1];
    if (ownedInput !== "") {
        ownedArray = ownedInput.split(',').map(item => {
            const num = parseFloat(item.trim());
            return isNaN(num) ? item.trim() : num;
        });
    }

    // JSONスキーマに沿った新しい本オブジェクトを組み立て
    const newBook = {
        title: title,
        author: author,
        illustrator: illustrator,
        publisher: publisher,
        genre: genre,
        owned: ownedArray,
        total: parseInt(totalInput, 10) || 1,
        summary: summary,
        image: "", // 新設時は空文字
        favorite: favorite,
        isDepressing: isDepressing,
        pdf_url: pdf_url,
        info_url: info_url
    };

    // 既存のローカル配列の末尾に結合し、整形されたJSON文字列を生成
    const updatedBooks = [...books, newBook];
    const jsonString = JSON.stringify(updatedBooks, null, 2);

    try {
        const fileUrl = `https://api.github.com/repos/${repo}/contents/books.json`;
        
        // 1. GitHub API から既存の books.json の SHA（バージョンファイル識別子）を取得
        const resGet = await fetch(fileUrl, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (!resGet.ok) throw new Error('books.json の取得に失敗しました。リポジトリパスまたはトークンを確認してください。');
        const fileData = await resGet.json();
        const sha = fileData.sha;

        // 2. 新しいJSON文字列をUTF-8を維持しながらBase64にエンコードしてPUT（コミット）送信
        const utf8Bytes = new TextEncoder().encode(jsonString);
        const base64Content = btoa(String.fromCharCode(...utf8Bytes));

        const resPut = await fetch(fileUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Add new book: "${title}" via Web Admin`,
                content: base64Content,
                sha: sha
            })
        });

        if (resPut.ok) {
            alert(`「${title}」をGitHubに直接保存しました！\nPagesへの反映（数分）を待たずに、現在の画面上にも即時追加反映されます。`);
            books = updatedBooks; // メモリ上のデータを更新
            document.getElementById('add-book-form').reset();
            applyFilters();
            window.location.hash = ''; // 一覧画面に自動で戻る
        } else {
            const errLog = await resPut.json();
            alert('GitHub書き込みエラー: ' + errLog.message);
        }
    } catch (err) {
        alert('エラーが発生しました: ' + err.message);
    }
}

// 各種イベントリスナーの設定
document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('publisherFilter').addEventListener('change', applyFilters);
document.getElementById('genreFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);

const r18Toggle = document.getElementById('r18Toggle');
if (r18Toggle) r18Toggle.addEventListener('change', applyFilters);

const depressToggle = document.getElementById('depressToggle');
if (depressToggle) depressToggle.addEventListener('change', applyFilters);