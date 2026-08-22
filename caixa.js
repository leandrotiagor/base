// =====================================================
// MÓDULO CAIXA
// =====================================================

let usuarioAtual = null;
let nomeOperadorAtual = null;
let caixaAtual = null;


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


// =====================================================
// VERIFICA SE EXISTE CAIXA ABERTO (POR OPERADOR)
// =====================================================

async function verificarCaixaAberto() {

    const { data, error } = await supabaseClient
        .from('caixa')
        .select('*')
        .eq('status', 'aberto')
        .eq('operador_id', usuarioAtual.id)
        .order('aberto_em', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Erro ao verificar caixa:', error);
        return null;
    }

    return data;
}


function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarDataHora(dataISO) {
    return new Date(dataISO).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}


// =====================================================
// CALCULA O SALDO ESPERADO EM DINHEIRO
// =====================================================

async function calcularSaldoEsperado(caixa) {

    const { data: movimentacoes, error } = await supabaseClient
        .from('caixa_movimentacoes')
        .select('*')
        .eq('caixa_id', caixa.id);

    if (error) {
        console.error('Erro ao calcular saldo:', error);
        return Number(caixa.valor_abertura);
    }

    let saldo = Number(caixa.valor_abertura);

    (movimentacoes || []).forEach(mov => {

        if (mov.tipo === 'entrada') {
            saldo += Number(mov.valor);
        } else if (mov.tipo === 'saida') {
            saldo -= Number(mov.valor);
        } else if (mov.tipo === 'venda' && mov.forma_pagamento === 'dinheiro') {
            saldo += Number(mov.valor);
        }
    });

    return saldo;
}


// =====================================================
// RENDERIZAÇÃO DA TELA
// =====================================================

async function renderizarTela() {

    caixaAtual = await verificarCaixaAberto();

    const blocoAbrir = document.getElementById('blocoAbrirCaixa');
    const blocoAberto = document.getElementById('blocoCaixaAberto');

    if (!caixaAtual) {

        blocoAbrir.style.display = 'block';
        blocoAberto.style.display = 'none';
        return;
    }

    blocoAbrir.style.display = 'none';
    blocoAberto.style.display = 'block';

    document.getElementById('infoOperador').textContent = caixaAtual.operador_nome || '—';
    document.getElementById('infoAbertoEm').textContent = formatarDataHora(caixaAtual.aberto_em);
    document.getElementById('infoValorAbertura').textContent = formatarMoeda(caixaAtual.valor_abertura);

    const saldoEsperado = await calcularSaldoEsperado(caixaAtual);

    document.getElementById('infoSaldoEsperado').textContent = formatarMoeda(saldoEsperado);

    await carregarMovimentacoes();
}


// =====================================================
// ABRIR CAIXA
// =====================================================

document.getElementById('formAbrirCaixa').addEventListener('submit', async (event) => {

    event.preventDefault();

    const valorAbertura = Number(document.getElementById('valorAbertura').value);

    const botao = event.target.querySelector('button[type="submit"]');
    botao.disabled = true;

    try {

        const { error } = await supabaseClient
            .from('caixa')
            .insert({
                operador_id: usuarioAtual.id,
                operador_nome: nomeOperadorAtual,
                valor_abertura: valorAbertura,
                status: 'aberto'
            });

        if (error) throw error;

        await registrarAuditoria('acao', `Abriu o caixa com valor inicial de ${formatarMoeda(valorAbertura)}.`);

        document.getElementById('formAbrirCaixa').reset();

        await renderizarTela();

    } catch (erro) {

        console.error('Erro ao abrir caixa:', erro);
        alert('Não foi possível abrir o caixa.');

    } finally {

        botao.disabled = false;
    }
});


// =====================================================
// MOVIMENTAÇÃO MANUAL (ENTRADA / SAÍDA)
// =====================================================

document.getElementById('formMovimentacaoCaixa').addEventListener('submit', async (event) => {

    event.preventDefault();

    if (!caixaAtual) return;

    const tipo = document.getElementById('movCaixaTipo').value;
    const valor = Number(document.getElementById('movCaixaValor').value);
    const descricao = document.getElementById('movCaixaDescricao').value.trim();

    const botao = event.target.querySelector('button[type="submit"]');
    botao.disabled = true;

    try {

        const { error } = await supabaseClient
            .from('caixa_movimentacoes')
            .insert({
                caixa_id: caixaAtual.id,
                tipo: tipo,
                valor: valor,
                descricao: descricao || null
            });

        if (error) throw error;

        await registrarAuditoria(
            'acao',
            `Registrou ${tipo === 'entrada' ? 'uma entrada' : 'uma saída'} de ${formatarMoeda(valor)} no caixa.`
        );

        document.getElementById('formMovimentacaoCaixa').reset();
        rastreadorMovCaixa.marcarLimpo();

        await renderizarTela();

    } catch (erro) {

        console.error('Erro ao registrar movimentação:', erro);
        alert('Não foi possível registrar a movimentação.');

    } finally {

        botao.disabled = false;
    }
});


