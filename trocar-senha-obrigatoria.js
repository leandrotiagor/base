// =====================================================
// TROCA OBRIGATÓRIA DE SENHA (primeiro login após
// cadastro ou reset feito pelo admin)
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

    // Se o operador já trocou a senha, não faz sentido ficar
    // preso nessa tela — manda direto pro painel.
    const { data: operador } = await supabaseClient
        .from('operadores')
        .select('deve_trocar_senha')
        .eq('id', user.id)
        .single();

    if (operador && !operador.deve_trocar_senha) {
        window.location.href = 'painel.html';
    }

})();


document.getElementById('btnSairTroca').addEventListener('click', async (evento) => {
    evento.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
});


document.getElementById('formTrocaObrigatoria').addEventListener('submit', async (evento) => {

    evento.preventDefault();

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

    const botao = evento.target.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {

        const { error: erroSenha } = await supabaseClient.auth.updateUser({
            password: novaSenha
        });

        if (erroSenha) {
            throw erroSenha;
        }

        // Limpa a própria flag de "precisa trocar senha" (função segura,
        // só mexe no próprio registro, nunca em perfil/ativo/etc.)
        const { error: erroFuncao } = await supabaseClient.rpc('marcar_senha_trocada');

        if (erroFuncao) {
            throw erroFuncao;
        }

        await registrarAuditoria('acao', 'Trocou a senha obrigatória no primeiro login.');

        alert('Senha atualizada com sucesso!');

        window.location.href = 'painel.html';

    } catch (erro) {

        console.error('Erro ao trocar senha obrigatória:', erro);

        alert(
            'Não foi possível trocar a senha.\n\n' +
            (erro.message || 'Erro desconhecido.')
        );

    } finally {

        botao.disabled = false;
        botao.textContent = 'Salvar e continuar';
    }
});
