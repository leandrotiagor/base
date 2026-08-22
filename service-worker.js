// =====================================================
// SERVICE WORKER - LT SISTEMAS
// =====================================================
// Faz o app funcionar melhor offline/instalado:
// guarda uma cópia local das páginas e scripts, e serve
// essa cópia enquanto atualiza em segundo plano.
// =====================================================

const CACHE_NAME = 'lt-sistemas-v1';

const ARQUIVOS_PARA_CACHE = [
    './',
    './index.html',
    './painel.html',
    './produtos.html',
    './estoque.html',
    './vendas.html',
    './caixa.html',
    './impressao.html',
    './admin.html',
    './auditoria.html',
    './dashboard.html',
    './style.css',
    './supabase.js',
    './login.js',
    './painel.js',
    './produtos.js',
    './estoque.js',
    './vendas.js',
    './caixa.js',
    './impressao.js',
    './admin.js',
    './auditoria.js',
    './dashboard.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];


self.addEventListener('install', (event) => {

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ARQUIVOS_PARA_CACHE).catch((erro) => {
                console.error('Erro ao preencher cache inicial:', erro);
            });
        })
    );

    self.skipWaiting();
});


self.addEventListener('activate', (event) => {

    event.waitUntil(
        caches.keys().then((nomes) =>
            Promise.all(
                nomes
                    .filter((nome) => nome !== CACHE_NAME)
                    .map((nome) => caches.delete(nome))
            )
        )
    );

    self.clients.claim();
});


self.addEventListener('fetch', (event) => {

    const url = new URL(event.request.url);

    // Só cuida de requisições GET do próprio site.
    // Chamadas para o Supabase e outras APIs seguem direto
    // pra rede, sem passar pelo cache.
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((respostaCache) => {

            const buscaNaRede = fetch(event.request)
                .then((respostaRede) => {

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, respostaRede.clone());
                    });

                    return respostaRede;
                })
                .catch(() => respostaCache);

            return respostaCache || buscaNaRede;
        })
    );
});
