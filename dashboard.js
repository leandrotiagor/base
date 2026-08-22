// =====================================================
// MÓDULO DASHBOARD
// =====================================================

let graficoVendasPorDia = null;
let graficoMaisVendidos = null;


function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}


async function carregarDashboard() {

    const dias = Number(document.getElementById('filtroPeriodo').value);

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - (dias - 1));
    dataInicio.setHours(0, 0, 0, 0);

    // 1. Busca as vendas do período (ignora canceladas)
    const { data: vendas, error: erroVendas } = await supabaseClient
        .from('vendas')
        .select('id, total, created_at')
        .neq('status', 'cancelada')
        .gte('created_at', dataInicio.toISOString())
        .order('created_at', { ascending: true });

    if (erroVendas) {
        console.error('Erro ao carregar vendas:', erroVendas);
        return;
    }

    const idsVendas = (vendas || []).map(v => v.id);

    // 2. Busca os itens dessas vendas (para produtos mais vendidos e lucro)
    let itens = [];

    if (idsVendas.length > 0) {

        const { data: itensData, error: erroItens } = await supabaseClient
            .from('venda_itens')
            .select('produto_id, produto_nome, quantidade, subtotal')
            .in('venda_id', idsVendas);

        if (erroItens) {
            console.error('Erro ao carregar itens de venda:', erroItens);
        } else {
            itens = itensData || [];
        }
    }

    // 3. Busca o preço de custo atual dos produtos (para estimar o lucro)
    const { data: produtos, error: erroProdutos } = await supabaseClient
        .from('produtos')
        .select('id, preco_custo');

    if (erroProdutos) {
        console.error('Erro ao carregar produtos:', erroProdutos);
    }

    const custoPorProduto = {};
    (produtos || []).forEach(p => { custoPorProduto[p.id] = Number(p.preco_custo) || 0; });


    // =====================================================
    // CARDS DE RESUMO
    // =====================================================

    const faturamento = (vendas || []).reduce((soma, v) => soma + Number(v.total), 0);

    const lucroEstimado = itens.reduce((soma, item) => {
        const custo = (custoPorProduto[item.produto_id] || 0) * Number(item.quantidade);
        return soma + (Number(item.subtotal) - custo);
    }, 0);

    const numeroVendas = (vendas || []).length;
    const ticketMedio = numeroVendas > 0 ? faturamento / numeroVendas : 0;

    document.getElementById('cardFaturamento').textContent = formatarMoeda(faturamento);
    document.getElementById('cardLucro').textContent = formatarMoeda(lucroEstimado);
    document.getElementById('cardNumeroVendas').textContent = numeroVendas;
    document.getElementById('cardTicketMedio').textContent = formatarMoeda(ticketMedio);


    // =====================================================
    // GRÁFICO: VENDAS POR DIA
    // =====================================================

    const totalPorDia = {};

    // Garante que todos os dias do período apareçam, mesmo sem venda
    for (let i = 0; i < dias; i++) {
        const dia = new Date(dataInicio);
        dia.setDate(dia.getDate() + i);
        const chave = dia.toLocaleDateString('pt-BR');
        totalPorDia[chave] = 0;
    }

    (vendas || []).forEach(v => {
        const chave = new Date(v.created_at).toLocaleDateString('pt-BR');
        totalPorDia[chave] = (totalPorDia[chave] || 0) + Number(v.total);
    });

    const labelsDias = Object.keys(totalPorDia);
    const valoresDias = Object.values(totalPorDia);

    const ctxDias = document.getElementById('graficoVendasPorDia').getContext('2d');

    if (graficoVendasPorDia) {
        graficoVendasPorDia.destroy();
    }

    graficoVendasPorDia = new Chart(ctxDias, {
        type: 'bar',
        data: {
            labels: labelsDias,
            datasets: [{
                label: 'Vendas (R$)',
                data: valoresDias,
                backgroundColor: '#168c8c'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    ticks: {
                        callback: (valor) => formatarMoeda(valor)
                    }
                }
            }
        }
    });


    // =====================================================
    // GRÁFICO: PRODUTOS MAIS VENDIDOS (TOP 5)
    // =====================================================

    const quantidadePorProduto = {};

    itens.forEach(item => {
        const nome = item.produto_nome || 'Produto removido';
        quantidadePorProduto[nome] = (quantidadePorProduto[nome] || 0) + Number(item.quantidade);
    });

    const top5 = Object.entries(quantidadePorProduto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const ctxMaisVendidos = document.getElementById('graficoMaisVendidos').getContext('2d');

    if (graficoMaisVendidos) {
        graficoMaisVendidos.destroy();
    }

    graficoMaisVendidos = new Chart(ctxMaisVendidos, {
        type: 'bar',
        data: {
            labels: top5.map(item => item[0]),
            datasets: [{
                label: 'Quantidade vendida',
                data: top5.map(item => item[1]),
                backgroundColor: '#4338ca'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}


document.getElementById('filtroPeriodo').addEventListener('change', carregarDashboard);


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

    await carregarDashboard();

})();
