// =====================================================
// MÓDULO ESTOQUE
// =====================================================

let produtosCache = [];
let nomeOperadorAtual = null;


// =====================================================
// ABAS
// =====================================================

document.querySelectorAll('.tab-btn').forEach(botao => {

    botao.addEventListener('click', () => {

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo'));
        document.querySelectorAll('.aba').forEach(a => a.classList.remove('ativa'));

        botao.classList.add('ativo');
        document.getElementById(`aba-${botao.dataset.aba}`).classList.add('ativa');

        if (botao.dataset.aba === 'historico') {
            carregarHistorico();
        }

        if (botao.dataset.aba === 'inventario') {
            renderizarInventario();
        }
    });
});


// =====================================================
// CARREGAR OPERADOR ATUAL (para registrar nas movimentações)
// =====================================================

async function carregarOperadorAtual() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return null;
    }

    const { data: operador } = await supabaseClient
        .from('operadores')
        .select('nome')
        .eq('id', user.id)
        .single();

    nomeOperadorAtual = operador?.nome || null;

    return user;
}


// =====================================================
// CARREGAR PRODUTOS (usado em vários pontos da tela)
// =====================================================

async function carregarProdutos() {

    const { data, error } = await supabaseClient
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

    if (error) {
        console.error('Erro ao carregar produtos:', error);
        return;
    }

    produtosCache = data || [];

    preencherSelectsProdutos();
    renderizarAlertaEstoque();
}


function preencherSelectsProdutos() {

    const movProduto = document.getElementById('movProduto');
    const filtroHistProduto = document.getElementById('filtroHistProduto');

    movProduto.innerHTML = '<option value="">Selecione um produto</option>';
    filtroHistProduto.innerHTML = '<option value="">Todos os produtos</option>';

    produtosCache.forEach(produto => {

        const opcao1 = document.createElement('option');
        opcao1.value = produto.id;
        opcao1.textContent = `${produto.nome} (estoque: ${produto.estoque})`;
        movProduto.appendChild(opcao1);

        const opcao2 = document.createElement('option');
        opcao2.value = produto.id;
        opcao2.textContent = produto.nome;
        filtroHistProduto.appendChild(opcao2);
    });
}


// =====================================================
// ALERTAS DE ESTOQUE BAIXO
// =====================================================

