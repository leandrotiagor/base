// =====================================================
// MÓDULO ESCALA DE CULTOS
// =====================================================

const formEscala = document.getElementById('formEscala');
const tituloForm = document.getElementById('tituloForm');
const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
const listaEscalas = document.getElementById('listaEscalas');
const escalaAvisoEspecial = document.getElementById('escalaAvisoEspecial');
const blocoNomes = document.getElementById('blocoNomes');
const blocoTextoEspecial = document.getElementById('blocoTextoEspecial');

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ORDEM_TURNO = { 'Manhã': 0, 'Tarde': 1, 'Noite': 2 };


// =====================================================
// ALTERNAR ENTRE "NOMES" E "AVISO ESPECIAL"
// =====================================================

escalaAvisoEspecial.addEventListener('change', () => {

    if (escalaAvisoEspecial.checked) {
        blocoNomes.style.display = 'none';
        blocoTextoEspecial.style.display = 'block';
    } else {
        blocoNomes.style.display = 'grid';
        blocoTextoEspecial.style.display = 'none';
    }
});


// =====================================================
// AUTO-PREENCHER DIA DA SEMANA A PARTIR DA DATA
// =====================================================

document.getElementById('escalaData').addEventListener('change', (evento) => {

    if (!evento.target.value) return;

    // Evita problema de fuso horário ao interpretar "YYYY-MM-DD"
    const [ano, mes, dia] = evento.target.value.split('-').map(Number);
    const dataEscolhida = new Date(ano, mes - 1, dia);

    document.getElementById('escalaDiaSemana').value = DIAS_SEMANA[dataEscolhida.getDay()];
});


// =====================================================
// CARREGAR ESCALAS
// =====================================================

async function carregarEscalas() {

    listaEscalas.innerHTML = '<tr><td colspan="7" class="mensagem">Carregando escalas...</td></tr>';

    const { data, error } = await supabaseClient
        .from('escalas_culto')
        .select('*')
        .order('data', { ascending: true });

    if (error) {
        console.error('Erro ao carregar escalas:', error);
        listaEscalas.innerHTML = '<tr><td colspan="7" class="mensagem">Erro ao carregar escalas.</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        listaEscalas.innerHTML = '<tr><td colspan="7" class="mensagem">Nenhuma escala cadastrada ainda.</td></tr>';
        return;
    }

    listaEscalas.innerHTML = '';

    data.forEach(escala => {

        const linha = document.createElement('tr');

        linha.innerHTML = `
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>
                <button type="button" class="btn-acao btn-editar">Editar</button>
                <button type="button" class="btn-acao-excluir btn-excluir">Excluir</button>
            </td>
        `;

        linha.children[0].textContent = formatarDataBR(escala.data);
        linha.children[1].textContent = escala.dia_semana || '—';
        linha.children[2].textContent = escala.turno || '—';
        linha.children[3].textContent = escala.tipo_culto || '—';

        if (escala.texto_especial) {
            linha.children[4].textContent = escala.texto_especial;
            linha.children[4].colSpan = 2;
            linha.children[5].remove();
        } else {
            linha.children[4].textContent = escala.abertura || '—';
            linha.children[5].textContent = escala.mensagem || '—';
        }

        linha.querySelector('.btn-editar').addEventListener('click', () => preencherParaEdicao(escala));
        linha.querySelector('.btn-excluir').addEventListener('click', () => excluirEscala(escala));

        listaEscalas.appendChild(linha);
    });
}


function formatarDataBR(dataISO) {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}


// =====================================================
// SALVAR (CRIAR OU EDITAR)
// =====================================================

formEscala.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    const id = document.getElementById('escalaId').value;
    const ehAvisoEspecial = escalaAvisoEspecial.checked;

    const dados = {
        data: document.getElementById('escalaData').value,
        dia_semana: document.getElementById('escalaDiaSemana').value,
        turno: document.getElementById('escalaTurno').value,
        tipo_culto: document.getElementById('escalaTipoCulto').value.trim(),
        abertura: ehAvisoEspecial ? null : (document.getElementById('escalaAbertura').value.trim() || null),
        mensagem: ehAvisoEspecial ? null : (document.getElementById('escalaMensagem').value.trim() || null),
        texto_especial: ehAvisoEspecial ? (document.getElementById('escalaTextoEspecial').value.trim() || null) : null
    };

    if (!dados.data || !dados.tipo_culto) {
        alert('Preencha ao menos a data e o tipo de culto.');
        return;
    }

    const botao = document.getElementById('btnSalvarEscala');
    botao.disabled = true;

    try {

        if (id) {

            const { error } = await supabaseClient
                .from('escalas_culto')
                .update(dados)
                .eq('id', id);

            if (error) throw error;

            await registrarAuditoria('acao', `Editou a escala de culto de ${formatarDataBR(dados.data)} (${dados.tipo_culto}).`);

        } else {

            const {
                data: { user }
            } = await supabaseClient.auth.getUser();

            let nomeOperador = null;

            try {
                const { data: op } = await supabaseClient
                    .from('operadores')
                    .select('nome')
                    .eq('id', user.id)
                    .single();
                nomeOperador = op?.nome || null;
            } catch (e) {}

            const { error } = await supabaseClient
                .from('escalas_culto')
                .insert({
                    ...dados,
                    operador_id: user.id,
                    operador_nome: nomeOperador
                });

            if (error) throw error;

            await registrarAuditoria('acao', `Cadastrou uma escala de culto para ${formatarDataBR(dados.data)} (${dados.tipo_culto}).`);
        }

        cancelarEdicao();

        await carregarEscalas();

    } catch (erro) {

        console.error('Erro ao salvar escala:', erro);
        alert('Não foi possível salvar a escala.\n\nDetalhes: ' + (erro.message || JSON.stringify(erro)));

    } finally {

        botao.disabled = false;
    }
});


