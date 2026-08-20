// =====================================================
// MÓDULO VENDAS
// =====================================================

let usuarioAtual = null;
let nomeOperadorAtual = null;
let caixaAtual = null;
let produtosCache = [];
let carrinho = []; // { produto, quantidade }
let formaPagamentoSelecionada = null;


function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}


// =====================================================
// INICIALIZAÇÃO
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

    usuarioAtual = user;

    const { data: operador } = await supabaseClient
        .from('operadores')
        .select('nome')
        .eq('id', user.id)
        .single();

    nomeOperadorAtual = operador?.nome || null;

    return user;
}


async function verificarCaixaAberto() {

    const { data, error } = await supabaseClient
        .from('caixa')
        .select('*')
        .eq('status', 'aberto')
        .order('aberto_em', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Erro ao verificar caixa:', error);
        return null;
    }

    return data;
}


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

    const datalist = document.getElementById('listaProdutosDatalist');
    datalist.innerHTML = '';

    produtosCache.forEach(produto => {
        const option = document.createElement('option');
        option.value = produto.nome;
        datalist.appendChild(option);
    });
}


// =====================================================
// CARRINHO
// =====================================================

document.getElementById('btnAdicionarCarrinho').addEventListener('click', () => {

    const nomeDigitado = document.getElementById('inputProduto').value.trim();
    const quantidade = Number(document.getElementById('inputQuantidade').value);

    if (!nomeDigitado) {
        alert('Digite ou selecione um produto.');
        return;
    }

    if (!quantidade || quantidade <= 0) {
        alert('Informe uma quantidade válida.');
        return;
    }

    const produto = produtosCache.find(
        p => p.nome.toLowerCase() === nomeDigitado.toLowerCase()
    );

    if (!produto) {
        alert('Produto não encontrado. Selecione um item da lista.');
        return;
    }

    const itemExistente = carrinho.find(i => i.produto.id === produto.id);

    const quantidadeTotalNoCarrinho = (itemExistente?.quantidade || 0) + quantidade;

    if (quantidadeTotalNoCarrinho > Number(produto.estoque)) {

        if (!confirm(
            `A quantidade (${quantidadeTotalNoCarrinho}) é maior que o estoque disponível (${produto.estoque}). Deseja continuar mesmo assim?`
        )) {
            return;
        }
    }

    if (itemExistente) {
        itemExistente.quantidade += quantidade;
    } else {
        carrinho.push({ produto, quantidade });
    }

    document.getElementById('inputProduto').value = '';
    document.getElementById('inputQuantidade').value = 1;

    renderizarCarrinho();
});


function renderizarCarrinho() {

    const lista = document.getElementById('listaCarrinho');

    if (carrinho.length === 0) {
        lista.innerHTML = '<tr><td colspan="5" class="mensagem">Carrinho vazio</td></tr>';
        atualizarResumo();
        return;
    }

    lista.innerHTML = '';

    carrinho.forEach((item, indice) => {

        const subtotal = item.quantidade * Number(item.produto.preco_venda);

        const linha = document.createElement('tr');

        linha.innerHTML = `
            <td></td>
            <td></td>
            <td><input type="number" min="1" step="1" class="input-qtd-carrinho" value="${item.quantidade}"></td>
            <td></td>
            <td><button type="button" class="btn-remover">Remover</button></td>
        `;

        linha.children[0].textContent = item.produto.nome;
        linha.children[1].textContent = formatarMoeda(item.produto.preco_venda);
        linha.children[3].textContent = formatarMoeda(subtotal);

        linha.querySelector('.input-qtd-carrinho').addEventListener('change', (e) => {

            const novaQtd = Number(e.target.value);

            if (novaQtd <= 0) {
                carrinho.splice(indice, 1);
            } else {
                carrinho[indice].quantidade = novaQtd;
            }

            renderizarCarrinho();
        });

        linha.querySelector('.btn-remover').addEventListener('click', () => {
            carrinho.splice(indice, 1);
            renderizarCarrinho();
        });

        lista.appendChild(linha);
    });

    atualizarResumo();
}


function calcularSubtotalCarrinho() {
    return carrinho.reduce(
        (soma, item) => soma + (item.quantidade * Number(item.produto.preco_venda)),
        0
    );
}


