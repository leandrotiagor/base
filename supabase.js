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
        if (tipo === 'login') {

            try {

                const respostaIp = await fetch('https://ipapi.co/json/');
                const dadosIp = await respostaIp.json();

                registro.ip = dadosIp?.ip || null;
                registro.cidade = dadosIp?.city || null;
                registro.regiao = dadosIp?.region || null;
                registro.pais = dadosIp?.country_name || null;
                registro.provedor = dadosIp?.org || null;

            } catch (erroIp) {
                console.error('Erro ao obter dados de IP:', erroIp);
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