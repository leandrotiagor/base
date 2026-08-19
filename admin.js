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
        class="btn-permissoes"
        onclick="abrirPermissoes(
            '${operador.id}',
            '${operador.nome.replace(/'/g, "\\'")}'
        )">
        🔐 Permissões
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


let operadorPermissaoAtual = null;
let nomeOperadorPermissaoAtual = null;

async function abrirPermissoes(operadorId, nomeOperador) {

    operadorPermissaoAtual = operadorId;
    nomeOperadorPermissaoAtual = nomeOperador;

    document.getElementById(
        'nomeOperadorPermissao'
    ).textContent = nomeOperador;

    document.getElementById(
        'modalPermissoes'
    ).style.display = 'flex';

    const lista = document.getElementById(
        'listaPermissoes'
    );

    lista.innerHTML = 'Carregando módulos...';

    try {

        // Buscar módulos ativos
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

        // Buscar permissões atuais
        const {
            data: permissoes,
            error: erroPermissoes
        } = await supabaseClient
            .from('permissoes')
            .select('modulo_id')
            .eq('operador_id', operadorId);

        if (erroPermissoes) {
            throw erroPermissoes;
        }

        const permitidos = new Set(
            permissoes.map(p => p.modulo_id)
        );

        lista.innerHTML = '';

        modulos.forEach(modulo => {

            const marcado = permitidos.has(modulo.id);

            const div = document.createElement('div');

            div.className = 'permissao-item';

            div.innerHTML = `
                <label>
                    <input
                        type="checkbox"
                        class="checkbox-modulo"
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
            'Erro ao carregar permissões:',
            erro
        );

        lista.innerHTML =
            '<p>Erro ao carregar permissões.</p>';
    }
}


function fecharPermissoes() {

    document.getElementById(
        'modalPermissoes'
    ).style.display = 'none';

    operadorPermissaoAtual = null;
}


async function salvarPermissoes() {

    if (!operadorPermissaoAtual) {
        return;
    }

    try {

        const checkboxes = document.querySelectorAll(
            '.checkbox-modulo'
        );

        const selecionados = [];

        checkboxes.forEach(checkbox => {

            if (checkbox.checked) {

                selecionados.push({
                    operador_id:
                        operadorPermissaoAtual,

                    modulo_id:
                        Number(
                            checkbox.dataset.moduloId
                        )
                });

            }

        });

        // Primeiro remove as permissões antigas
        const {
            error: erroDelete
        } = await supabaseClient
            .from('permissoes')
            .delete()
            .eq(
                'operador_id',
                operadorPermissaoAtual
            );

        if (erroDelete) {
            throw erroDelete;
        }

        // Depois insere as novas
        if (selecionados.length > 0) {

            const {
                error: erroInsert
            } = await supabaseClient
                .from('permissoes')
                .insert(selecionados);

            if (erroInsert) {
                throw erroInsert;
            }
        }

        await registrarAuditoria(
            'acao',
            `Atualizou as permissões do operador "${nomeOperadorPermissaoAtual}".`
        );

        alert(
            'Permissões salvas com sucesso!'
        );

        fecharPermissoes();

    } catch (erro) {

        console.error(
            'Erro ao salvar permissões:',
            erro
        );

        alert(
            'Não foi possível salvar as permissões.'
        );
    }
}

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