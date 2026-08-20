// =====================================================
// MÓDULO PRODUTOS
// =====================================================

const listaProdutos = document.getElementById('listaProdutos');
const filtroBusca = document.getElementById('filtroBusca');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroEstoqueBaixo = document.getElementById('filtroEstoqueBaixo');

const modalProduto = document.getElementById('modalProduto');
const formProduto = document.getElementById('formProduto');
const tituloModalProduto = document.getElementById('tituloModalProduto');
const produtoCategoriaSelect = document.getElementById('produtoCategoria');

const modalCategorias = document.getElementById('modalCategorias');
const formNovaCategoria = document.getElementById('formNovaCategoria');
const listaCategorias = document.getElementById('listaCategorias');

let produtosCache = [];
let categoriasCache = [];


// =====================================================
// CARREGAR CATEGORIAS
// =====================================================

async function carregarCategorias() {

    const { data, error } = await supabaseClient
        .from('categorias_produto')
        .select('*')
        .order('nome');

    if (error) {
        console.error('Erro ao carregar categorias:', error);
        return;
    }

    categoriasCache = data || [];

    // Filtro
    filtroCategoria.innerHTML = '<option value="">Todas</option>';

    categoriasCache.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria.nome;
        option.textContent = categoria.nome;
        filtroCategoria.appendChild(option);
    });

    // Select do formulário de produto
    produtoCategoriaSelect.innerHTML = '<option value="">Sem categoria</option>';

    categoriasCache.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria.nome;
        option.textContent = categoria.nome;
        produtoCategoriaSelect.appendChild(option);
    });

    // Lista dentro do modal de categorias
    if (categoriasCache.length === 0) {

        listaCategorias.innerHTML =
            '<p style="color:#6b7280; font-size:13px;">Nenhuma categoria cadastrada ainda.</p>';

    } else {

        listaCategorias.innerHTML = '';

        categoriasCache.forEach(categoria => {

            const item = document.createElement('div');
            item.className = 'item-categoria';

            item.innerHTML = `
                <span></span>
                <button type="button" class="btn-acao-excluir">Excluir</button>
            `;

            item.querySelector('span').textContent = categoria.nome;

            item.querySelector('button').addEventListener('click', () => excluirCategoria(categoria));

            listaCategorias.appendChild(item);
        });
    }
}


async function excluirCategoria(categoria) {

    if (!confirm(`Excluir a categoria "${categoria.nome}"? Produtos já cadastrados com ela mantêm o nome salvo.`)) {
        return;
    }

    const { error } = await supabaseClient
        .from('categorias_produto')
        .delete()
        .eq('id', categoria.id);

    if (error) {
        console.error('Erro ao excluir categoria:', error);
        alert('Não foi possível excluir a categoria.');
        return;
    }

    await registrarAuditoria('acao', `Excluiu a categoria "${categoria.nome}".`);

    await carregarCategorias();
}


formNovaCategoria.addEventListener('submit', async (event) => {

    event.preventDefault();

    const nome = document.getElementById('nomeNovaCategoria').value.trim();

    if (!nome) {
        return;
    }

    const { error } = await supabaseClient
        .from('categorias_produto')
        .insert({ nome });

    if (error) {
        console.error('Erro ao criar categoria:', error);
        alert('Não foi possível criar a categoria. Ela já pode existir.');
        return;
    }

    await registrarAuditoria('acao', `Criou a categoria "${nome}".`);

    formNovaCategoria.reset();

    await carregarCategorias();
});


document.getElementById('btnCategorias').addEventListener('click', () => {
    modalCategorias.style.display = 'flex';
});

function fecharModalCategorias() {
    modalCategorias.style.display = 'none';
}


// =====================================================
// CARREGAR PRODUTOS
// =====================================================

async function carregarProdutos() {

    listaProdutos.innerHTML =
        '<tr><td colspan="8" class="mensagem">Carregando produtos...</td></tr>';

    const { data, error } = await supabaseClient
        .from('produtos')
        .select('*')
        .order('nome');

    if (error) {
        console.error('Erro ao carregar produtos:', error);
        listaProdutos.innerHTML =
            '<tr><td colspan="8" class="mensagem">Erro ao carregar produtos.</td></tr>';
        return;
    }

    produtosCache = data || [];

    renderizarProdutos();
}


