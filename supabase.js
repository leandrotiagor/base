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

        await supabaseClient
            .from('auditoria')
            .insert({
                operador_id: user.id,
                operador_nome: nomeOperador,
                tipo: tipo,
                descricao: descricao
            });

    } catch (erro) {

        console.error(
            'Erro ao registrar auditoria:',
            erro
        );
    }
}