function renderizarAlertaEstoque() {

    const baixos = produtosCache.filter(
        p => Number(p.estoque) <= Number(p.estoque_minimo)
    );

    const container = document.getElementById('alertaEstoque');
    const lista = document.getElementById('listaAlertaEstoque');

    if (baixos.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    lista.innerHTML = '';

    baixos.forEach(produto => {

        const item = document.createElement('div');
        item.className = 'alerta-item';

        item.innerHTML = `
            <span></span>
            <span></span>
        `;

        item.children[0].textContent = produto.nome;
        item.children[1].textContent =
            `Estoque atual: ${produto.estoque} (mínimo: ${produto.estoque_minimo})`;

        lista.appendChild(item);
    });
}


// =====================================================
// FORMULÁRIO DE MOVIMENTAÇÃO
// =====================================================

const movTipo = document.getElementById('movTipo');
const labelQuantidadeMov = document.getElementById('labelQuantidadeMov');
const movQuantidade = document.getElementById('movQuantidade');

movTipo.addEventListener('change', () => {

    if (movTipo.value === 'ajuste') {
        labelQuantidadeMov.textContent = 'Novo estoque (quantidade correta)';
        movQuantidade.min = 0;
    } else {
        labelQuantidadeMov.textContent = 'Quantidade';
        movQuantidade.min = 0.01;
    }
});


document.getElementById('formMovimentacao').addEventListener('submit', async (event) => {

    event.preventDefault();

    const produtoId = document.getElementById('movProduto').value;
    const tipo = movTipo.value;
    const valorInformado = Number(movQuantidade.value);
    const motivo = document.getElementById('movMotivo').value.trim();

    if (!produtoId) {
        alert('Selecione um produto.');
        return;
    }

    const produto = produtosCache.find(p => p.id === produtoId);

    if (!produto) {
        alert('Produto não encontrado.');
        return;
    }

    let novoEstoque;
    let quantidadeMovimento;

    if (tipo === 'entrada') {

        novoEstoque = Number(produto.estoque) + valorInformado;
        quantidadeMovimento = valorInformado;

    } else if (tipo === 'saida') {

        if (valorInformado > Number(produto.estoque)) {

            if (!confirm(
                `A saída (${valorInformado}) é maior que o estoque atual (${produto.estoque}). Deseja continuar mesmo assim?`
            )) {
                return;
            }
        }

        novoEstoque = Number(produto.estoque) - valorInformado;
        quantidadeMovimento = -valorInformado;

    } else {
        // ajuste: valorInformado é o novo estoque
        novoEstoque = valorInformado;
        quantidadeMovimento = valorInformado - Number(produto.estoque);
    }

    const botao = event.target.querySelector('button[type="submit"]');
    botao.disabled = true;

    try {

        const { error: erroUpdate } = await supabaseClient
            .from('produtos')
            .update({ estoque: novoEstoque })
            .eq('id', produtoId);

        if (erroUpdate) throw erroUpdate;

        const { error: erroInsert } = await supabaseClient
            .from('estoque_movimentacoes')
            .insert({
                produto_id: produtoId,
                tipo: tipo,
                quantidade: quantidadeMovimento,
                motivo: motivo || null,
                operador_nome: nomeOperadorAtual
            });

        if (erroInsert) throw erroInsert;

        await registrarAuditoria(
            'acao',
            `Registrou ${tipo} de estoque no produto "${produto.nome}" (${quantidadeMovimento > 0 ? '+' : ''}${quantidadeMovimento}).`
        );

        alert('Movimentação registrada com sucesso!');

        document.getElementById('formMovimentacao').reset();

        await carregarProdutos();

    } catch (erro) {

        console.error('Erro ao registrar movimentação:', erro);
        alert('Não foi possível registrar a movimentação.');

    } finally {

        botao.disabled = false;
    }
});


// =====================================================
// HISTÓRICO
// =====================================================

async function carregarHistorico() {

    const lista = document.getElementById('listaHistorico');

    lista.innerHTML = '<tr><td colspan="6" class="mensagem">Carregando histórico...</td></tr>';

    try {

        let consulta = supabaseClient
            .from('estoque_movimentacoes')
            .select('id, produto_id, tipo, quantidade, motivo, operador_nome, created_at, produtos(nome)')
            .order('created_at', { ascending: false })
            .limit(500);

        const filtroProduto = document.getElementById('filtroHistProduto').value;
        const filtroTipo = document.getElementById('filtroHistTipo').value;
        const filtroInicio = document.getElementById('filtroHistInicio').value;
        const filtroFim = document.getElementById('filtroHistFim').value;

        if (filtroProduto) consulta = consulta.eq('produto_id', filtroProduto);
        if (filtroTipo) consulta = consulta.eq('tipo', filtroTipo);
        if (filtroInicio) consulta = consulta.gte('created_at', `${filtroInicio}T00:00:00`);
        if (filtroFim) consulta = consulta.lte('created_at', `${filtroFim}T23:59:59`);

        const { data, error } = await consulta;

        if (error) throw error;

        if (!data || data.length === 0) {
            lista.innerHTML = '<tr><td colspan="6" class="mensagem">Nenhuma movimentação encontrada.</td></tr>';
            return;
        }

        lista.innerHTML = '';

        data.forEach(mov => {

            const tagClasse =
                mov.tipo === 'entrada' ? 'tag-entrada' :
                mov.tipo === 'saida' ? 'tag-saida' : 'tag-ajuste';

            const tagTexto =
                mov.tipo === 'entrada' ? 'Entrada' :
                mov.tipo === 'saida' ? 'Saída' : 'Ajuste';

            const linha = document.createElement('tr');

            linha.innerHTML = `
                <td></td>
                <td></td>
                <td><span class="tag ${tagClasse}">${tagTexto}</span></td>
                <td></td>
                <td></td>
                <td></td>
            `;

            linha.children[0].textContent = formatarData(mov.created_at);
            linha.children[1].textContent = mov.produtos?.nome || '—';
            linha.children[3].textContent =
                (mov.quantidade > 0 ? '+' : '') + mov.quantidade;
            linha.children[4].textContent = mov.motivo || '—';
            linha.children[5].textContent = mov.operador_nome || '—';

            lista.appendChild(linha);
        });

    } catch (erro) {

        console.error('Erro ao carregar histórico:', erro);
        lista.innerHTML = '<tr><td colspan="6" class="mensagem">Erro ao carregar histórico.</td></tr>';
    }
}

document.getElementById('btnFiltrarHistorico').addEventListener('click', carregarHistorico);


function formatarData(dataISO) {

    const data = new Date(dataISO);

    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}


// =====================================================
// INVENTÁRIO
// =====================================================

function renderizarInventario() {

    const lista = document.getElementById('listaInventario');

    if (produtosCache.length === 0) {
        lista.innerHTML = '<p class="mensagem">Nenhum produto cadastrado.</p>';
        return;
    }

    lista.innerHTML = '';

    produtosCache.forEach(produto => {

        const linha = document.createElement('div');
        linha.className = 'inventario-linha';

        linha.innerHTML = `
            <span></span>
            <span></span>
            <input type="number" step="0.01" min="0" class="input-contagem" data-produto-id="${produto.id}" placeholder="Contagem">
            <span class="diferenca">—</span>
        `;

        linha.children[0].textContent = produto.nome;
        linha.children[1].textContent = produto.estoque;

        const input = linha.querySelector('.input-contagem');
        const spanDiferenca = linha.querySelector('.diferenca');

        input.addEventListener('input', () => {

            if (input.value === '') {
                spanDiferenca.textContent = '—';
                return;
            }

            const diferenca = Number(input.value) - Number(produto.estoque);

            spanDiferenca.textContent =
                (diferenca > 0 ? '+' : '') + diferenca.toFixed(2).replace(/\.00$/, '');
        });

        lista.appendChild(linha);
    });
}


document.getElementById('btnAplicarInventario').addEventListener('click', async () => {

    const inputs = document.querySelectorAll('.input-contagem');

    const ajustes = [];

    inputs.forEach(input => {

        if (input.value !== '') {

            const produtoId = input.dataset.produtoId;
            const produto = produtosCache.find(p => p.id === produtoId);
            const novaContagem = Number(input.value);

            if (produto && novaContagem !== Number(produto.estoque)) {
                ajustes.push({ produto, novaContagem });
            }
        }
    });

    if (ajustes.length === 0) {
        alert('Nenhuma alteração informada para aplicar.');
        return;
    }

    if (!confirm(`Aplicar ${ajustes.length} ajuste(s) de inventário?`)) {
        return;
    }

    const botao = document.getElementById('btnAplicarInventario');
    botao.disabled = true;

    try {

        for (const { produto, novaContagem } of ajustes) {

            const diferenca = novaContagem - Number(produto.estoque);

            const { error: erroUpdate } = await supabaseClient
                .from('produtos')
                .update({ estoque: novaContagem })
                .eq('id', produto.id);

            if (erroUpdate) throw erroUpdate;

            const { error: erroInsert } = await supabaseClient
                .from('estoque_movimentacoes')
                .insert({
                    produto_id: produto.id,
                    tipo: 'ajuste',
                    quantidade: diferenca,
                    motivo: 'Ajuste por inventário',
                    operador_nome: nomeOperadorAtual
                });

            if (erroInsert) throw erroInsert;
        }

        await registrarAuditoria(
            'acao',
            `Aplicou inventário com ${ajustes.length} ajuste(s) de estoque.`
        );

        alert('Inventário aplicado com sucesso!');

        await carregarProdutos();

        renderizarInventario();

    } catch (erro) {

        console.error('Erro ao aplicar inventário:', erro);
        alert('Não foi possível aplicar todos os ajustes do inventário.');

    } finally {

        botao.disabled = false;
    }
});


// =====================================================
// INICIALIZAÇÃO
// =====================================================

(async function iniciar() {

    const user = await carregarOperadorAtual();

    if (!user) return;

    await carregarProdutos();

})();
