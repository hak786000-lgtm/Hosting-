// main.ts - Simple TypeScript Hosting Engine for GitHub & Vercel

interface HostedSite {
    id: string;
    name: string;
    url: string;
    createdAt: string;
}

// 1. Encode & Decode HTML safely inside URL
function encodeHtmlToUrl(html: string): string {
    const bytes = new TextEncoder().encode(html);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function decodeHtmlFromUrl(encoded: string): string {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

// 2. Check if current URL is opening a hosted site (?site=...)
function checkAndRenderHostedSite(): boolean {
    const params = new URLSearchParams(window.location.search);
    const siteData = params.get('site');
    if (siteData) {
        try {
            const rawHtml = decodeHtmlFromUrl(siteData);
            document.open();
            document.write(rawHtml);
            document.close();
            return true;
        } catch (err) {
            console.error('Failed to render hosted HTML:', err);
        }
    }
    return false;
}

// Shorten link using TinyURL/is.gd if possible, fallback to direct Vercel URL
async function tryShortenUrl(longUrl: string): Promise<string> {
    try {
        const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`;
        const res = await fetch(apiUrl);
        if (res.ok) {
            const shortUrl = await res.text();
            if (shortUrl.startsWith('http')) {
                return shortUrl.trim();
            }
        }
    } catch {
        // Fallback to direct Vercel link
    }
    return longUrl;
}

// 3. Initialize Dashboard App if not viewing a hosted site
if (!checkAndRenderHostedSite()) {
    let activeMode: 'file' | 'code' = 'file';
    let uploadedFileContent: string = '';
    let deferredInstallPrompt: any = null;

    // Dynamic PWA Manifest Injection for "Download App"
    const manifest = {
        name: 'Pocket HTML Host',
        short_name: 'HTML Host',
        start_url: window.location.origin,
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#2563eb',
        icons: [
            {
                src: 'https://cdn-icons-png.flaticon.com/512/1006/1006363.png',
                sizes: '512x512',
                type: 'image/png'
            }
        ]
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = URL.createObjectURL(manifestBlob);
    document.head.appendChild(manifestLink);

    window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault();
        deferredInstallPrompt = e;
    });

    // DOM Elements
    const installAppBtn = document.getElementById('installAppBtn') as HTMLButtonElement;
    const tabFileBtn = document.getElementById('tabFileBtn') as HTMLButtonElement;
    const tabCodeBtn = document.getElementById('tabCodeBtn') as HTMLButtonElement;
    const fileUploadSection = document.getElementById('fileUploadSection') as HTMLDivElement;
    const codePasteSection = document.getElementById('codePasteSection') as HTMLDivElement;
    const htmlFileInput = document.getElementById('htmlFileInput') as HTMLInputElement;
    const selectedFileName = document.getElementById('selectedFileName') as HTMLParagraphElement;
    const rawHtmlInput = document.getElementById('rawHtmlInput') as HTMLTextAreaElement;
    const siteNameInput = document.getElementById('siteNameInput') as HTMLInputElement;
    const hostForm = document.getElementById('hostForm') as HTMLFormElement;
    const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
    const resultCard = document.getElementById('resultCard') as HTMLDivElement;
    const generatedUrlAnchor = document.getElementById('generatedUrlAnchor') as HTMLAnchorElement;
    const openBrowserBtn = document.getElementById('openBrowserBtn') as HTMLAnchorElement;
    const copyLinkBtn = document.getElementById('copyLinkBtn') as HTMLButtonElement;
    const whatsappShareBtn = document.getElementById('whatsappShareBtn') as HTMLAnchorElement;
    const historyContainer = document.getElementById('historyContainer') as HTMLDivElement;
    const clearHistoryBtn = document.getElementById('clearHistoryBtn') as HTMLButtonElement;

    // Install / Download App Handler
    installAppBtn.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
        } else {
            alert(
                "موبائل میں ایپ ڈاؤن لوڈ/انسٹال کرنے کے لیے:\n1. اوپر کروم کے 3 نقطوں (⋮) پر کلک کریں۔\n2. 'Add to Home screen' یا 'Install App' پر کلک کریں۔"
            );
        }
    });

    // Switch Tabs
    tabFileBtn.addEventListener('click', () => {
        activeMode = 'file';
        fileUploadSection.classList.remove('hidden');
        codePasteSection.classList.add('hidden');
        tabFileBtn.className = 'py-2 text-xs font-bold rounded-lg bg-blue-600 text-white transition';
        tabCodeBtn.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition';
    });

    tabCodeBtn.addEventListener('click', () => {
        activeMode = 'code';
        codePasteSection.classList.remove('hidden');
        fileUploadSection.classList.add('hidden');
        tabCodeBtn.className = 'py-2 text-xs font-bold rounded-lg bg-blue-600 text-white transition';
        tabFileBtn.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition';
    });

    // Read selected index.html file
    htmlFileInput.addEventListener('change', () => {
        const file = htmlFileInput.files?.[0];
        if (!file) return;
        selectedFileName.textContent = file.name;
        selectedFileName.classList.add('text-emerald-400');

        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedFileContent = (e.target?.result as string) || '';
        };
        reader.readAsText(file);
    });

    // Form Submit -> Generate Live Link
    hostForm.addEventListener('submit', async (e: Event) => {
        e.preventDefault();

        const htmlToHost = activeMode === 'file' ? uploadedFileContent : rawHtmlInput.value.trim();
        if (!htmlToHost) {
            alert('براہ کرم پہلے اپنی index.html فائل سلیکٹ کریں یا کوڈ پیسٹ کریں!');
            return;
        }

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Link...';

        const encoded = encodeHtmlToUrl(htmlToHost);
        const directVercelUrl = `${window.location.origin}${window.location.pathname}?site=${encoded}`;
        const finalUrl = await tryShortenUrl(directVercelUrl);

        // Display Result
        resultCard.classList.remove('hidden');
        generatedUrlAnchor.href = finalUrl;
        generatedUrlAnchor.textContent = finalUrl;
        openBrowserBtn.href = finalUrl;
        whatsappShareBtn.href = `https://wa.me/?text=${encodeURIComponent('Check out my live website: ' + finalUrl)}`;

        const siteItem: HostedSite = {
            id: Date.now().toString(),
            name: siteNameInput.value.trim() || 'My Website',
            url: finalUrl,
            createdAt: new Date().toLocaleString()
        };

        saveSiteToHistory(siteItem);
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Generate Live Link';
        resultCard.scrollIntoView({ behavior: 'smooth' });
    });

    // Copy Link
    copyLinkBtn.addEventListener('click', () => {
        const url = generatedUrlAnchor.textContent || '';
        navigator.clipboard.writeText(url);
        alert('آپ کا لائیو لنک کاپی ہو گیا ہے!');
    });

    // History Functions
    function getHistory(): HostedSite[] {
        try {
            return JSON.parse(localStorage.getItem('vercel_hosted_sites') || '[]');
        } catch {
            return [];
        }
    }

    function saveSiteToHistory(site: HostedSite): void {
        const list = getHistory();
        list.unshift(site);
        localStorage.setItem('vercel_hosted_sites', JSON.stringify(list.slice(0, 20)));
        renderHistory();
    }

    function renderHistory(): void {
        const list = getHistory();
        if (list.length === 0) {
            historyContainer.innerHTML = '<p class="text-slate-500 text-center py-3">ابھی تک کوئی ویب سائٹ ہوسٹ نہیں کی گئی۔</p>';
            return;
        }

        historyContainer.innerHTML = list
            .map(
                (item) => `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                <div class="truncate">
                    <p class="font-bold text-slate-200 truncate">${item.name}</p>
                    <a href="${item.url}" target="_blank" class="text-blue-400 underline truncate block text-[11px]">${item.url}</a>
                </div>
                <a href="${item.url}" target="_blank" class="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg font-semibold shrink-0">
                    Open <i class="fa-solid fa-arrow-up-right-from-square ml-1"></i>
                </a>
            </div>
        `
            )
            .join('');
    }

    clearHistoryBtn.addEventListener('click', () => {
        localStorage.removeItem('vercel_hosted_sites');
        renderHistory();
    });

    renderHistory();
}