function atualizarResumo() {

    const subtotal = calcularSubtotalCarrinho();
    const desconto = Number(document.getElementById('descontoValor').value) || 0;
    const total = Math.max(subtotal - desconto, 0);

    document.getElementById('resumoSubtotal').textContent = formatarMoeda(subtotal);
    document.getElementById('resumoDesconto').textContent = formatarMoeda(desconto);
    document.getElementById('resumoTotal').textContent = formatarMoeda(total);

    atualizarTroco();
}


document.getElementById('descontoValor').addEventListener('input', atualizarResumo);


// =====================================================
// FORMA DE PAGAMENTO
// =====================================================

document.querySelectorAll('.forma-btn').forEach(botao => {

    botao.addEventListener('click', () => {

        document.querySelectorAll('.forma-btn').forEach(b => b.classList.remove('selecionada'));
        botao.classList.add('selecionada');

        formaPagamentoSelecionada = botao.dataset.forma;

        const blocoDinheiro = document.getElementById('blocoDinheiro');

        if (formaPagamentoSelecionada === 'dinheiro') {
            blocoDinheiro.classList.add('visivel');
        } else {
            blocoDinheiro.classList.remove('visivel');
        }

        atualizarTroco();
    });
});


document.getElementById('valorRecebido').addEventListener('input', atualizarTroco);


function atualizarTroco() {

    const trocoDiv = document.getElementById('trocoCalculado');

    if (formaPagamentoSelecionada !== 'dinheiro') {
        trocoDiv.textContent = '';
        return;
    }

    const subtotal = calcularSubtotalCarrinho();
    const desconto = Number(document.getElementById('descontoValor').value) || 0;
    const total = Math.max(subtotal - desconto, 0);

    const recebido = Number(document.getElementById('valorRecebido').value) || 0;
    const troco = recebido - total;

    if (recebido === 0) {
        trocoDiv.textContent = '';
        return;
    }

    if (troco < 0) {
        trocoDiv.style.color = '#b42318';
        trocoDiv.textContent = `Faltam ${formatarMoeda(Math.abs(troco))}`;
    } else {
        trocoDiv.style.color = '#2f6f4e';
        trocoDiv.textContent = `Troco: ${formatarMoeda(troco)}`;
    }
}


// =====================================================
// FINALIZAR VENDA
// =====================================================

