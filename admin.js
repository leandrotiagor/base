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
        console.error('Erro ao encontrar operador:', operadorError);
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


async function carregarOperadores() {

    const tabela = document.getElementById('listaOperadores');

    tabela.innerHTML = `
        <tr>
            <td colspan="5">Carregando operadores...</td>
        </tr>
    `;

    try {

        const {
            data: operadores,
            error
        } = await supabaseClient
            .from('operadores')
            .select('id, nome, cpf, perfil, ativo')
            .order('nome');

        console.log('RESULTADO OPERADORES:', operadores);
        console.log('ERRO OPERADORES:', error);

        if (error) {
            throw error;
        }

        tabela.innerHTML = '';

        if (!operadores || operadores.length === 0) {

            tabela.innerHTML = `
                <tr>
                    <td colspan="5">
                        Nenhum operador cadastrado.
                    </td>
                </tr>
            `;

            return;
        }

        operadores.forEach(operador => {

            const linha = document.createElement('tr');

            linha.innerHTML = `
                <td>${operador.nome}</td>

                <td>${operador.cpf}</td>

                <td>${operador.perfil}</td>

                <td>
                    ${
                        operador.ativo
                            ? '<span class="status ativo">● Ativo</span>'
                            : '<span class="status inativo">● Inativo</span>'
                    }
                </td>

                <td>

    <button
        class="btn-editar"
        onclick="abrirEdicaoOperador(
            '${operador.id}'
        )">
        ✏️ Editar
    </button>

    <button
    class="btn-resetar"
    onclick="resetarSenhaOperador(
        '${operador.id}',
        '${operador.nome.replace(/'/g, "\\'")}'
    )">
    🔑 Resetar senha
</button>

</td>
            `;

            tabela.appendChild(linha);
        });

    } catch (erro) {

        console.error(
            'Erro ao carregar operadores:',
            erro
        );

        tabela.innerHTML = `
            <tr>
                <td colspan="5">
                    Erro ao carregar operadores.
                </td>
            </tr>
        `;
    }
}


document.getElementById('btnVoltar').addEventListener('click', () => {
    window.location.href = 'painel.html';
});


async function iniciarAdministracao() {

    const user = await verificarAdministrador();

    if (!user) {
        return;
    }

    await carregarOperadores();
}


const modalOperador = document.getElementById('modalOperador');
const btnNovoOperador = document.getElementById('btnNovoOperador');
const btnFecharModal = document.getElementById('btnFecharModal');
const btnCancelarOperador = document.getElementById('btnCancelarOperador');
const formOperador = document.getElementById('formOperador');


btnNovoOperador.addEventListener('click', () => {

    modalOperador.style.display = 'flex';

});


function fecharModalOperador() {

    modalOperador.style.display = 'none';

    formOperador.reset();

}


btnFecharModal.addEventListener('click', fecharModalOperador);

btnCancelarOperador.addEventListener('click', fecharModalOperador);


formOperador.addEventListener('submit', async (event) => {

    event.preventDefault();

    const nome = document.getElementById('nomeOperador').value.trim();
    const cpf = document.getElementById('cpfOperador').value.trim();
    const email = document.getElementById('emailOperador').value.trim();
    const senha = document.getElementById('senhaOperador').value;
    const perfil = document.getElementById('perfilOperador').value;
    const ativo = document.getElementById('ativoOperador').checked;

    if (!nome || !cpf || !email || !senha) {
        alert('Preencha todos os campos obrigatórios.');
        return;
    }

    if (cpf.length !== 11 || !/^\d+$/.test(cpf)) {
        alert('Digite um CPF válido com 11 números.');
        return;
    }

    if (senha.length < 6) {
        alert('A senha deve possuir pelo menos 6 caracteres.');
        return;
    }

    const botao = formOperador.querySelector('button[type="submit"]');

    botao.disabled = true;
    botao.textContent = 'Cadastrando...';

    try {

        const { data, error } = await supabaseClient.functions.invoke(
            'criar-operador',
            {
                body: {
                    nome,
                    cpf,
                    email,
                    senha,
                    perfil,
                    ativo
                }
            }
        );

        console.log('Resposta da função:', data);
        console.log('Erro da função:', error);

        if (error) {
            throw error;
        }

        if (!data || !data.sucesso) {
            throw new Error(
                data?.erro || 'Não foi possível cadastrar o operador.'
            );
        }

        // Aplica os módulos pré-definidos do perfil escolhido
        // ao novo operador recém-criado.
        try {

            const {
                data: novoOperador
            } = await supabaseClient
                .from('operadores')
                .select('id')
                .eq('cpf', cpf)
                .single();

            if (novoOperador) {

                const {
                    data: modulosPerfil
                } = await supabaseClient
                    .from('permissoes_perfil')
                    .select('modulo_id')
                    .eq('perfil', perfil);

                if (modulosPerfil && modulosPerfil.length > 0) {

                    const novasPermissoes = modulosPerfil.map(
                        item => ({
                            operador_id: novoOperador.id,
                            modulo_id: item.modulo_id
                        })
                    );

                    await supabaseClient
                        .from('permissoes')
                        .insert(novasPermissoes);
                }
            }

        } catch (erroPermissoesPadrao) {

            console.error(
                'Erro ao aplicar permissões padrão do perfil:',
                erroPermissoesPadrao
            );
        }

        await registrarAuditoria(
            'acao',
            `Cadastrou o operador "${nome}" (perfil: ${perfil}).`
        );

        alert('Operador cadastrado com sucesso!');

        fecharModalOperador();

        await carregarOperadores();

    } catch (error) {

        console.error('Erro ao cadastrar operador:', error);

        alert(
            'Não foi possível cadastrar o operador.\n\n' +
            (error.message || 'Erro desconhecido.')
        );

    } finally {

        botao.disabled = false;
        botao.textContent = 'Cadastrar operador';

    }

});



