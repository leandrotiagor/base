// =====================================================
// MÓDULO IMPRESSÃO
// =====================================================

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarDataHora(dataISO) {
    if (!dataISO) return '—';
    return new Date(dataISO).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function rotuloFormaPagamento(forma) {
    const mapa = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito' };
    return mapa[forma] || forma || '—';
}


// =====================================================
// ABRE UMA JANELA DE IMPRESSÃO COM O CONTEÚDO PRONTO
// =====================================================

function abrirJanelaImpressao(titulo, conteudoHtml, largaEstreita) {

    const janela = window.open('', '_blank', 'width=420,height=700');

    if (!janela) {
        alert('Seu navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
        return;
    }

    const larguraCss = largaEstreita === 'estreita' ? '320px' : '100%';
    const fonteCss = largaEstreita === 'estreita' ? "'Courier New', monospace" : 'Arial, sans-serif';

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>${titulo}</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: ${fonteCss};
                    max-width: ${larguraCss};
                    margin: 0 auto;
                    padding: 16px;
                    color: #111;
                    font-size: 13px;
                }
                h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
                h2 { font-size: 13px; margin: 16px 0 6px; }
                .subtitulo { text-align: center; color: #555; font-size: 11px; margin-bottom: 14px; }
                hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; margin: 8px 0; }
                th, td { text-align: left; padding: 4px 2px; font-size: 12px; }
                th { border-bottom: 1px solid #999; }
                .linha-total {
                    display: flex;
                    justify-content: space-between;
                    font-weight: bold;
                    font-size: 14px;
                    margin-top: 8px;
                    border-top: 1px solid #999;
                    padding-top: 8px;
                }
                .linha-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
                .rodape { margin-top: 20px; text-align: center; font-size: 11px; color: #666; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            ${conteudoHtml}
        </body>
        </html>
    `);

    janela.document.close();

    janela.onload = () => {
        janela.focus();
        janela.print();
    };

    // fallback caso onload não dispare a tempo
    setTimeout(() => {
        try {
            janela.focus();
            janela.print();
        } catch (e) {}
    }, 400);
}


// =====================================================
// 1. COMPROVANTE DE VENDA
// =====================================================

async function carregarVendasImpressao() {

    const lista = document.getElementById('listaVendasImpressao');

    const { data, error } = await supabaseClient
        .from('vendas')
        .select('id, cliente_nome, total, forma_pagamento, status, created_at')
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Erro ao carregar vendas:', error);
        lista.innerHTML = '<tr><td colspan="5" class="mensagem">Erro ao carregar vendas.</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        lista.innerHTML = '<tr><td colspan="5" class="mensagem">Nenhuma venda registrada ainda.</td></tr>';
        return;
    }

    lista.innerHTML = '';

    data.forEach(venda => {

        const linha = document.createElement('tr');

        linha.innerHTML = `
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td><button type="button" class="btn-imprimir-linha">Imprimir</button></td>
        `;

        linha.children[0].textContent = formatarDataHora(venda.created_at);
        linha.children[1].textContent = venda.cliente_nome || '—';
        linha.children[2].textContent = formatarMoeda(venda.total) + (venda.status === 'cancelada' ? ' (cancelada)' : '');
        linha.children[3].textContent = rotuloFormaPagamento(venda.forma_pagamento);

        linha.querySelector('button').addEventListener('click', () => imprimirComprovante(venda.id));

        lista.appendChild(linha);
    });
}


async function imprimirComprovante(vendaId) {

    const { data: venda, error: erroVenda } = await supabaseClient
        .from('vendas')
        .select('*')
        .eq('id', vendaId)
        .single();

    if (erroVenda || !venda) {
        alert('Não foi possível carregar a venda.');
        return;
    }

    const { data: itens, error: erroItens } = await supabaseClient
        .from('venda_itens')
        .select('*')
        .eq('venda_id', vendaId);

    if (erroItens) {
        alert('Não foi possível carregar os itens da venda.');
        return;
    }

    let linhasItens = '';

    (itens || []).forEach(item => {
        linhasItens += `
            <div class="linha-item">
                <span>${item.quantidade}x ${item.produto_nome}</span>
                <span>${formatarMoeda(item.subtotal)}</span>
            </div>
        `;
    });

    const conteudo = `
        <h1>LT Sistemas</h1>
        <div class="subtitulo">Comprovante de Venda</div>
        <hr>
        <div class="linha-item"><span>Data</span><span>${formatarDataHora(venda.created_at)}</span></div>
        <div class="linha-item"><span>Cliente</span><span>${venda.cliente_nome || 'Não informado'}</span></div>
        <div class="linha-item"><span>Operador</span><span>${venda.operador_nome || '—'}</span></div>
        ${venda.status === 'cancelada' ? '<div class="linha-item"><span><strong>VENDA CANCELADA</strong></span><span></span></div>' : ''}
        <hr>
        ${linhasItens}
        <hr>
        <div class="linha-item"><span>Desconto</span><span>${formatarMoeda(venda.desconto)}</span></div>
        <div class="linha-total"><span>TOTAL</span><span>${formatarMoeda(venda.total)}</span></div>
        <hr>
        <div class="linha-item"><span>Pagamento</span><span>${rotuloFormaPagamento(venda.forma_pagamento)}</span></div>
        ${venda.forma_pagamento === 'dinheiro' ? `
            <div class="linha-item"><span>Valor recebido</span><span>${formatarMoeda(venda.valor_recebido)}</span></div>
            <div class="linha-item"><span>Troco</span><span>${formatarMoeda(venda.troco)}</span></div>
        ` : ''}
        <div class="rodape">Obrigado pela preferência!</div>
    `;

    abrirJanelaImpressao('Comprovante de Venda', conteudo, 'estreita');
}


// =====================================================
// 2. RELATÓRIO DO DIA
// =====================================================

document.getElementById('btnRelatorioDia').addEventListener('click', async () => {

    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();

    const { data, error } = await supabaseClient
        .from('vendas')
        .select('*')
        .gte('created_at', inicioDia)
        .order('created_at', { ascending: true });

    if (error) {
        alert('Não foi possível gerar o relatório do dia.');
        console.error(error);
        return;
    }

    const vendas = data || [];
    const vendasValidas = vendas.filter(v => v.status !== 'cancelada');

    const totalGeral = vendasValidas.reduce((soma, v) => soma + Number(v.total), 0);

    const totaisPorForma = {};

    vendasValidas.forEach(v => {
        const forma = v.forma_pagamento || 'outro';
        totaisPorForma[forma] = (totaisPorForma[forma] || 0) + Number(v.total);
    });

    let linhasVendas = '';

    vendas.forEach(v => {
        const hora = new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        linhasVendas += `
            <tr>
                <td>${hora}</td>
                <td>${v.cliente_nome || '—'}</td>
                <td>${rotuloFormaPagamento(v.forma_pagamento)}</td>
                <td>${formatarMoeda(v.total)}${v.status === 'cancelada' ? ' (cancelada)' : ''}</td>
            </tr>
        `;
    });

    let linhasTotaisPorForma = '';

    Object.keys(totaisPorForma).forEach(forma => {
        linhasTotaisPorForma += `
            <div class="linha-item"><span>${rotuloFormaPagamento(forma)}</span><span>${formatarMoeda(totaisPorForma[forma])}</span></div>
        `;
    });

    const conteudo = `
        <h1>LT Sistemas</h1>
        <div class="subtitulo">Relatório do Dia - ${hoje.toLocaleDateString('pt-BR')}</div>
        <hr>
        <h2>Vendas do dia (${vendas.length})</h2>
        <table>
            <thead><tr><th>Hora</th><th>Cliente</th><th>Pagamento</th><th>Total</th></tr></thead>
            <tbody>${linhasVendas || '<tr><td colspan="4">Nenhuma venda hoje.</td></tr>'}</tbody>
        </table>
        <hr>
        <h2>Total por forma de pagamento</h2>
        ${linhasTotaisPorForma || '<div class="linha-item"><span>—</span><span></span></div>'}
        <div class="linha-total"><span>TOTAL GERAL</span><span>${formatarMoeda(totalGeral)}</span></div>
    `;

    abrirJanelaImpressao('Relatório do Dia', conteudo, 'normal');
});


// =====================================================
// 3. FECHAMENTO DE CAIXA
// =====================================================

async function carregarCaixasImpressao() {

    const lista = document.getElementById('listaCaixasImpressao');

    const { data, error } = await supabaseClient
        .from('caixa')
        .select('*')
        .eq('status', 'fechado')
        .order('fechado_em', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Erro ao carregar caixas:', error);
        lista.innerHTML = '<tr><td colspan="5" class="mensagem">Erro ao carregar caixas.</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        lista.innerHTML = '<tr><td colspan="5" class="mensagem">Nenhum caixa fechado ainda.</td></tr>';
        return;
    }

    lista.innerHTML = '';

    data.forEach(caixa => {

        const linha = document.createElement('tr');

        linha.innerHTML = `
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td><button type="button" class="btn-imprimir-linha">Imprimir</button></td>
        `;

        linha.children[0].textContent = formatarDataHora(caixa.aberto_em);
        linha.children[1].textContent = formatarDataHora(caixa.fechado_em);
        linha.children[2].textContent = caixa.operador_nome || '—';
        linha.children[3].textContent = formatarMoeda(caixa.diferenca);

        linha.querySelector('button').addEventListener('click', () => imprimirFechamentoCaixa(caixa));

        lista.appendChild(linha);
    });
}


function imprimirFechamentoCaixa(caixa) {

    const conteudo = `
        <h1>LT Sistemas</h1>
        <div class="subtitulo">Fechamento de Caixa</div>
        <hr>
        <div class="linha-item"><span>Operador</span><span>${caixa.operador_nome || '—'}</span></div>
        <div class="linha-item"><span>Aberto em</span><span>${formatarDataHora(caixa.aberto_em)}</span></div>
        <div class="linha-item"><span>Fechado em</span><span>${formatarDataHora(caixa.fechado_em)}</span></div>
        <hr>
        <div class="linha-item"><span>Valor de abertura</span><span>${formatarMoeda(caixa.valor_abertura)}</span></div>
        <div class="linha-item"><span>Saldo esperado</span><span>${formatarMoeda(caixa.saldo_esperado)}</span></div>
        <div class="linha-item"><span>Valor contado</span><span>${formatarMoeda(caixa.valor_fechamento)}</span></div>
        <div class="linha-total"><span>DIFERENÇA</span><span>${formatarMoeda(caixa.diferenca)}</span></div>
    `;

    abrirJanelaImpressao('Fechamento de Caixa', conteudo, 'estreita');
}


// =====================================================
// 4. RELATÓRIO DE ESTOQUE
// =====================================================

document.getElementById('btnRelatorioEstoque').addEventListener('click', async () => {

    const { data, error } = await supabaseClient
        .from('produtos')
        .select('*')
        .order('nome');

    if (error) {
        alert('Não foi possível gerar o relatório de estoque.');
        console.error(error);
        return;
    }

    const produtos = data || [];

    let linhas = '';

    produtos.forEach(p => {

        const baixo = Number(p.estoque) <= Number(p.estoque_minimo);

        linhas += `
            <tr>
                <td>${p.nome}</td>
                <td>${p.categoria || '—'}</td>
                <td>${p.estoque}</td>
                <td>${p.estoque_minimo}</td>
                <td>${!p.ativo ? 'Inativo' : (baixo ? 'BAIXO' : 'OK')}</td>
            </tr>
        `;
    });

    const conteudo = `
        <h1>LT Sistemas</h1>
        <div class="subtitulo">Relatório de Estoque - ${new Date().toLocaleDateString('pt-BR')}</div>
        <hr>
        <table>
            <thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Mínimo</th><th>Situação</th></tr></thead>
            <tbody>${linhas || '<tr><td colspan="5">Nenhum produto cadastrado.</td></tr>'}</tbody>
        </table>
    `;

    abrirJanelaImpressao('Relatório de Estoque', conteudo, 'normal');
});


// =====================================================
// INICIALIZAÇÃO
// =====================================================

(async function iniciar() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return;
    }

    await carregarVendasImpressao();
    await carregarCaixasImpressao();

})();
