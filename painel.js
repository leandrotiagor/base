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


        // Busca os módulos permitidos para o PERFIL do operador
        const {
            data: permissoes,
            error: permissoesError
        } = await supabaseClient
            .from('permissoes_perfil')
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
            .eq('perfil', operador.perfil);


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

// Mapa de módulos para suas respectivas páginas
const PAGINAS_MODULOS = {
    'Produtos': 'produtos.html',
    'Estoque': 'estoque.html',
    'Vendas': 'vendas.html',
    'Caixa': 'caixa.html',
    'Impressão': 'impressao.html',
    'Administração': 'admin.html',
    'Auditoria': 'auditoria.html',
    'Dashboard': 'dashboard.html'
};

if (PAGINAS_MODULOS[modulo.nome]) {

    card.style.cursor = 'pointer';

    card.addEventListener('click', () => {
        window.location.href = PAGINAS_MODULOS[modulo.nome];
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


// =====================================================
// ALERTA DE ESTOQUE BAIXO (NOTIFICAÇÃO DO NAVEGADOR)
// =====================================================

async function verificarAlertasEstoqueBaixo() {

    if (!('Notification' in window)) {
        return;
    }

    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }

    if (Notification.permission !== 'granted') {
        return;
    }

    const { data: produtos, error } = await supabaseClient
        .from('produtos')
        .select('id, nome, estoque, estoque_minimo')
        .eq('ativo', true);

    if (error || !produtos) {
        return;
    }

    const baixos = produtos.filter(
        p => Number(p.estoque) <= Number(p.estoque_minimo)
    );

    if (baixos.length === 0) {
        return;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const chave = `estoque_notificado_${hoje}`;

    let jaNotificados = [];

    try {
        jaNotificados = JSON.parse(localStorage.getItem(chave) || '[]');
    } catch (e) {
        jaNotificados = [];
    }

    const novos = baixos.filter(p => !jaNotificados.includes(p.id));

    if (novos.length === 0) {
        return;
    }

    if (novos.length === 1) {

        new Notification('⚠️ Estoque baixo', {
            body: `${novos[0].nome} está com estoque baixo (${novos[0].estoque} un.)`,
            icon: 'icon-192.png'
        });

    } else {

        new Notification('⚠️ Estoque baixo', {
            body: `${novos.length} produtos estão com estoque baixo.`,
            icon: 'icon-192.png'
        });
    }

    localStorage.setItem(
        chave,
        JSON.stringify([...jaNotificados, ...novos.map(p => p.id)])
    );
}

verificarAlertasEstoqueBaixo();


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


// =====================================================
// RELÓGIO - HORÁRIO DE BRASÍLIA
// =====================================================

function atualizarRelogio() {

    const agora = new Date();

    const dataFormatada = agora.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const horaFormatada = agora.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    document.getElementById('relogioData').textContent = dataFormatada;

    document.getElementById('relogioHora').textContent =
        `${horaFormatada} (Brasília)`;
}

atualizarRelogio();
setInterval(atualizarRelogio, 1000);


// =====================================================
// CLIMA - LOCALIZAÇÃO DO NAVEGADOR
// =====================================================

const climaCidade = document.getElementById('climaCidade');
const climaTemp = document.getElementById('climaTemp');

function descreverClima(codigo) {

    const mapa = {
        0: 'Céu limpo',
        1: 'Poucas nuvens',
        2: 'Parcialmente nublado',
        3: 'Nublado',
        45: 'Neblina',
        48: 'Neblina com geada',
        51: 'Garoa fraca',
        53: 'Garoa moderada',
        55: 'Garoa forte',
        61: 'Chuva fraca',
        63: 'Chuva moderada',
        65: 'Chuva forte',
        71: 'Neve fraca',
        73: 'Neve moderada',
        75: 'Neve forte',
        80: 'Pancadas de chuva',
        81: 'Pancadas de chuva moderadas',
        82: 'Pancadas de chuva fortes',
        95: 'Tempestade',
        96: 'Tempestade com granizo',
        99: 'Tempestade forte com granizo'
    };

    return mapa[codigo] || 'Condição indisponível';
}

async function carregarClima() {

    if (!navigator.geolocation) {
        climaCidade.textContent = 'Localização não suportada neste navegador.';
        return;
    }

    navigator.geolocation.getCurrentPosition(

        async (posicao) => {

            const { latitude, longitude } = posicao.coords;

            try {

                // Busca o clima atual (Open-Meteo, sem necessidade de chave)
                const respostaClima = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=America%2FSao_Paulo`
                );

                const dadosClima = await respostaClima.json();

                const temperatura = dadosClima?.current_weather?.temperature;
                const codigoClima = dadosClima?.current_weather?.weathercode;

                // Busca o nome da cidade a partir das coordenadas
                let nomeCidade = 'Sua localização';

                try {

                    const respostaCidade = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                    );

                    const dadosCidade = await respostaCidade.json();

                    nomeCidade =
                        dadosCidade?.address?.city ||
                        dadosCidade?.address?.town ||
                        dadosCidade?.address?.municipality ||
                        dadosCidade?.address?.village ||
                        nomeCidade;

                } catch (erroCidade) {
                    console.error('Erro ao obter nome da cidade:', erroCidade);
                }

                climaCidade.textContent = `📍 ${nomeCidade}`;

                climaTemp.textContent =
                    temperatura !== undefined
                        ? `${Math.round(temperatura)}°C · ${descreverClima(codigoClima)}`
                        : 'Clima indisponível';

            } catch (erro) {

                console.error('Erro ao carregar clima:', erro);

                climaCidade.textContent = 'Não foi possível obter o clima.';
            }

        },

        (erro) => {

            console.error('Erro de geolocalização:', erro);

            climaCidade.textContent =
                'Permissão de localização não concedida.';
        }
    );
}

carregarClima();