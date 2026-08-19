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