// =====================================================
// LISTA DE MOVIMENTAÇÕES DA SESSÃO ATUAL
// =====================================================

async function carregarMovimentacoes() {

    const lista = document.getElementById('listaMovimentacoesCaixa');

    lista.innerHTML = '<tr><td colspan="4" class="mensagem">Carregando...</td></tr>';

    const { data, error } = await supabaseClient
        .from('caixa_movimentacoes')
        .select('*')
        .eq('caixa_id', caixaAtual.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar movimentações:', error);
        lista.innerHTML = '<tr><td colspan="4" class="mensagem">Erro ao carregar movimentações.</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        lista.innerHTML = '<tr><td colspan="4" class="mensagem">Nenhuma movimentação registrada ainda.</td></tr>';
        return;
    }

    lista.innerHTML = '';

    data.forEach(mov => {

        const tagClasse =
            mov.tipo === 'entrada' ? 'tag-entrada' :
            mov.tipo === 'saida' ? 'tag-saida' : 'tag-venda';

        const tagTexto =
            mov.tipo === 'entrada' ? 'Entrada' :
            mov.tipo === 'saida' ? 'Saída' :
            `Venda (${rotuloFormaPagamento(mov.forma_pagamento)})`;

        const linha = document.createElement('tr');

        linha.innerHTML = `
            <td></td>
            <td><span class="tag ${tagClasse}">${tagTexto}</span></td>
            <td></td>
            <td></td>
        `;

        linha.children[0].textContent = formatarDataHora(mov.created_at);
        linha.children[2].textContent = mov.descricao || '—';

        const valorExibicao = mov.tipo === 'saida' ? -Math.abs(Number(mov.valor)) : Number(mov.valor);

        linha.children[3].textContent =
            (valorExibicao < 0 ? '- ' : '+ ') + formatarMoeda(Math.abs(valorExibicao));

        lista.appendChild(linha);
    });
}


function rotuloFormaPagamento(forma) {

    const mapa = {
        dinheiro: 'Dinheiro',
        pix: 'PIX',
        debito: 'Débito',
        credito: 'Crédito'
    };

    return mapa[forma] || forma || '—';
}


// =====================================================
// FECHAR CAIXA
// =====================================================

document.getElementById('formFecharCaixa').addEventListener('submit', async (event) => {

    event.preventDefault();

    if (!caixaAtual) return;

    const valorContado = Number(document.getElementById('valorContado').value);

    if (!confirm('Confirmar o fechamento do caixa? Essa ação não pode ser desfeita.')) {
        return;
    }

    const botao = event.target.querySelector('button[type="submit"]');
    botao.disabled = true;

    try {

        const saldoEsperado = await calcularSaldoEsperado(caixaAtual);
        const diferenca = valorContado - saldoEsperado;

        const { error } = await supabaseClient
            .from('caixa')
            .update({
                status: 'fechado',
                valor_fechamento: valorContado,
                saldo_esperado: saldoEsperado,
                diferenca: diferenca,
                fechado_em: new Date().toISOString()
            })
            .eq('id', caixaAtual.id);

        if (error) throw error;

        await registrarAuditoria(
            'acao',
            `Fechou o caixa. Saldo esperado: ${formatarMoeda(saldoEsperado)}, contado: ${formatarMoeda(valorContado)}, diferença: ${formatarMoeda(diferenca)}.`
        );

        let mensagem = `Caixa fechado com sucesso!\n\nSaldo esperado: ${formatarMoeda(saldoEsperado)}\nValor contado: ${formatarMoeda(valorContado)}\nDiferença: ${formatarMoeda(diferenca)}`;

        if (diferenca !== 0) {
            mensagem += diferenca > 0
                ? '\n\n⚠️ Há sobra de caixa.'
                : '\n\n⚠️ Há falta de caixa.';
        }

        alert(mensagem);

        document.getElementById('formFecharCaixa').reset();
        rastreadorFecharCaixa.marcarLimpo();

        await renderizarTela();

    } catch (erro) {

        console.error('Erro ao fechar caixa:', erro);
        alert('Não foi possível fechar o caixa.');

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

    await renderizarTela();

})();


// =====================================================
// AVISO ANTES DE SAIR COM FORMULÁRIO NÃO SALVO
// =====================================================

const rastreadorMovCaixa = rastrearFormularioSujo('formMovimentacaoCaixa');
const rastreadorFecharCaixa = rastrearFormularioSujo('formFecharCaixa');

avisarAntesDeSair(() =>
    rastreadorMovCaixa.estaSujo() || rastreadorFecharCaixa.estaSujo()
);