// =====================================================
// EDITAR / CANCELAR
// =====================================================

function preencherParaEdicao(escala) {

    document.getElementById('escalaId').value = escala.id;
    document.getElementById('escalaData').value = escala.data;
    document.getElementById('escalaDiaSemana').value = escala.dia_semana || 'Domingo';
    document.getElementById('escalaTurno').value = escala.turno || 'Manhã';
    document.getElementById('escalaTipoCulto').value = escala.tipo_culto || '';
    document.getElementById('escalaAbertura').value = escala.abertura || '';
    document.getElementById('escalaMensagem').value = escala.mensagem || '';
    document.getElementById('escalaTextoEspecial').value = escala.texto_especial || '';

    escalaAvisoEspecial.checked = !!escala.texto_especial;
    escalaAvisoEspecial.dispatchEvent(new Event('change'));

    tituloForm.textContent = 'Editar escala';
    btnCancelarEdicao.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {

    formEscala.reset();
    document.getElementById('escalaId').value = '';
    escalaAvisoEspecial.checked = false;
    escalaAvisoEspecial.dispatchEvent(new Event('change'));
    tituloForm.textContent = 'Nova escala';
    btnCancelarEdicao.style.display = 'none';
}

btnCancelarEdicao.addEventListener('click', cancelarEdicao);


// =====================================================
// EXCLUIR
// =====================================================

async function excluirEscala(escala) {

    if (!confirm(`Excluir a escala de ${formatarDataBR(escala.data)} (${escala.tipo_culto})?`)) {
        return;
    }

    const { error } = await supabaseClient
        .from('escalas_culto')
        .delete()
        .eq('id', escala.id);

    if (error) {
        console.error('Erro ao excluir escala:', error);
        alert('Não foi possível excluir a escala.');
        return;
    }

    await registrarAuditoria('acao', `Excluiu a escala de culto de ${formatarDataBR(escala.data)} (${escala.tipo_culto}).`);

    await carregarEscalas();
}


// =====================================================
// IMPRESSÃO - 2 SEMANAS NO FORMATO DA PLANILHA
// =====================================================

document.getElementById('btnImprimirEscala').addEventListener('click', async () => {

    const dataInicioInput = document.getElementById('dataInicioImpressao').value;

    if (!dataInicioInput) {
        alert('Escolha a data de início da impressão.');
        return;
    }

    const [ano, mes, dia] = dataInicioInput.split('-').map(Number);
    const dataInicio = new Date(ano, mes - 1, dia);

    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataInicio.getDate() + 13); // 14 dias = 2 semanas

    const dataInicioISO = paraISO(dataInicio);
    const dataFimISO = paraISO(dataFim);

    const { data, error } = await supabaseClient
        .from('escalas_culto')
        .select('*')
        .gte('data', dataInicioISO)
        .lte('data', dataFimISO)
        .order('data', { ascending: true });

    if (error) {
        console.error('Erro ao buscar escalas para impressão:', error);
        alert('Não foi possível carregar as escalas para impressão.');
        return;
    }

    if (!data || data.length === 0) {
        alert('Nenhuma escala cadastrada nesse período de 2 semanas.');
        return;
    }

    // Ordena por data e, dentro do mesmo dia, por turno (Manhã, Tarde, Noite)
    data.sort((a, b) => {
        if (a.data !== b.data) return a.data.localeCompare(b.data);
        return (ORDEM_TURNO[a.turno] ?? 9) - (ORDEM_TURNO[b.turno] ?? 9);
    });

    // Separa semana 1 (primeiros 7 dias corridos) e semana 2 (dias 8 a 14)
    const semana1 = [];
    const semana2 = [];

    data.forEach(item => {
        const diffDias = Math.round((new Date(item.data + 'T00:00:00') - dataInicio) / 86400000);
        if (diffDias <= 6) semana1.push(item);
        else semana2.push(item);
    });

    gerarImpressaoEscala(dataInicio, dataFim, semana1, semana2);
});


