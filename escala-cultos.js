// =====================================================
// MÓDULO ESCALA DE CULTOS
// =====================================================

const formEscala = document.getElementById('formEscala');
const tituloForm = document.getElementById('tituloForm');
const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
const listaEscalas = document.getElementById('listaEscalas');

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];


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
        linha.children[4].textContent = escala.abertura || '—';
        linha.children[5].textContent = escala.mensagem || '—';

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

    const dados = {
        data: document.getElementById('escalaData').value,
        dia_semana: document.getElementById('escalaDiaSemana').value,
        turno: document.getElementById('escalaTurno').value,
        tipo_culto: document.getElementById('escalaTipoCulto').value.trim(),
        abertura: document.getElementById('escalaAbertura').value.trim() || null,
        mensagem: document.getElementById('escalaMensagem').value.trim() || null
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
        alert('Não foi possível salvar a escala.');

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

    tituloForm.textContent = 'Editar escala';
    btnCancelarEdicao.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {

    formEscala.reset();
    document.getElementById('escalaId').value = '';
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

    await carregarEscalas();

})();
