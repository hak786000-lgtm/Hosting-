interface HostedSite {
    id: number;
    name: string;
    url: string;
    date: string;
}

// 1. Encode HTML for URL
function encodeHtmlToUrl(html: string): string {
    const bytes = new TextEncoder().encode(html);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 2. Decode and Render Hosted Site if URL contains ?site=
function checkAndRenderHostedSite(): boolean {
    const params = new URLSearchParams(window.location.search);
    const siteData = params.get('site');
    if (siteData) {
        try {
            let base64 = siteData.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) base64 += '=';
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const rawHtml = new TextDecoder().decode(bytes);
            document.open();
            document.write(rawHtml);
            document.close();
            return true;
        } catch (err) {
            console.error('Rendering error:', err);
        }
    }
    return false;
}

// Shorten URL fallback
async function tryShortenUrl(longUrl: string): Promise<string> {
    try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        if (res.ok) {
            const shortUrl = await res.text();
            if (shortUrl.startsWith('http')) return shortUrl.trim();
        }
    } catch {}
    return longUrl;
}

// Initialize App Dashboard if not rendering a hosted site
if (!checkAndRenderHostedSite()) {
    let uploadedFileContent = '';

    const viewUpload = document.getElementById('viewUpload') as HTMLElement;
    const viewData = document.getElementById('viewData') as HTMLElement;
    const viewAbout = document.getElementById('viewAbout') as HTMLElement;
    const navUploadBtn = document.getElementById('navUploadBtn') as HTMLButtonElement;
    const navDataBtn = document.getElementById('navDataBtn') as HTMLButtonElement;
    const navAboutBtn = document.getElementById('navAboutBtn') as HTMLButtonElement;

    function switchView(viewName: 'upload' | 'data' | 'about') {
        viewUpload.classList.add('hidden');
        viewData.classList.add('hidden');
        viewAbout.classList.add('hidden');

        navUploadBtn.className = 'flex flex-col items-center justify-center py-1 text-slate-400 transition';
        navDataBtn.className = 'flex flex-col items-center justify-center py-1 text-slate-400 transition';
        navAboutBtn.className = 'flex flex-col items-center justify-center py-1 text-slate-400 transition';

        if (viewName === 'upload') {
            viewUpload.classList.remove('hidden');
            navUploadBtn.className = 'flex flex-col items-center justify-center py-1 text-blue-400 transition';
        } else if (viewName === 'data') {
            viewData.classList.remove('hidden');
            navDataBtn.className = 'flex flex-col items-center justify-center py-1 text-blue-400 transition';
            renderHistory();
        } else if (viewName === 'about') {
            viewAbout.classList.remove('hidden');
            navAboutBtn.className = 'flex flex-col items-center justify-center py-1 text-blue-400 transition';
        }
    }

    navUploadBtn.addEventListener('click', () => switchView('upload'));
    navDataBtn.addEventListener('click', () => switchView('data'));
    navAboutBtn.addEventListener('click', () => switchView('about'));

    const htmlFileInput = document.getElementById('htmlFileInput') as HTMLInputElement;
    const selectedFileName = document.getElementById('selectedFileName') as HTMLElement;

    htmlFileInput.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        selectedFileName.textContent = file.name;
        selectedFileName.classList.add('text-emerald-400');
        const reader = new FileReader();
        reader.onload = (ev) => {
            uploadedFileContent = (ev.target?.result as string) || '';
        };
        reader.readAsText(file);
    });

    const hostForm = document.getElementById('hostForm') as HTMLFormElement;
    const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
    const resultCard = document.getElementById('resultCard') as HTMLElement;
    const generatedUrlAnchor = document.getElementById('generatedUrlAnchor') as HTMLAnchorElement;
    const openBrowserBtn = document.getElementById('openBrowserBtn') as HTMLAnchorElement;
    const whatsappShareBtn = document.getElementById('whatsappShareBtn') as HTMLAnchorElement;
    const siteNameInput = document.getElementById('siteNameInput') as HTMLInputElement;

    hostForm.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        if (!uploadedFileContent) {
            alert('براہ کرم پہلے index.html فائل سلیکٹ کریں!');
            return;
        }

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> لنک بن رہا ہے...';

        const encoded = encodeHtmlToUrl(uploadedFileContent);
        const directUrl = `${window.location.origin}${window.location.pathname}?site=${encoded}`;
        const finalUrl = await tryShortenUrl(directUrl);

        resultCard.classList.remove('hidden');
        generatedUrlAnchor.href = finalUrl;
        generatedUrlAnchor.textContent = finalUrl;
        openBrowserBtn.href = finalUrl;
        whatsappShareBtn.href = `https://wa.me/?text=${encodeURIComponent('میری لائیو ویب سائٹ چیک کریں: ' + finalUrl)}`;

        const siteItem: HostedSite = {
            id: Date.now(),
            name: siteNameInput.value.trim() || 'میری ویب سائٹ',
            url: finalUrl,
            date: new Date().toLocaleString()
        };

        let history: HostedSite[] = JSON.parse(localStorage.getItem('my_hosted_sites') || '[]');
        history.unshift(siteItem);
        localStorage.setItem('my_hosted_sites', JSON.stringify(history.slice(0, 20)));

        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> لائیو لنک بنائیں';
        resultCard.scrollIntoView({ behavior: 'smooth' });
    });

    function renderHistory() {
        const container = document.getElementById('historyContainer') as HTMLElement;
        const history: HostedSite[] = JSON.parse(localStorage.getItem('my_hosted_sites') || '[]');
        if (history.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-center py-4">ابھی تک کوئی سائیٹ ہوسٹ نہیں کی گئی۔</p>';
            return;
        }
        container.innerHTML = history.map(item => `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                <div class="truncate">
                    <p class="font-bold text-slate-200 truncate">${item.name}</p>
                    <a href="${item.url}" target="_blank" class="text-blue-400 underline truncate block text-[11px]">${item.url}</a>
                </div>
                <a href="${item.url}" target="_blank" class="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg font-semibold shrink-0">
                    کھولیں <i class="fa-solid fa-arrow-up-right-from-square ml-1"></i>
                </a>
            </div>
        `).join('');
    }

    const clearHistoryBtn = document.getElementById('clearHistoryBtn') as HTMLButtonElement;
    clearHistoryBtn.addEventListener('click', () => {
        localStorage.removeItem('my_hosted_sites');
        renderHistory();
    });
                }