// =====================================================
// PERMISSÕES POR PERFIL
// =====================================================
// Define quais módulos cada PERFIL (admin, gerente,
// operador, caixa, n1...) recebe por padrão. Usado também
// para habilitar automaticamente os módulos de um novo
// operador de acordo com o perfil escolhido no cadastro.
// =====================================================

const PERFIS_DISPONIVEIS = [
    { valor: 'operador', rotulo: 'Operador' },
    { valor: 'gerente', rotulo: 'Gerente' },
    { valor: 'caixa', rotulo: 'Caixa' },
    { valor: 'n1', rotulo: 'N1' },
    { valor: 'admin', rotulo: 'Administrador' }
];

let perfilPermissaoAtual = null;


function abrirPermissoesPerfil() {

    document.getElementById(
        'modalPermissoesPerfil'
    ).style.display = 'flex';

    const seletor = document.getElementById('seletorPerfilPermissao');

    seletor.innerHTML = PERFIS_DISPONIVEIS.map(
        p => `<option value="${p.valor}">${p.rotulo}</option>`
    ).join('');

    perfilPermissaoAtual = seletor.value;

    carregarModulosPorPerfil(perfilPermissaoAtual);
}


function fecharPermissoesPerfil() {

    document.getElementById(
        'modalPermissoesPerfil'
    ).style.display = 'none';

    perfilPermissaoAtual = null;
}


async function carregarModulosPorPerfil(perfil) {

    perfilPermissaoAtual = perfil;

    const lista = document.getElementById('listaPermissoesPerfil');

    lista.innerHTML = 'Carregando módulos...';

    try {

        const {
            data: modulos,
            error: erroModulos
        } = await supabaseClient
            .from('modulos')
            .select('*')
            .eq('ativo', true)
            .order('id');

        if (erroModulos) {
            throw erroModulos;
        }

        const {
            data: permissoesPerfil,
            error: erroPermissoesPerfil
        } = await supabaseClient
            .from('permissoes_perfil')
            .select('modulo_id')
            .eq('perfil', perfil);

        if (erroPermissoesPerfil) {
            throw erroPermissoesPerfil;
        }

        const permitidos = new Set(
            (permissoesPerfil || []).map(p => p.modulo_id)
        );

        lista.innerHTML = '';

        if (!modulos || modulos.length === 0) {
            lista.innerHTML = '<p>Nenhum módulo cadastrado ainda.</p>';
            return;
        }

        modulos.forEach(modulo => {

            const marcado = permitidos.has(modulo.id);

            const div = document.createElement('div');

            div.className = 'permissao-item';

            div.innerHTML = `
                <label>
                    <input
                        type="checkbox"
                        class="checkbox-modulo-perfil"
                        data-modulo-id="${modulo.id}"
                        ${marcado ? 'checked' : ''}>

                    <span class="icone-modulo">
                        ${modulo.icone || '📦'}
                    </span>

                    <span>
                        <strong>${modulo.nome}</strong>

                        ${
                            modulo.descricao
                                ? `<small>${modulo.descricao}</small>`
                                : ''
                        }
                    </span>
                </label>
            `;

            lista.appendChild(div);
        });

    } catch (erro) {

        console.error(
            'Erro ao carregar módulos do perfil:',
            erro
        );

        lista.innerHTML =
            '<p>Erro ao carregar módulos.</p>';
    }
}