function paraISO(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function formatarDataCurta(dataISO) {
    const [, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}`;
}


function linhaTabelaImpressao(escala, sombreada) {

    const corFundo = sombreada ? 'background:#d9d9d9;' : '';

    if (escala.texto_especial) {

        return `
            <tr style="${corFundo}">
                <td><strong>${(escala.dia_semana || '').toUpperCase()}-FEIRA</strong></td>
                <td>${(escala.turno || '').toUpperCase()}</td>
                <td>${formatarDataBRCompleta(escala.data)}</td>
                <td colspan="2" style="text-align:center;"><strong>${escaparHtml(escala.texto_especial)}</strong></td>
            </tr>
        `;
    }

    return `
        <tr style="${corFundo}">
            <td><strong>${(escala.dia_semana || '').toUpperCase()}${escala.dia_semana === 'Sábado' || escala.dia_semana === 'Domingo' ? '' : '-FEIRA'}</strong></td>
            <td>${(escala.turno || '').toUpperCase()}</td>
            <td>${formatarDataBRCompleta(escala.data)}</td>
            <td>${escaparHtml(escala.abertura || '')}</td>
            <td>${escaparHtml(escala.mensagem || '')}</td>
        </tr>
    `;
}

function formatarDataBRCompleta(dataISO) {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}


function gerarImpressaoEscala(dataInicio, dataFim, semana1, semana2) {

    let linhasSemana1 = '';
    semana1.forEach((item, indice) => {
        linhasSemana1 += linhaTabelaImpressao(item, indice % 4 >= 2);
    });

    let linhasSemana2 = '';
    semana2.forEach((item, indice) => {
        linhasSemana2 += linhaTabelaImpressao(item, indice % 4 >= 2);
    });

    const periodoTexto = `${formatarDataCurta(paraISO(dataInicio))} À ${formatarDataCurta(paraISO(dataFim))}`;

    const janela = window.open('', '_blank');

    if (!janela) {
        alert('Seu navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
        return;
    }

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Escala de Cultos - ${periodoTexto}</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    color: #111;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    border: 2px solid #000;
                }
                td, th {
                    border: 1px solid #000;
                    padding: 8px 10px;
                    font-size: 13px;
                }
                .cabecalho-topo td {
                    background: #a9d18e;
                    text-align: center;
                    font-weight: bold;
                    font-size: 16px;
                    padding: 12px;
                }
                .titulo-escala td {
                    background: #222;
                    color: #fff;
                    text-align: center;
                    font-weight: bold;
                    font-size: 15px;
                    padding: 10px;
                }
                .cabecalho-colunas td {
                    background: #375623;
                    color: #fff;
                    text-align: center;
                    font-weight: bold;
                }
                .linha-espaco td {
                    background: #a9d18e;
                    padding: 14px;
                    border: 1px solid #000;
                }
                .linha-divisor td {
                    background: #8faadc;
                    padding: 10px;
                    border: 1px solid #000;
                }
                .rodape-versiculo td {
                    text-align: center;
                    font-weight: bold;
                    font-size: 13px;
                    padding: 14px;
                }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>

            <table>

                <tr class="cabecalho-topo">
                    <td colspan="3">IGREJA PENTECOSTAL DE JESUS CRISTO</td>
                    <td colspan="2">${periodoTexto}</td>
                </tr>

                <tr class="titulo-escala">
                    <td colspan="5">ESCALA DOS CULTOS - IPJC SEDE</td>
                </tr>

                <tr class="cabecalho-colunas">
                    <td>DIA DA SEMANA</td>
                    <td>TURNO</td>
                    <td>DATA</td>
                    <td>ABERTURA</td>
                    <td>MENSAGEM</td>
                </tr>

                ${linhasSemana1}

                <tr class="linha-espaco"><td colspan="5"></td></tr>
                <tr class="linha-divisor"><td colspan="5"></td></tr>

                ${linhasSemana2}

                <tr class="linha-espaco"><td colspan="5"></td></tr>

                <tr class="rodape-versiculo">
                    <td colspan="5">
                        "Portanto, meus amados irmãos, sede firmes e constantes, sempre abundantes na
                        obra do Senhor, sabendo que o vosso trabalho não é vão no Senhor." — 1 Coríntios 15:58
                    </td>
                </tr>

            </table>

        </body>
        </html>
    `);

    janela.document.close();

    janela.onload = () => {
        janela.focus();
        janela.print();
    };

    setTimeout(() => {
        try {
            janela.focus();
            janela.print();
        } catch (e) {}
    }, 400);
}


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

    // Sugere a próxima segunda-feira como data padrão de impressão
    const hoje = new Date();
    const diaSemanaHoje = hoje.getDay();
    const diasAteSegunda = diaSemanaHoje === 1 ? 0 : ((8 - diaSemanaHoje) % 7 || 7);
    const proximaSegunda = new Date(hoje);
    proximaSegunda.setDate(hoje.getDate() + (diaSemanaHoje === 0 ? 1 : diasAteSegunda));
    document.getElementById('dataInicioImpressao').value = paraISO(proximaSegunda);

    await carregarEscalas();

})();
