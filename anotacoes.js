// =====================================================
// MÓDULO DE ANOTAÇÕES - SUPABASE
// =====================================================
// Tabela esperada no Supabase: anotacoes
//   id           uuid (default gen_random_uuid())
//   operador_id  uuid (referência ao operador logado)
//   texto        text
//   created_at   timestamptz (default now())
// =====================================================


let operadorAtual = null;

const operadorInfo = document.getElementById('operadorInfo');
const listaAnotacoes = document.getElementById('listaAnotacoes');
const textoAnotacao = document.getElementById('textoAnotacao');
const btnSalvarAnotacao = document.getElementById('btnSalvarAnotacao');


// =====================================================
// VOLTAR AO PAINEL
// =====================================================

function voltarPainel() {
    window.location.href = 'painel.html';
}


// =====================================================
// CARREGAR OPERADOR LOGADO
// =====================================================

async function carregarOperadorAtual() {

    try {

        const {
            data: { user },
            error
        } = await supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = 'index.html';
            return null;
        }

        const {
            data: operador,
            error: operadorError
        } = await supabaseClient
            .from('operadores')
            .select('id, nome, perfil, ativo')
            .eq('id', user.id)
            .single();

        if (operadorError || !operador) {
            console.error('Erro ao carregar operador:', operadorError);
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
            return null;
        }

        if (!operador.ativo) {
            alert('Seu usuário está inativo.');
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
            return null;
        }

        operadorAtual = operador;

        operadorInfo.textContent = `Operador: ${operador.nome}`;

        return operadorAtual;

    } catch (error) {
        console.error('ERRO AO CARREGAR OPERADOR:', error);
        return null;
    }
}


// =====================================================
// FORMATAR DATA
// =====================================================

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
// CARREGAR ANOTAÇÕES
// =====================================================

async function carregarAnotacoes() {

    listaAnotacoes.innerHTML = '<div class="vazio">Carregando anotações...</div>';

    const {
        data,
        error
    } = await supabaseClient
        .from('anotacoes')
        .select('id, texto, created_at')
        .eq('operador_id', operadorAtual.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('ERRO AO CARREGAR ANOTAÇÕES:', error);
        listaAnotacoes.innerHTML =
            '<div class="vazio">Não foi possível carregar as anotações.</div>';
        return;
    }

    if (!data || data.length === 0) {
        listaAnotacoes.innerHTML =
            '<div class="vazio">Nenhuma anotação registrada ainda.</div>';
        return;
    }

    listaAnotacoes.innerHTML = '';

    data.forEach(anotacao => {

        const card = document.createElement('div');
        card.className = 'anotacao-card';

        card.innerHTML = `
            <div class="data">${formatarData(anotacao.created_at)}</div>
            <div class="texto"></div>
            <div class="rodape">
                <button class="btn-excluir" type="button">Excluir</button>
            </div>
        `;

        // Texto inserido via textContent para evitar problemas de HTML/XSS
        card.querySelector('.texto').textContent = anotacao.texto;

        card.querySelector('.btn-excluir')
            .addEventListener('click', () => excluirAnotacao(anotacao.id));

        listaAnotacoes.appendChild(card);
    });
}


// =====================================================
// CRIAR ANOTAÇÃO
// =====================================================

async function criarAnotacao() {

    const texto = textoAnotacao.value.trim();

    if (!texto) {
        alert('Digite uma anotação antes de salvar.');
        return;
    }

    btnSalvarAnotacao.disabled = true;

    try {

        const {
            error
        } = await supabaseClient
            .from('anotacoes')
            .insert({
                operador_id: operadorAtual.id,
                texto: texto
            });

        if (error) {
            console.error('ERRO AO CRIAR ANOTAÇÃO:', error);
            alert('Não foi possível salvar a anotação.');
            return;
        }

        textoAnotacao.value = '';

        await registrarAuditoria('acao', 'Criou uma anotação.');

        await carregarAnotacoes();

    } finally {
        btnSalvarAnotacao.disabled = false;
    }
}


// =====================================================
// EXCLUIR ANOTAÇÃO
// =====================================================

async function excluirAnotacao(id) {

    if (!confirm('Excluir esta anotação?')) {
        return;
    }

    const {
        error
    } = await supabaseClient
        .from('anotacoes')
        .delete()
        .eq('id', id)
        .eq('operador_id', operadorAtual.id);

    if (error) {
        console.error('ERRO AO EXCLUIR ANOTAÇÃO:', error);
        alert('Não foi possível excluir a anotação.');
        return;
    }

    await registrarAuditoria('acao', 'Excluiu uma anotação.');

    await carregarAnotacoes();
}


// =====================================================
// INICIALIZAÇÃO
// =====================================================

btnSalvarAnotacao.addEventListener('click', criarAnotacao);

(async function iniciar() {

    await carregarOperadorAtual();

    if (operadorAtual) {
        await carregarAnotacoes();
    }
})();
