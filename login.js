const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    const cpf = document.getElementById('cpf').value
        .replace(/\D/g, '');

    const senha = document.getElementById('senha').value;

    if (!cpf || !senha) {
        alert('Informe o CPF e a senha.');
        return;
    }

    try {

        // 1. Localiza o e-mail interno através do CPF
        const { data: emailUsuario, error: cpfError } =
            await supabaseClient.rpc(
                'obter_email_por_cpf',
                {
                    cpf_informado: cpf
                }
            );

        if (cpfError) {
            console.error('Erro ao consultar CPF:', cpfError);
            alert('Não foi possível realizar o login.');
            return;
        }

        if (!emailUsuario) {
            alert('CPF ou senha inválidos.');
            return;
        }

        // 2. Autentica no Supabase
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: emailUsuario,
                password: senha
            });

        if (error) {
            console.error('Erro de autenticação:', error);
            alert('CPF ou senha inválidos.');
            return;
        }

        // 3. Login realizado
        console.log('Usuário autenticado:', data.user);

        await registrarAuditoria('login', 'Login realizado no sistema.');

  window.location.href = 'painel.html';

    } catch (error) {

        console.error('Erro inesperado:', error);

        alert('Ocorreu um erro ao realizar o login.');
    }
});