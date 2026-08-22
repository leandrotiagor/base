// =====================================================
// SUPABASE - CONFIGURAÇÃO
// =====================================================

const SUPABASE_URL =
    'https://homcoqxvnskmhkofwyef.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_Ep0zPdN8-GToiegta4fT9w_Gxf-8du_';


// =====================================================
// CLIENTE SUPABASE
// =====================================================

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


console.log(
    'Supabase conectado com sucesso.'
);


// =====================================================
// REGISTRO DO SERVICE WORKER (PWA)
// =====================================================

if ('serviceWorker' in navigator) {

    window.addEventListener('load', () => {

        navigator.serviceWorker
            .register('service-worker.js')
            .catch((erro) => {
                console.error('Erro ao registrar Service Worker:', erro);
            });
    });
}


// =====================================================
// AUDITORIA - REGISTRO DE AÇÕES
// =====================================================
// Função disponível em todas as páginas (login, painel,
// viagens, anotações, admin) para registrar login, logout
// e ações realizadas pelos operadores.
// =====================================================

async function registrarAuditoria(tipo, descricao) {

    try {

        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        if (!user) {
            return;
        }

        let nomeOperador = null;

        try {

            const { data: operador } = await supabaseClient
                .from('operadores')
                .select('nome')
                .eq('id', user.id)
                .single();

            nomeOperador = operador?.nome || null;

        } catch (e) {
            // Se não conseguir o nome, segue sem ele
        }

        const registro = {
            operador_id: user.id,
            operador_nome: nomeOperador,
            tipo: tipo,
            descricao: descricao,
            dispositivo: detectarDispositivo()
        };

        // Em logins, também captura IP, localização e provedor
        // (tenta um serviço; se falhar, tenta um segundo como reserva)
        if (tipo === 'login') {

            const dadosIp = await buscarDadosDeIp();

            if (dadosIp) {
                registro.ip = dadosIp.ip || null;
                registro.cidade = dadosIp.cidade || null;
                registro.regiao = dadosIp.regiao || null;
                registro.pais = dadosIp.pais || null;
                registro.provedor = dadosIp.provedor || null;
            }
        }

        await supabaseClient
            .from('auditoria')
            .insert(registro);

    } catch (erro) {

        console.error(
            'Erro ao registrar auditoria:',
            erro
        );
    }
}


// =====================================================
// DETECÇÃO BÁSICA DE DISPOSITIVO (SO + NAVEGADOR)
// =====================================================

function detectarDispositivo() {

    const ua = navigator.userAgent;

    let sistema = 'Desconhecido';

    if (/Windows/i.test(ua)) sistema = 'Windows';
    else if (/Android/i.test(ua)) sistema = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) sistema = 'iOS';
    else if (/Mac OS/i.test(ua)) sistema = 'macOS';
    else if (/Linux/i.test(ua)) sistema = 'Linux';

    let navegador = 'Desconhecido';

    if (/Edg\//i.test(ua)) navegador = 'Edge';
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) navegador = 'Chrome';
    else if (/Firefox\//i.test(ua)) navegador = 'Firefox';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) navegador = 'Safari';

    return `${sistema} · ${navegador}`;
}


// =====================================================
// BUSCA IP / LOCALIZAÇÃO / PROVEDOR (COM RESERVA)
// =====================================================
// Tenta o ipapi.co primeiro; se falhar (bloqueio de rede,
// rastreador bloqueado pelo navegador, etc.), tenta o
// geojs.io como alternativa antes de desistir.
// =====================================================

async function buscarDadosDeIp() {

    // Tentativa 1: ipapi.co
    try {

        const resposta = await fetch('https://ipapi.co/json/');
        const dados = await resposta.json();

        if (dados && dados.ip && !dados.error) {

            return {
                ip: dados.ip,
                cidade: dados.city,
                regiao: dados.region,
                pais: dados.country_name,
                provedor: dados.org
            };
        }

    } catch (erro) {
        console.error('Falha no ipapi.co:', erro);
    }

    // Tentativa 2 (reserva): geojs.io
    try {

        const resposta = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const dados = await resposta.json();

        if (dados && dados.ip) {

            return {
                ip: dados.ip,
                cidade: dados.city,
                regiao: dados.region,
                pais: dados.country,
                provedor: dados.organization_name || dados.asn || null
            };
        }

    } catch (erro) {
        console.error('Falha no geojs.io:', erro);
    }

    // Nenhum dos dois funcionou
    return null;
}


// =====================================================
// AVISO ANTES DE SAIR SEM SALVAR
// =====================================================// Funções reutilizáveis em qualquer página para evitar que
// o usuário perca dados preenchidos ao sair sem querer.
// =====================================================

// Ativa o aviso do navegador quando funcaoVerificacao() retornar true
function avisarAntesDeSair(funcaoVerificacao) {

    window.addEventListener('beforeunload', function (evento) {

        if (funcaoVerificacao()) {
            evento.preventDefault();
            evento.returnValue = '';
        }
    });
}

// Cria um "rastreador" que marca um formulário como sujo
// (alterado) assim que qualquer campo dele é editado.
function rastrearFormularioSujo(idFormulario) {

    const formulario = document.getElementById(idFormulario);

    let sujo = false;

    if (formulario) {

        formulario.addEventListener('input', () => {
            sujo = true;
        });

        formulario.addEventListener('change', () => {
            sujo = true;
        });
    }

    return {
        estaSujo: () => sujo,
        marcarLimpo: () => { sujo = false; }
    };
}


// =====================================================
// TRAVAR/LIBERAR ROLAGEM DE FUNDO (MODAIS NO CELULAR)
// =====================================================
// No Safari/iOS, deixar o fundo da página rolando junto
// com um modal aberto pode "travar" a rolagem do próprio
// modal. Chamar ao abrir/fechar qualquer modal resolve isso.
// =====================================================

function travarRolagemFundo() {
    document.body.style.overflow = 'hidden';
}

function liberarRolagemFundo() {
    document.body.style.overflow = '';
}