document.getElementById('btnFinalizarVenda').addEventListener('click', async () => {

    if (carrinho.length === 0) {
        alert('Adicione ao menos um produto ao carrinho.');
        return;
    }

    if (!formaPagamentoSelecionada) {
        alert('Selecione a forma de pagamento.');
        return;
    }

    const subtotal = calcularSubtotalCarrinho();
    const desconto = Number(document.getElementById('descontoValor').value) || 0;
    const total = Math.max(subtotal - desconto, 0);

    let valorRecebido = null;
    let troco = null;

    if (formaPagamentoSelecionada === 'dinheiro') {

        valorRecebido = Number(document.getElementById('valorRecebido').value) || 0;
        troco = valorRecebido - total;

        if (valorRecebido < total) {
            alert('O valor recebido é menor que o total da venda.');
            return;
        }
    }

    const clienteNome = document.getElementById('clienteNome').value.trim() || null;

    const botao = document.getElementById('btnFinalizarVenda');
    botao.disabled = true;
    botao.textContent = 'Finalizando...';

    try {

        // 1. Cria a venda
        const { data: venda, error: erroVenda } = await supabaseClient
            .from('vendas')
            .insert({
                cliente_nome: clienteNome,
                desconto: desconto,
                total: total,
                forma_pagamento: formaPagamentoSelecionada,
                valor_recebido: valorRecebido,
                troco: troco,
                operador_id: usuarioAtual.id,
                operador_nome: nomeOperadorAtual,
                status: 'concluida',
                caixa_id: caixaAtual.id
            })
            .select()
            .single();

        if (erroVenda) throw erroVenda;

        // 2. Cria os itens da venda
        const itens = carrinho.map(item => ({
            venda_id: venda.id,
            produto_id: item.produto.id,
            produto_nome: item.produto.nome,
            quantidade: item.quantidade,
            preco_unitario: item.produto.preco_venda,
            subtotal: item.quantidade * Number(item.produto.preco_venda)
        }));

        const { error: erroItens } = await supabaseClient
            .from('venda_itens')
            .insert(itens);

        if (erroItens) throw erroItens;

        // 3. Dá baixa no estoque de cada produto e registra a movimentação
        for (const item of carrinho) {

            const novoEstoque = Number(item.produto.estoque) - item.quantidade;

            await supabaseClient
                .from('produtos')
                .update({ estoque: novoEstoque })
                .eq('id', item.produto.id);

            await supabaseClient
                .from('estoque_movimentacoes')
                .insert({
                    produto_id: item.produto.id,
                    tipo: 'saida',
                    quantidade: -item.quantidade,
                    motivo: `Venda #${venda.id.slice(0, 8)}`,
                    operador_nome: nomeOperadorAtual
                });
        }

        // 4. Registra a movimentação no caixa
        await supabaseClient
            .from('caixa_movimentacoes')
            .insert({
                caixa_id: caixaAtual.id,
                tipo: 'venda',
                valor: total,
                forma_pagamento: formaPagamentoSelecionada,
                descricao: `Venda #${venda.id.slice(0, 8)}${clienteNome ? ' - ' + clienteNome : ''}`,
                venda_id: venda.id
            });

        await registrarAuditoria(
            'acao',
            `Realizou uma venda de ${formatarMoeda(total)} (${rotuloFormaPagamento(formaPagamentoSelecionada)}).`
        );

        alert(
            `Venda finalizada com sucesso!\n\nTotal: ${formatarMoeda(total)}` +
            (troco !== null ? `\nTroco: ${formatarMoeda(troco)}` : '')
        );

        // Reset da tela
        carrinho = [];
        renderizarCarrinho();
        document.getElementById('clienteNome').value = '';
        document.getElementById('descontoValor').value = 0;
        document.getElementById('valorRecebido').value = '';
        document.querySelectorAll('.forma-btn').forEach(b => b.classList.remove('selecionada'));
        document.getElementById('blocoDinheiro').classList.remove('visivel');
        formaPagamentoSelecionada = null;
        atualizarResumo();

        await carregarProdutos();
        await carregarVendasHoje();

    } catch (erro) {

        console.error('Erro ao finalizar venda:', erro);
        alert('Não foi possível finalizar a venda.');

    } finally {

        botao.disabled = false;
        botao.textContent = 'Finalizar venda';
    }
});


function rotuloFormaPagamento(forma) {

    const mapa = {
        dinheiro: 'Dinheiro',
        pix: 'PIX',
        debito: 'Débito',
        credito: 'Crédito'
    };

    return mapa[forma] || forma;
}


// =====================================================
// VENDAS DE HOJE
// =====================================================

async function carregarVendasHoje() {

    const lista = document.getElementById('listaVendasHoje');

    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();

    const { data, error } = await supabaseClient
        .from('vendas')
        .select('id, cliente_nome, total, forma_pagamento, status, created_at')
        .gte('created_at', inicioDia)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar vendas de hoje:', error);
        lista.innerHTML = '<p class="mensagem">Erro ao carregar vendas.</p>';
        return;
    }

    if (!data || data.length === 0) {
        lista.innerHTML = '<p class="mensagem">Nenhuma venda registrada hoje ainda.</p>';
        return;
    }

    lista.innerHTML = '';

    data.forEach(venda => {

        const item = document.createElement('div');
        item.className = 'vendas-hoje-item';

        const hora = new Date(venda.created_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const statusTexto = venda.status === 'cancelada' ? ' (cancelada)' : '';

        item.innerHTML = `
            <span></span>
            <span></span>
        `;

        item.children[0].textContent =
            `${hora} · ${venda.cliente_nome || 'Cliente não informado'}${statusTexto}`;

        item.children[1].textContent =
            `${formatarMoeda(venda.total)} (${rotuloFormaPagamento(venda.forma_pagamento)})`;

        lista.appendChild(item);
    });
}


// =====================================================
// INICIALIZAÇÃO GERAL
// =====================================================

(async function iniciar() {

    const user = await carregarOperadorAtual();

    if (!user) return;

    caixaAtual = await verificarCaixaAberto();

    if (!caixaAtual) {

        document.getElementById('avisoCaixaFechado').style.display = 'block';
        document.getElementById('conteudoVendas').style.display = 'none';
        return;
    }

    document.getElementById('avisoCaixaFechado').style.display = 'none';
    document.getElementById('conteudoVendas').style.display = 'block';

    await carregarProdutos();
    await carregarVendasHoje();

})();
