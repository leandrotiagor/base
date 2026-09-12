// =====================================================
// VITRINE PÚBLICA - LT Sistemas
// =====================================================

// ⚠️ IMPORTANTE: troque pelo número de WhatsApp da loja
// Formato: código do país + DDD + número, só dígitos.
// Exemplo (Brasil, DDD 38): '553899999999'
const WHATSAPP_NUMERO = '5538984062019';

const gridVitrine = document.getElementById('gridVitrine');
const campoBusca = document.getElementById('campoBusca');

let todosOsProdutos = [];


function formatarPreco(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto || '';
    return div.innerHTML;
}

function linkWhatsapp(produto) {

    const mensagem =
        `Olá! Vi o produto "${produto.titulo}" na vitrine e ` +
        `gostaria de mais informações.`;

    return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}


function renderizarProdutos(lista) {

    if (!lista || lista.length === 0) {
        gridVitrine.innerHTML =
            '<p class="mensagem">Nenhum produto encontrado.</p>';
        return;
    }

    gridVitrine.innerHTML = '';

    lista.forEach((produto) => {

        const card = document.createElement('div');
        card.className = 'produto-card';

        card.innerHTML = `
            <div class="produto-foto-wrap">
                <img src="${produto.foto_url || ''}" alt="${escaparHtml(produto.titulo)}"
                     loading="lazy" onerror="this.style.opacity='0.3'">
            </div>

            <div class="produto-info">
                <div class="produto-preco"></div>
                <div class="produto-titulo"></div>
                <div class="produto-descricao"></div>
                <a class="btn-whatsapp" target="_blank" rel="noopener">
                    💬 Falar no WhatsApp
                </a>
            </div>
        `;

        card.querySelector('.produto-preco').textContent =
            formatarPreco(produto.preco);

        card.querySelector('.produto-titulo').textContent = produto.titulo;

        card.querySelector('.produto-descricao').textContent =
            produto.descricao || '';

        card.querySelector('.btn-whatsapp').href = linkWhatsapp(produto);

        gridVitrine.appendChild(card);
    });
}


async function carregarVitrine() {

    const { data: produtos, error } = await supabaseClient
        .from('loja_produtos')
        .select('id, titulo, descricao, preco, foto_url')
        .eq('ativo', true)
        .order('criado_em', { ascending: false });

    if (error) {
        console.error('Erro ao carregar vitrine:', error);
        gridVitrine.innerHTML =
            '<p class="mensagem">Não foi possível carregar os produtos agora.</p>';
        return;
    }

    todosOsProdutos = produtos || [];
    renderizarProdutos(todosOsProdutos);
}


campoBusca.addEventListener('input', () => {

    const termo = campoBusca.value.trim().toLowerCase();

    if (!termo) {
        renderizarProdutos(todosOsProdutos);
        return;
    }

    const filtrados = todosOsProdutos.filter((produto) =>
        (produto.titulo || '').toLowerCase().includes(termo) ||
        (produto.descricao || '').toLowerCase().includes(termo)
    );

    renderizarProdutos(filtrados);
});


carregarVitrine();
