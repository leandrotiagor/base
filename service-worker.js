// =====================================================
// SERVICE WORKER - LT SISTEMAS
// =====================================================
// Faz o app funcionar melhor offline/instalado. Estratégia:
// SEMPRE tenta buscar a versão mais nova na internet primeiro;
// só usa a cópia salva (cache) se a internet estiver fora do ar.
// Isso evita mostrar telas antigas/desatualizadas por engano.
// =====================================================

const CACHE_NAME = 'lt-sistemas-v2';


self.addEventListener('install', (event) => {
    // Não pré-carrega uma lista fixa de arquivos (se um arquivo
    // novo ainda não existir no servidor, isso quebraria a
    // instalação inteira). O cache é preenchido aos poucos,
    // conforme as páginas são visitadas normalmente.
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
        fetch(event.request)
            .then((respostaRede) => {

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, respostaRede.clone());
                });

                return respostaRede;
            })
            .catch(() => caches.match(event.request))
    );
});