async function salvarPermissoesPerfil() {

    if (!perfilPermissaoAtual) {
        return;
    }

    try {

        const checkboxes = document.querySelectorAll(
            '.checkbox-modulo-perfil'
        );

        const selecionados = [];

        checkboxes.forEach(checkbox => {

            if (checkbox.checked) {

                selecionados.push({
                    perfil: perfilPermissaoAtual,
                    modulo_id: Number(checkbox.dataset.moduloId)
                });
            }
        });

        const {
            error: erroDelete
        } = await supabaseClient
            .from('permissoes_perfil')
            .delete()
            .eq('perfil', perfilPermissaoAtual);

        if (erroDelete) {
            throw erroDelete;
        }

        if (selecionados.length > 0) {

            const {
                error: erroInsert
            } = await supabaseClient
                .from('permissoes_perfil')
                .insert(selecionados);

            if (erroInsert) {
                throw erroInsert;
            }
        }

        await registrarAuditoria(
            'acao',
            `Atualizou os módulos padrão do perfil "${perfilPermissaoAtual}".`
        );

        alert('Permissões do perfil salvas com sucesso!');

    } catch (erro) {

        console.error(
            'Erro ao salvar permissões do perfil:',
            erro
        );

        alert('Não foi possível salvar as permissões do perfil.');
    }
}


document.getElementById('btnPermissoesPerfil')
    .addEventListener('click', abrirPermissoesPerfil);

document.getElementById('seletorPerfilPermissao')
    .addEventListener('change', (event) => {
        carregarModulosPorPerfil(event.target.value);
    });


// =====================================================
// ABAS (OPERADORES / HISTÓRICO DE VENDAS)
// =====================================================

document.querySelectorAll('.tab-admin-btn').forEach(botao => {

    botao.addEventListener('click', () => {

        document.querySelectorAll('.tab-admin-btn').forEach(b => b.classList.remove('ativo'));
        document.querySelectorAll('.aba-admin').forEach(a => a.classList.remove('ativa'));

        botao.classList.add('ativo');
        document.getElementById(`aba-admin-${botao.dataset.aba}`).classList.add('ativa');

        if (botao.dataset.aba === 'vendas') {
            carregarFiltroOperadoresVendas();
            carregarVendasAdmin();
        }
    });
});


// =====================================================
// HISTÓRICO DE VENDAS
// =====================================================

