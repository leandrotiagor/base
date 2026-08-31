// =====================================================
// MÓDULO ASSISTENTE IA
// =====================================================

const chatMensagens = document.getElementById('chatMensagens');
const formChat = document.getElementById('formChat');
const inputMensagem = document.getElementById('inputMensagem');
const btnEnviar = document.getElementById('btnEnviar');

let historicoConversa = []; // { role: 'user' | 'model', texto: string }


// Textarea cresce sozinha conforme o texto (até um limite via CSS max-height)
inputMensagem.addEventListener('input', () => {
    inputMensagem.style.height = 'auto';
    inputMensagem.style.height = inputMensagem.scrollHeight + 'px';
});

// Enter envia, Shift+Enter quebra linha
inputMensagem.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && !evento.shiftKey) {
        evento.preventDefault();
        formChat.requestSubmit();
    }
});


function limparMensagemVazia() {
    const vazio = chatMensagens.querySelector('.msg-vazio');
    if (vazio) vazio.remove();
}

function adicionarMensagemNaTela(texto, tipo) {

    limparMensagemVazia();

    const bolha = document.createElement('div');
    bolha.className = `msg ${tipo}`;
    bolha.textContent = texto;

    chatMensagens.appendChild(bolha);
    chatMensagens.scrollTop = chatMensagens.scrollHeight;

    return bolha;
}


formChat.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    const texto = inputMensagem.value.trim();

    if (!texto) return;

    // Mostra a mensagem do usuário na tela e no histórico
    adicionarMensagemNaTela(texto, 'msg-usuario');
    historicoConversa.push({ role: 'user', texto });

    inputMensagem.value = '';
    inputMensagem.style.height = 'auto';

    btnEnviar.disabled = true;

    const bolhaCarregando = adicionarMensagemNaTela('Pensando...', 'msg-carregando');

    try {

        const { data, error } = await supabaseClient.functions.invoke(
            'gemini-chat',
            {
                body: { mensagens: historicoConversa }
            }
        );

        bolhaCarregando.remove();

        if (error) {

            let mensagemErro = 'Não foi possível falar com a IA agora.';

            try {
                if (error.context) {
                    const corpo = await error.context.json();
                    if (corpo?.erro) mensagemErro = corpo.erro;
                }
            } catch (e) {}

            adicionarMensagemNaTela(mensagemErro, 'msg-ia');
            historicoConversa.pop(); // remove a pergunta que falhou, pra não poluir o contexto
            return;
        }

        if (data?.erro) {
            adicionarMensagemNaTela(data.erro, 'msg-ia');
            historicoConversa.pop();
            return;
        }

        const respostaTexto = data?.resposta || 'Não consegui gerar uma resposta agora.';

        adicionarMensagemNaTela(respostaTexto, 'msg-ia');
        historicoConversa.push({ role: 'model', texto: respostaTexto });

    } catch (erro) {

        console.error('Erro ao conversar com a IA:', erro);
        bolhaCarregando.remove();
        adicionarMensagemNaTela('Não foi possível falar com a IA agora.', 'msg-ia');
        historicoConversa.pop();

    } finally {

        btnEnviar.disabled = false;
        inputMensagem.focus();
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