function renderizarProdutos() {

    let filtrados = produtosCache;

    const busca = filtroBusca.value.trim().toLowerCase();

    if (busca) {
        filtrados = filtrados.filter(p => p.nome.toLowerCase().includes(busca));
    }

    if (filtroCategoria.value) {
        filtrados = filtrados.filter(p => p.categoria === filtroCategoria.value);
    }

    if (filtroEstoqueBaixo.value === 'baixo') {
        filtrados = filtrados.filter(p => Number(p.estoque) <= Number(p.estoque_minimo));
    }

    if (filtrados.length === 0) {
        listaProdutos.innerHTML =
            '<tr><td colspan="8" class="mensagem">Nenhum produto encontrado.</td></tr>';
        return;
    }

    listaProdutos.innerHTML = '';

    filtrados.forEach(produto => {

        const estoqueBaixo = Number(produto.estoque) <= Number(produto.estoque_minimo);

        let tagHtml = '';

        if (!produto.ativo) {
            tagHtml = '<span class="tag tag-inativo">Inativo</span>';
        } else if (estoqueBaixo) {
            tagHtml = '<span class="tag tag-baixo">⚠️ Estoque baixo</span>';
        } else {
            tagHtml = '<span class="tag tag-ok">OK</span>';
        }

        const linha = document.createElement('tr');

        linha.innerHTML = `
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>${tagHtml}</td>
            <td>
                <button type="button" class="btn-acao btn-editar">Editar</button>
                <button type="button" class="btn-acao-excluir btn-excluir">Excluir</button>
            </td>
        `;

        linha.children[0].textContent = produto.nome;
        linha.children[1].textContent = produto.categoria || '—';
        linha.children[2].textContent = formatarMoeda(produto.preco_custo);
        linha.children[3].textContent = formatarMoeda(produto.preco_venda);
        linha.children[4].textContent = produto.estoque;
        linha.children[5].textContent = produto.estoque_minimo;

        linha.querySelector('.btn-editar')
            .addEventListener('click', () => abrirModalProduto(produto));

        linha.querySelector('.btn-excluir')
            .addEventListener('click', () => excluirProduto(produto));

        listaProdutos.appendChild(linha);
    });
}


function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}


filtroBusca.addEventListener('input', renderizarProdutos);
filtroCategoria.addEventListener('change', renderizarProdutos);
filtroEstoqueBaixo.addEventListener('change', renderizarProdutos);


// =====================================================
// MODAL NOVO / EDITAR PRODUTO
// =====================================================

function abrirModalProduto(produto) {

    formProduto.reset();

    if (produto) {

        tituloModalProduto.textContent = 'Editar produto';

        document.getElementById('produtoId').value = produto.id;
        document.getElementById('produtoNome').value = produto.nome;
        document.getElementById('produtoCategoria').value = produto.categoria || '';
        document.getElementById('produtoPrecoCusto').value = produto.preco_custo;
        document.getElementById('produtoPrecoVenda').value = produto.preco_venda;
        document.getElementById('produtoEstoque').value = produto.estoque;
        document.getElementById('produtoEstoqueMinimo').value = produto.estoque_minimo;
        document.getElementById('produtoAtivo').value = String(produto.ativo);

    } else {

        tituloModalProduto.textContent = 'Novo produto';
        document.getElementById('produtoId').value = '';
        document.getElementById('produtoEstoque').value = 0;
        document.getElementById('produtoEstoqueMinimo').value = 0;
        document.getElementById('produtoAtivo').value = 'true';
    }

    modalProduto.style.display = 'flex';
}

function fecharModalProduto() {
    modalProduto.style.display = 'none';
    formProduto.reset();
}

document.getElementById('btnNovoProduto').addEventListener('click', () => abrirModalProduto(null));


formProduto.addEventListener('submit', async (event) => {

    event.preventDefault();

    const id = document.getElementById('produtoId').value;

    const dados = {
        nome: document.getElementById('produtoNome').value.trim(),
        categoria: document.getElementById('produtoCategoria').value || null,
        preco_custo: Number(document.getElementById('produtoPrecoCusto').value),
        preco_venda: Number(document.getElementById('produtoPrecoVenda').value),
        estoque: Number(document.getElementById('produtoEstoque').value),
        estoque_minimo: Number(document.getElementById('produtoEstoqueMinimo').value),
        ativo: document.getElementById('produtoAtivo').value === 'true'
    };

    if (!dados.nome) {
        alert('Informe o nome do produto.');
        return;
    }

    const botao = formProduto.querySelector('button[type="submit"]');
    botao.disabled = true;

    try {

        if (id) {

            const { error } = await supabaseClient
                .from('produtos')
                .update(dados)
                .eq('id', id);

            if (error) throw error;

            await registrarAuditoria('acao', `Editou o produto "${dados.nome}".`);

        } else {

            const { error } = await supabaseClient
                .from('produtos')
                .insert(dados);

            if (error) throw error;

            await registrarAuditoria('acao', `Cadastrou o produto "${dados.nome}".`);
        }

        fecharModalProduto();

        await carregarProdutos();

    } catch (erro) {

        console.error('Erro ao salvar produto:', erro);
        alert('Não foi possível salvar o produto.');

    } finally {

        botao.disabled = false;
    }
});


async function excluirProduto(produto) {

    if (!confirm(`Excluir o produto "${produto.nome}"? Essa ação não pode ser desfeita.`)) {
        return;
    }

    const { error } = await supabaseClient
        .from('produtos')
        .delete()
        .eq('id', produto.id);

    if (error) {
        console.error('Erro ao excluir produto:', error);
        alert('Não foi possível excluir o produto. Verifique se ele já não está vinculado a vendas ou movimentações.');
        return;
    }

    await registrarAuditoria('acao', `Excluiu o produto "${produto.nome}".`);

    await carregarProdutos();
}


// =====================================================
// VERIFICAÇÃO DE ACESSO E INICIALIZAÇÃO
// =====================================================

async function iniciar() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return;
    }

    await carregarCategorias();
    await carregarProdutos();
}

iniciar();
