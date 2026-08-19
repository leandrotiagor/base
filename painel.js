const nomeUsuario = document.getElementById('nomeUsuario');
const modulosContainer = document.getElementById('modulos');
const btnSair = document.getElementById('btnSair');

async function carregarPainel() {

    try {

        // Verifica se existe usuário autenticado
        const {
            data: { user },
            error: authError
        } = await supabaseClient.auth.getUser();

        if (authError || !user) {

            window.location.href = 'index.html';

            return;
        }


        // Busca os dados do operador
        const {
            data: operador,
            error: operadorError
        } = await supabaseClient
            .from('operadores')
            .select('id, nome, perfil, ativo')
            .eq('id', user.id)
            .single();


        if (operadorError || !operador) {

            alert('Operador não encontrado.');

            await supabaseClient.auth.signOut();

            window.location.href = 'index.html';

            return;
        }


        // Verifica se o operador está ativo
        if (!operador.ativo) {

            alert('Seu usuário está inativo.');

            await supabaseClient.auth.signOut();

            window.location.href = 'index.html';

            return;
        }


        // Mostra o nome do usuário
        nomeUsuario.textContent =
            `Olá, ${operador.nome}`;


        // Busca os módulos permitidos
        const {
            data: permissoes,
            error: permissoesError
        } = await supabaseClient
            .from('permissoes')
            .select(`
                modulo_id,
                modulos (
                    id,
                    nome,
                    descricao,
                    icone,
                    ativo
                )
            `)
            .eq('operador_id', operador.id);


        if (permissoesError) {

            console.error(
                'Erro ao buscar permissões:',
                permissoesError
            );

            modulosContainer.innerHTML =
                '<p>Não foi possível carregar os módulos.</p>';

            return;
        }


        // Limpa o carregamento
        modulosContainer.innerHTML = '';


        // Filtra somente módulos ativos
        const modulosAtivos = permissoes
            .filter(permissao =>
                permissao.modulos &&
                permissao.modulos.ativo
            );


        if (modulosAtivos.length === 0) {

            modulosContainer.innerHTML =
                '<p>Nenhum módulo disponível para este usuário.</p>';

            return;
        }


        // Cria os cartões dos módulos
        modulosAtivos.forEach(permissao => {

            const modulo = permissao.modulos;

            const card = document.createElement('div');

card.className = 'modulo-card';

card.innerHTML = `
    <div class="modulo-icone">
        ${modulo.icone || '📦'}
    </div>

    <div class="modulo-conteudo">
        <h3>${modulo.nome}</h3>

        <p>
            ${modulo.descricao || ''}
        </p>
    </div>
`;

// Controle de Viagens
if (modulo.nome === 'Controle de Viagens') {

    card.style.cursor = 'pointer';

    card.addEventListener('click', () => {
        window.location.href = 'viagens.html';
    });
}

// Anotações
if (modulo.nome === 'Anotações') {

    card.style.cursor = 'pointer';

    card.addEventListener('click', () => {
        window.location.href = 'anotacoes.html';
    });
}

modulosContainer.appendChild(card);

        });

    } catch (error) {

        console.error(
            'Erro ao carregar painel:',
            error
        );

        window.location.href = 'index.html';

    }
}


// Botão sair
btnSair.addEventListener('click', async () => {

    await registrarAuditoria('logout', 'Logout realizado no sistema.');

    await supabaseClient.auth.signOut();

    window.location.href = 'index.html';

});


// Inicia o painel
carregarPainel();


// Verifica se o usuário é administrador
async function verificarAdministrador() {
    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        return;
    }

    const { data: operador, error: operadorError } = await supabaseClient
        .from('operadores')
        .select('perfil, ativo')
        .eq('id', user.id)
        .single();

    if (operadorError) {
        console.error('Erro ao verificar operador:', operadorError);
        return;
    }

    if (operador.ativo && operador.perfil === 'admin') {
        document.getElementById('adminArea').style.display = 'block';
    }
}

// Chama a função para exibir o botão caso seja admin
verificarAdministrador();

// Botão de Administração - Redireciona para admin.html
document.getElementById('btnAdministracao').addEventListener('click', () => {
    window.location.href = 'admin.html';
});

// Botão de Auditoria - Redireciona para auditoria.html
document.getElementById('btnAuditoria').addEventListener('click', () => {
    window.location.href = 'auditoria.html';
});


// =====================================================
// TROCAR SENHA
// =====================================================

const modalTrocarSenha = document.getElementById('modalTrocarSenha');
const formTrocarSenha = document.getElementById('formTrocarSenha');
const btnTrocarSenha = document.getElementById('btnTrocarSenha');
const btnFecharTrocarSenha = document.getElementById('btnFecharTrocarSenha');
const btnCancelarTrocarSenha = document.getElementById('btnCancelarTrocarSenha');


function abrirModalTrocarSenha() {
    formTrocarSenha.reset();
    modalTrocarSenha.style.display = 'flex';
}

function fecharModalTrocarSenha() {
    modalTrocarSenha.style.display = 'none';
    formTrocarSenha.reset();
}

btnTrocarSenha.addEventListener('click', abrirModalTrocarSenha);
btnFecharTrocarSenha.addEventListener('click', fecharModalTrocarSenha);
btnCancelarTrocarSenha.addEventListener('click', fecharModalTrocarSenha);


formTrocarSenha.addEventListener('submit', async (event) => {

    event.preventDefault();

    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;

    if (novaSenha.length < 6) {
        alert('A senha deve possuir pelo menos 6 caracteres.');
        return;
    }

    if (novaSenha !== confirmarSenha) {
        alert('As senhas não coincidem.');
        return;
    }

    const botao = formTrocarSenha.querySelector('button[type="submit"]');

    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {

        const { error } = await supabaseClient.auth.updateUser({
            password: novaSenha
        });

        if (error) {
            throw error;
        }

        await registrarAuditoria('acao', 'Trocou a própria senha.');

        alert('Senha alterada com sucesso!');

        fecharModalTrocarSenha();

    } catch (error) {

        console.error('Erro ao trocar senha:', error);

        alert(
            'Não foi possível trocar a senha.\n\n' +
            (error.message || 'Erro desconhecido.')
        );

    } finally {

        botao.disabled = false;
        botao.textContent = 'Salvar nova senha';

    }

});