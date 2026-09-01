// =====================================================
// MÓDULO TRANSCREVER FOTO (lado do computador)
// =====================================================

let sessaoAtualId = null;
let intervaloVerificacao = null;

const blocoInicial = document.getElementById('blocoInicial');
const areaQrcode = document.getElementById('areaQrcode');
const statusSessao = document.getElementById('statusSessao');
const areaResultado = document.getElementById('areaResultado');
const textoResultado = document.getElementById('textoResultado');

// Monta a URL pública da página de upload, na mesma raiz deste site
const URL_BASE_UPLOAD = window.location.origin + window.location.pathname.replace('transcrever-foto.html', 'upload-foto.html');


document.getElementById('btnGerarQrcode').addEventListener('click', gerarNovaSessao);
document.getElementById('btnNovaFoto').addEventListener('click', () => {
    areaResultado.style.display = 'none';
    gerarNovaSessao();
});


async function gerarNovaSessao() {

    pararVerificacao();

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    let nomeOperador = null;

    try {
        const { data: op } = await supabaseClient
            .from('operadores')
            .select('nome')
            .eq('id', user.id)
            .single();
        nomeOperador = op?.nome || null;
    } catch (e) {}

    const { data: sessao, error } = await supabaseClient
        .from('upload_sessoes')
        .insert({
            operador_id: user.id,
            operador_nome: nomeOperador
        })
        .select()
        .single();

    if (error || !sessao) {
        console.error('Erro ao criar sessão:', error);
        alert('Não foi possível gerar o QR Code.');
        return;
    }

    sessaoAtualId = sessao.id;

    blocoInicial.style.display = 'none';
    areaResultado.style.display = 'none';
    areaQrcode.innerHTML = '';
    statusSessao.style.display = 'block';
    statusSessao.innerHTML = '<span class="status-spinner"></span> Aguardando você escanear e enviar a foto...';

    const urlSessao = `${URL_BASE_UPLOAD}?sessao=${sessao.id}`;

    new QRCode(areaQrcode, {
        text: urlSessao,
        width: 220,
        height: 220
    });

    iniciarVerificacao();
}


function iniciarVerificacao() {

    const inicio = Date.now();
    const LIMITE_MS = 11 * 60 * 1000; // um pouco mais que os 10 min de expiração

    intervaloVerificacao = setInterval(async () => {

        if (Date.now() - inicio > LIMITE_MS) {
            pararVerificacao();
            statusSessao.textContent = 'Tempo esgotado. Gere um novo QR Code.';
            blocoInicial.style.display = 'block';
            return;
        }

        const { data: sessao, error } = await supabaseClient
            .from('upload_sessoes')
            .select('status, texto_transcrito')
            .eq('id', sessaoAtualId)
            .single();

        if (error) {
            console.error('Erro ao verificar sessão:', error);
            return;
        }

        if (sessao?.status === 'concluido') {

            pararVerificacao();

            statusSessao.style.display = 'none';
            areaQrcode.innerHTML = '';
            blocoInicial.style.display = 'none';

            textoResultado.value = sessao.texto_transcrito || '';
            areaResultado.style.display = 'block';
        }

    }, 3000);
}

function pararVerificacao() {
    if (intervaloVerificacao) {
        clearInterval(intervaloVerificacao);
        intervaloVerificacao = null;
    }
}


document.getElementById('btnCopiar').addEventListener('click', async () => {

    try {
        await navigator.clipboard.writeText(textoResultado.value);
        const botao = document.getElementById('btnCopiar');
        const textoOriginal = botao.textContent;
        botao.textContent = '✅ Copiado!';
        setTimeout(() => { botao.textContent = textoOriginal; }, 1800);
    } catch (e) {
        textoResultado.select();
        document.execCommand('copy');
    }
});


// =====================================================
// INICIALIZAÇÃO
// =====================================================

(async function iniciar() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return;
    }

})();
