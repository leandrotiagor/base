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