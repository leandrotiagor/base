// =====================================================
// AUDITORIA - APENAS ADMINISTRADORES
// =====================================================
// Tabela esperada no Supabase: auditoria
//   id             uuid
//   operador_id    uuid
//   operador_nome  text
//   tipo           text ('login' | 'logout' | 'acao')
//   descricao      text
//   created_at     timestamptz
// =====================================================


const listaAuditoria = document.getElementById('listaAuditoria');
const filtroOperador = document.getElementById('filtroOperador');
const filtroTipo = document.getElementById('filtroTipo');
const filtroDataInicio = document.getElementById('filtroDataInicio');
const filtroDataFim = document.getElementById('filtroDataFim');
const btnFiltrar = document.getElementById('btnFiltrar');


// =====================================================
// VERIFICA SE É ADMINISTRADOR
// =====================================================

async function verificarAdministrador() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return null;
    }

    const { data: operador, error: operadorError } = await supabaseClient
        .from('operadores')
        .select('perfil, ativo')
        .eq('id', user.id)
        .single();

    if (operadorError || !operador) {
        alert('Operador não encontrado.');
        window.location.href = 'painel.html';
        return null;
    }

    if (!operador.ativo || operador.perfil !== 'admin') {
        alert('Você não possui permissão para acessar esta área.');
        window.location.href = 'painel.html';
        return null;
    }

    return user;
}


// =====================================================
// CARREGA A LISTA DE OPERADORES PARA O FILTRO
// =====================================================

async function carregarOperadoresFiltro() {

    const {
        data: operadores,
        error
    } = await supabaseClient
        .from('operadores')
        .select('id, nome')
        .order('nome');

    if (error) {
        console.error('Erro ao carregar operadores:', error);
        return;
    }

    (operadores || []).forEach(operador => {

        const option = document.createElement('option');

        option.value = operador.id;
        option.textContent = operador.nome;

        filtroOperador.appendChild(option);
    });
}


// =====================================================
// FORMATA DATA/HORA
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


function rotuloTipo(tipo) {

    if (tipo === 'login') return { texto: 'Login', classe: 'tag-login' };
    if (tipo === 'logout') return { texto: 'Logout', classe: 'tag-logout' };
    return { texto: 'Ação', classe: 'tag-acao' };
}


// =====================================================
// CARREGA OS REGISTROS DE AUDITORIA (COM FILTROS)
// =====================================================

async function carregarAuditoria() {

    listaAuditoria.innerHTML = `
        <tr>
            <td colspan="5" class="mensagem">
                Carregando registros...
            </td>
        </tr>
    `;

    try {

        let consulta = supabaseClient
            .from('auditoria')
            .select('id, operador_id, operador_nome, tipo, descricao, created_at, ip, cidade, regiao, pais, provedor, dispositivo')
            .order('created_at', { ascending: false })
            .limit(500);

        if (filtroOperador.value) {
            consulta = consulta.eq('operador_id', filtroOperador.value);
        }

        if (filtroTipo.value) {
            consulta = consulta.eq('tipo', filtroTipo.value);
        }

        if (filtroDataInicio.value) {
            consulta = consulta.gte(
                'created_at',
                `${filtroDataInicio.value}T00:00:00`
            );
        }

        if (filtroDataFim.value) {
            consulta = consulta.lte(
                'created_at',
                `${filtroDataFim.value}T23:59:59`
            );
        }

        const { data, error } = await consulta;

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {

            listaAuditoria.innerHTML = `
                <tr>
                    <td colspan="5" class="mensagem">
                        Nenhum registro encontrado para os filtros selecionados.
                    </td>
                </tr>
            `;

            return;
        }

        listaAuditoria.innerHTML = '';

        data.forEach(registro => {

            const linha = document.createElement('tr');

            const tag = rotuloTipo(registro.tipo);

            linha.innerHTML = `
                <td>${formatarData(registro.created_at)}</td>
                <td>${registro.operador_nome || '—'}</td>
                <td><span class="tag ${tag.classe}">${tag.texto}</span></td>
                <td class="celula-descricao"></td>
                <td class="celula-detalhes"></td>
            `;

            // Descrição via textContent para evitar HTML indevido
            linha.querySelector('.celula-descricao').textContent = registro.descricao || '';

            const celulaDetalhes = linha.querySelector('.celula-detalhes');

            if (registro.tipo === 'login') {

                const botao = document.createElement('button');

                botao.type = 'button';
                botao.className = 'btn-detalhes';
                botao.textContent = 'Detalhes';

                botao.addEventListener('click', () => abrirDetalhesAcesso(registro));

                celulaDetalhes.appendChild(botao);

            } else {

                celulaDetalhes.innerHTML = '<span class="sem-detalhes">—</span>';
            }

            listaAuditoria.appendChild(linha);
        });

    } catch (erro) {

        console.error('Erro ao carregar auditoria:', erro);

        listaAuditoria.innerHTML = `
            <tr>
                <td colspan="5" class="mensagem">
                    Erro ao carregar os registros de auditoria.
                </td>
            </tr>
        `;
    }
}


btnFiltrar.addEventListener('click', carregarAuditoria);


// =====================================================
// MODAL DE DETALHES DO ACESSO
// =====================================================

function abrirDetalhesAcesso(registro) {

    const modal = document.getElementById('modalDetalhesAcesso');
    const conteudo = document.getElementById('conteudoDetalhesAcesso');

    const localizacao = [registro.cidade, registro.regiao, registro.pais]
        .filter(Boolean)
        .join(' - ');

    const campos = [
        ['Operador', registro.operador_nome || '—'],
        ['Data / Hora', formatarData(registro.created_at)],
        ['Endereço IP', registro.ip || 'Não capturado'],
        ['Localização', localizacao || 'Não capturada'],
        ['Provedor (ISP)', registro.provedor || 'Não capturado'],
        ['Dispositivo', registro.dispositivo || 'Não capturado']
    ];

    conteudo.innerHTML = '';

    campos.forEach(([rotulo, valor]) => {

        const linha = document.createElement('div');
        linha.className = 'linha-detalhe';

        const spanRotulo = document.createElement('span');
        spanRotulo.textContent = rotulo;

        const spanValor = document.createElement('span');
        spanValor.textContent = valor;

        linha.appendChild(spanRotulo);
        linha.appendChild(spanValor);

        conteudo.appendChild(linha);
    });

    modal.style.display = 'flex';
}

function fecharDetalhesAcesso() {
    document.getElementById('modalDetalhesAcesso').style.display = 'none';
}


// =====================================================
// INICIALIZAÇÃO
// =====================================================

(async function iniciar() {

    const user = await verificarAdministrador();

    if (!user) {
        return;
    }

    await carregarOperadoresFiltro();
    await carregarAuditoria();

})();
