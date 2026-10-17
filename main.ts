interface HostedSite {
    id: number;
    name: string;
    url: string;
    date: string;
}

// 1. Safe URL Encoder
function encodeHtmlToUrl(html: string): string {
    const bytes = new TextEncoder().encode(html);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 2. Instant Site Renderer
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
            console.error('Render error:', err);
        }
    }
    return false;
}

// Shorten Link API
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

        navUploadBtn.className = 'flex flex-col items-center justify-center py-1.5 text-gray-400 transition-all';
        navDataBtn.className = 'flex flex-col items-center justify-center py-1.5 text-gray-400 transition-all';
        navAboutBtn.className = 'flex flex-col items-center justify-center py-1.5 text-gray-400 transition-all';

        if (viewName === 'upload') {
            viewUpload.classList.remove('hidden');
            navUploadBtn.className = 'flex flex-col items-center justify-center py-1.5 text-blue-400 transition-all';
        } else if (viewName === 'data') {
            viewData.classList.remove('hidden');
            navDataBtn.className = 'flex flex-col items-center justify-center py-1.5 text-blue-400 transition-all';
            renderHistory();
        } else if (viewName === 'about') {
            viewAbout.classList.remove('hidden');
            navAboutBtn.className = 'flex flex-col items-center justify-center py-1.5 text-blue-400 transition-all';
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
            alert('Please select an index.html file first!');
            return;
        }

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deploying Node...';

        const encoded = encodeHtmlToUrl(uploadedFileContent);
        const directUrl = `${window.location.origin}${window.location.pathname}?site=${encoded}`;
        const finalUrl = await tryShortenUrl(directUrl);

        resultCard.classList.remove('hidden');
        generatedUrlAnchor.href = finalUrl;
        generatedUrlAnchor.textContent = finalUrl;
        openBrowserBtn.href = finalUrl;
        whatsappShareBtn.href = `https://wa.me/?text=${encodeURIComponent('Check out my live deployed website: ' + finalUrl)}`;

        const siteItem: HostedSite = {
            id: Date.now(),
            name: siteNameInput.value.trim() || 'Untitled Project',
            url: finalUrl,
            date: new Date().toLocaleDateString()
        };

        let history: HostedSite[] = JSON.parse(localStorage.getItem('vip_hosted_sites') || '[]');
        history.unshift(siteItem);
        localStorage.setItem('vip_hosted_sites', JSON.stringify(history.slice(0, 20)));

        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa-solid fa-bolt-lightning text-amber-400"></i> Generate Live VIP Link';
        resultCard.scrollIntoView({ behavior: 'smooth' });
    });

    function renderHistory() {
        const container = document.getElementById('historyContainer') as HTMLElement;
        const history: HostedSite[] = JSON.parse(localStorage.getItem('vip_hosted_sites') || '[]');
        if (history.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-gray-500 font-medium">No deployed nodes found.</div>';
            return;
        }
        container.innerHTML = history.map(item => `
            <div class="bg-gray-900/90 border border-gray-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-md">
                <div class="truncate">
                    <p class="font-bold text-gray-200 truncate text-xs mb-0.5">${item.name}</p>
                    <a href="${item.url}" target="_blank" class="text-blue-400 hover:underline truncate block text-[10px] font-mono">${item.url}</a>
                </div>
                <a href="${item.url}" target="_blank" class="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all">
                    Launch <i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[10px]"></i>
                </a>
            </div>
        `).join('');
    }

    const clearHistoryBtn = document.getElementById('clearHistoryBtn') as HTMLButtonElement;
    clearHistoryBtn.addEventListener('click', () => {
        localStorage.removeItem('vip_hosted_sites');
        renderHistory();
    });
}