function formatarMoedaAdmin(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarDataAdmin(dataISO) {
    return new Date(dataISO).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function rotuloFormaPagamentoAdmin(forma) {
    const mapa = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito' };
    return mapa[forma] || forma || '—';
}


async function carregarFiltroOperadoresVendas() {

    const select = document.getElementById('filtroVendaOperador');

    if (select.dataset.carregado) return;

    const { data, error } = await supabaseClient
        .from('operadores')
        .select('id, nome')
        .order('nome');

    if (error) {
        console.error('Erro ao carregar operadores para filtro:', error);
        return;
    }

    (data || []).forEach(op => {
        const option = document.createElement('option');
        option.value = op.id;
        option.textContent = op.nome;
        select.appendChild(option);
    });

    select.dataset.carregado = 'true';
}


async function carregarVendasAdmin() {

    const lista = document.getElementById('listaVendasAdmin');

    lista.innerHTML = '<tr><td colspan="7" class="mensagem">Carregando vendas...</td></tr>';

    try {

        let consulta = supabaseClient
            .from('vendas')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

        const operador = document.getElementById('filtroVendaOperador').value;
        const status = document.getElementById('filtroVendaStatus').value;
        const inicio = document.getElementById('filtroVendaInicio').value;
        const fim = document.getElementById('filtroVendaFim').value;

        if (operador) consulta = consulta.eq('operador_id', operador);
        if (status) consulta = consulta.eq('status', status);
        if (inicio) consulta = consulta.gte('created_at', `${inicio}T00:00:00`);
        if (fim) consulta = consulta.lte('created_at', `${fim}T23:59:59`);

        const { data, error } = await consulta;

        if (error) throw error;

        if (!data || data.length === 0) {
            lista.innerHTML = '<tr><td colspan="7" class="mensagem">Nenhuma venda encontrada.</td></tr>';
            return;
        }

        lista.innerHTML = '';

        data.forEach(venda => {

            const linha = document.createElement('tr');

            const tagStatus = venda.status === 'cancelada'
                ? '<span style="background:#fde8e8;color:#b42318;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Cancelada</span>'
                : '<span style="background:#e4efe6;color:#2f6f4e;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Concluída</span>';

            linha.innerHTML = `
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td>${tagStatus}</td>
                <td></td>
            `;

            linha.children[0].textContent = formatarDataAdmin(venda.created_at);
            linha.children[1].textContent = venda.operador_nome || '—';
            linha.children[2].textContent = venda.cliente_nome || '—';
            linha.children[3].textContent = formatarMoedaAdmin(venda.total);
            linha.children[4].textContent = rotuloFormaPagamentoAdmin(venda.forma_pagamento);

            const celulaAcoes = linha.children[6];

            if (venda.status !== 'cancelada') {

                const botao = document.createElement('button');
                botao.type = 'button';
                botao.textContent = 'Cancelar venda';
                botao.style.cssText = 'background:#fde8e8;color:#b42318;border:none;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;';

                botao.addEventListener('click', () => cancelarVenda(venda));

                celulaAcoes.appendChild(botao);

            } else {

                celulaAcoes.innerHTML = '<span style="color:#9ca3af;font-size:12px;">—</span>';
            }

            lista.appendChild(linha);
        });

    } catch (erro) {

        console.error('Erro ao carregar vendas:', erro);
        lista.innerHTML = '<tr><td colspan="7" class="mensagem">Erro ao carregar vendas.</td></tr>';
    }
}

document.getElementById('btnFiltrarVendas').addEventListener('click', carregarVendasAdmin);


async function cancelarVenda(venda) {

    if (!confirm(
        `Cancelar a venda de ${formatarMoedaAdmin(venda.total)} (${venda.cliente_nome || 'cliente não informado'})?\n\n` +
        `O estoque dos produtos será devolvido e o valor será estornado do caixa.`
    )) {
        return;
    }

    try {

        // 1. Busca os itens da venda para devolver ao estoque
        const { data: itens, error: erroItens } = await supabaseClient
            .from('venda_itens')
            .select('*')
            .eq('venda_id', venda.id);

        if (erroItens) throw erroItens;

        // 2. Devolve o estoque de cada item
        for (const item of (itens || [])) {

            const { data: produto } = await supabaseClient
                .from('produtos')
                .select('estoque')
                .eq('id', item.produto_id)
                .single();

            if (produto) {

                const novoEstoque = Number(produto.estoque) + Number(item.quantidade);

                await supabaseClient
                    .from('produtos')
                    .update({ estoque: novoEstoque })
                    .eq('id', item.produto_id);

                await supabaseClient
                    .from('estoque_movimentacoes')
                    .insert({
                        produto_id: item.produto_id,
                        tipo: 'entrada',
                        quantidade: item.quantidade,
                        motivo: `Estorno - cancelamento da venda #${venda.id.slice(0, 8)}`,
                        operador_nome: null
                    });
            }
        }

        // 3. Estorna o valor no caixa (se a venda estava vinculada a um caixa)
        if (venda.caixa_id) {

            await supabaseClient
                .from('caixa_movimentacoes')
                .insert({
                    caixa_id: venda.caixa_id,
                    tipo: 'venda',
                    valor: -Number(venda.total),
                    forma_pagamento: venda.forma_pagamento,
                    descricao: `Estorno - cancelamento da venda #${venda.id.slice(0, 8)}`,
                    venda_id: venda.id
                });
        }

        // 4. Marca a venda como cancelada
        const { error: erroUpdate } = await supabaseClient
            .from('vendas')
            .update({ status: 'cancelada' })
            .eq('id', venda.id);

        if (erroUpdate) throw erroUpdate;

        await registrarAuditoria(
            'acao',
            `Cancelou a venda #${venda.id.slice(0, 8)} no valor de ${formatarMoedaAdmin(venda.total)}.`
        );

        alert('Venda cancelada com sucesso. Estoque e caixa foram ajustados.');

        await carregarVendasAdmin();

    } catch (erro) {

        console.error('Erro ao cancelar venda:', erro);
        alert('Não foi possível cancelar a venda.');
    }
}


// Inicializa a página administrativa
iniciarAdministracao();
let operadorEdicaoAtual = null;


async function abrirEdicaoOperador(operadorId) {

    try {

        const {
            data: operador,
            error
        } = await supabaseClient
            .from('operadores')
            .select('id, nome, cpf, perfil, ativo')
            .eq('id', operadorId)
            .single();

        if (error || !operador) {

            alert(
                'Não foi possível carregar o operador.'
            );

            return;
        }

        operadorEdicaoAtual = operador.id;

        document.getElementById(
            'editarOperadorId'
        ).value = operador.id;

        document.getElementById(
            'editarNome'
        ).value = operador.nome || '';

        document.getElementById(
            'editarCpf'
        ).value = operador.cpf || '';

        document.getElementById(
            'editarPerfil'
        ).value = operador.perfil || 'operador';

        document.getElementById(
            'editarAtivo'
        ).checked = operador.ativo === true;

        document.getElementById(
            'modalEditarOperador'
        ).style.display = 'flex';

    } catch (erro) {

        console.error(
            'Erro ao abrir edição:',
            erro
        );

        alert(
            'Erro ao carregar operador.'
        );
    }
}


function fecharEdicaoOperador() {

    document.getElementById(
        'modalEditarOperador'
    ).style.display = 'none';

    operadorEdicaoAtual = null;
}


async function salvarEdicaoOperador() {

    if (!operadorEdicaoAtual) {
        return;
    }

    const nome =
        document.getElementById(
            'editarNome'
        ).value.trim();

    const cpf =
        document.getElementById(
            'editarCpf'
        ).value.replace(/\D/g, '');

    const perfil =
        document.getElementById(
            'editarPerfil'
        ).value;

    const ativo =
        document.getElementById(
            'editarAtivo'
        ).checked;


    if (!nome) {

        alert(
            'Informe o nome do operador.'
        );

        return;
    }


    if (cpf.length !== 11) {

        alert(
            'O CPF deve conter 11 números.'
        );

        return;
    }


    try {

        const {
            data: resposta,
            error
        } = await supabaseClient.functions.invoke(
            'editar-operador',
            {
                body: {
                    id: operadorEdicaoAtual,
                    nome,
                    cpf,
                    perfil,
                    ativo
                }
            }
        );


        console.log(
            'Resposta editar operador:',
            resposta
        );

        console.log(
            'Erro editar operador:',
            error
        );


      if (error) {

    console.error(
        'ERRO COMPLETO DA EDGE FUNCTION:',
        error
    );

    let mensagem =
        'Não foi possível editar o operador.';

    try {

        if (error.context) {

            const corpo =
                await error.context.json();

            console.log(
                'RESPOSTA DA EDGE FUNCTION:',
                corpo
            );

            if (corpo?.erro) {
                mensagem = corpo.erro;
            }
        }

    } catch (e) {

        console.error(
            'Não foi possível ler resposta da função:',
            e
        );
    }

    throw new Error(mensagem);
}


        if (resposta?.erro) {

            throw new Error(
                resposta.erro
            );
        }


        await registrarAuditoria(
            'acao',
            `Editou o operador "${nome}" (perfil: ${perfil}).`
        );

        alert(
            'Operador atualizado com sucesso!'
        );


        fecharEdicaoOperador();

        await carregarOperadores();


    } catch (erro) {

        console.error(
            'Erro ao editar operador:',
            erro
        );

        alert(
            erro.message ||
            'Erro ao atualizar operador.'
        );
    }
}
async function resetarSenhaOperador(
    operadorId,
    nomeOperador
) {

    const confirmar = confirm(
        `Deseja realmente redefinir a senha de ${nomeOperador}?\n\n` +
        `A nova senha será:\n123456`
    );

    if (!confirmar) {
        return;
    }

    try {

        console.log(
            'Resetando senha do operador:',
            operadorId
        );

        const {
            data: resposta,
            error
        } = await supabaseClient.functions.invoke(
            'resetar-senha',
            {
                body: {
                    operador_id: operadorId
                }
            }
        );

        console.log(
            'Resposta resetar senha:',
            resposta
        );

        console.log(
            'Erro resetar senha:',
            error
        );

        if (error) {

            let mensagem =
                'Não foi possível redefinir a senha.';

            try {

                if (error.context) {

                    const corpo =
                        await error.context.json();

                    console.error(
                        'Resposta da Edge Function:',
                        corpo
                    );

                    if (corpo?.erro) {
                        mensagem = corpo.erro;
                    }
                }

            } catch (e) {

                console.error(
                    'Erro ao ler resposta:',
                    e
                );
            }

            throw new Error(mensagem);
        }

        if (resposta?.erro) {

            throw new Error(
                resposta.erro
            );
        }

        await registrarAuditoria(
            'acao',
            `Redefiniu a senha do operador "${nomeOperador}".`
        );

        alert(
            `Senha de ${nomeOperador} redefinida com sucesso!\n\n` +
            `Nova senha: 123456`
        );

    } catch (erro) {

        console.error(
            'Erro ao resetar senha:',
            erro
        );

        alert(
            erro.message ||
            'Erro ao redefinir senha.'
        );
    }
}