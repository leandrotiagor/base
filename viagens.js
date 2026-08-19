// =====================================================
// CONTROLE DE VIAGENS - SUPABASE
// =====================================================
// Este arquivo contém somente as funções de acesso
// ao Supabase.
//
// NÃO declarar aqui:
// let lancamentos
// let viagens
//
// Essas variáveis já pertencem ao viagens.html.
// =====================================================


// =====================================================
// OPERADOR LOGADO
// =====================================================

let operadorAtual = null;


// =====================================================
// CARREGAR OPERADOR LOGADO
// =====================================================

async function carregarOperadorAtual() {

    try {

        const {
            data: { user },
            error
        } = await supabaseClient.auth.getUser();


        if (error || !user) {

            console.error(
                'Usuário não autenticado:',
                error
            );

            window.location.href = 'index.html';

            return null;
        }


        const {
            data: operador,
            error: operadorError
        } = await supabaseClient
            .from('operadores')
            .select('id, nome, perfil, ativo')
            .eq('id', user.id)
            .single();


        if (operadorError || !operador) {

            console.error(
                'Erro ao carregar operador:',
                operadorError
            );

            await supabaseClient.auth.signOut();

            window.location.href = 'index.html';

            return null;
        }


        if (!operador.ativo) {

            alert(
                'Seu usuário está inativo.'
            );

            await supabaseClient.auth.signOut();

            window.location.href = 'index.html';

            return null;
        }


        operadorAtual = operador;


        console.log(
            'OPERADOR LOGADO:',
            operadorAtual
        );


        return operadorAtual;


    } catch (error) {

        console.error(
            'ERRO AO CARREGAR OPERADOR:',
            error
        );

        return null;
    }
}


// =====================================================
// CARREGAR VIAGENS
// =====================================================

async function carregarViagens() {

    if (!operadorAtual) {

        await carregarOperadorAtual();

        if (!operadorAtual) {

            return [];
        }
    }


    const {
        data,
        error
    } = await supabaseClient
        .from('viagens')
        .select(`
            id,
            operador_id,
            nome,
            valor_diaria,
            created_at
        `)
        .eq(
            'operador_id',
            operadorAtual.id
        )
        .order(
            'created_at',
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            'ERRO AO CARREGAR VIAGENS:',
            error
        );

        throw error;
    }


    console.log(
        'VIAGENS CARREGADAS:',
        data
    );


    return data || [];
}


// =====================================================
// CRIAR VIAGEM
// =====================================================

async function criarViagem(
    nome,
    valorDiaria
) {

    if (!operadorAtual) {

        await carregarOperadorAtual();

        if (!operadorAtual) {

            throw new Error(
                'Operador não autenticado.'
            );
        }
    }


    nome =
        String(
            nome || ''
        ).trim();


    valorDiaria =
        Number(
            valorDiaria
        );


    if (!nome) {

        throw new Error(
            'Informe o nome da viagem.'
        );
    }


    if (
        isNaN(valorDiaria) ||
        valorDiaria <= 0
    ) {

        throw new Error(
            'Informe um valor de diária válido.'
        );
    }


    const {
        data,
        error
    } = await supabaseClient
        .from('viagens')
        .insert({

            operador_id:
                operadorAtual.id,

            nome:
                nome,

            valor_diaria:
                valorDiaria

        })
        .select()
        .single();


    if (error) {

        console.error(
            'ERRO AO CRIAR VIAGEM:',
            error
        );

        throw error;
    }


    console.log(
        'VIAGEM CRIADA:',
        data
    );

    await registrarAuditoria(
        'acao',
        `Criou a viagem "${nome}".`
    );

    return data;
}


// =====================================================
// ATUALIZAR VIAGEM
// =====================================================

async function atualizarViagem(
    viagemId,
    nome,
    valorDiaria
) {

    if (!operadorAtual) {

        await carregarOperadorAtual();

        if (!operadorAtual) {

            throw new Error(
                'Operador não autenticado.'
            );
        }
    }


    nome =
        String(
            nome || ''
        ).trim();


    valorDiaria =
        Number(
            valorDiaria
        );


    if (!nome) {

        throw new Error(
            'Informe o nome da viagem.'
        );
    }


    if (
        isNaN(valorDiaria) ||
        valorDiaria <= 0
    ) {

        throw new Error(
            'Informe um valor de diária válido.'
        );
    }


    const {
        data,
        error
    } = await supabaseClient
        .from('viagens')
        .update({

            nome:
                nome,

            valor_diaria:
                valorDiaria

        })
        .eq(
            'id',
            viagemId
        )
        .eq(
            'operador_id',
            operadorAtual.id
        )
        .select()
        .single();


    if (error) {

        console.error(
            'ERRO AO ATUALIZAR VIAGEM:',
            error
        );

        throw error;
    }


    console.log(
        'VIAGEM ATUALIZADA:',
        data
    );

    await registrarAuditoria(
        'acao',
        `Atualizou a viagem "${nome}".`
    );

    return data;
}


// =====================================================
// EXCLUIR VIAGEM
// =====================================================

async function excluirViagem(
    viagemId
) {

    if (!operadorAtual) {

        await carregarOperadorAtual();

        if (!operadorAtual) {

            return false;
        }
    }


    if (
        !confirm(
            'Excluir esta viagem?'
        )
    ) {

        return false;
    }


    // Primeiro remove os lançamentos
    // vinculados à viagem.

    const {
        error: lancamentoError
    } = await supabaseClient
        .from('lancamentos')
        .delete()
        .eq(
            'viagem_id',
            viagemId
        )
        .eq(
            'operador_id',
            operadorAtual.id
        );


    if (lancamentoError) {

        console.error(
            'ERRO AO EXCLUIR LANÇAMENTOS:',
            lancamentoError
        );

        throw lancamentoError;
    }


    // Depois remove a viagem.

    const {
        error
    } = await supabaseClient
        .from('viagens')
        .delete()
        .eq(
            'id',
            viagemId
        )
        .eq(
            'operador_id',
            operadorAtual.id
        );


    if (error) {

        console.error(
            'ERRO AO EXCLUIR VIAGEM:',
            error
        );

        throw error;
    }


    console.log(
        'VIAGEM EXCLUÍDA:',
        viagemId
    );

    await registrarAuditoria(
        'acao',
        `Excluiu a viagem (ID ${viagemId}).`
    );

    return true;
}


// =====================================================
// CRIAR LANÇAMENTO
// =====================================================

async function criarLancamento(
    dados
) {

    if (!operadorAtual) {

        await carregarOperadorAtual();

        if (!operadorAtual) {

            throw new Error(
                'Operador não autenticado.'
            );
        }
    }


    if (!dados.viagem_id) {

        throw new Error(
            'Informe a viagem.'
        );
    }


    if (!dados.data) {

        throw new Error(
            'Informe a data.'
        );
    }


    const valor =
        Number(
            dados.valor
        );


    if (
        isNaN(valor) ||
        valor <= 0
    ) {

        throw new Error(
            'Informe um valor válido.'
        );
    }


    const registro = {

        operador_id:
            operadorAtual.id,

        viagem_id:
            dados.viagem_id,

        data:
            dados.data,

        tipo:
            dados.tipo || 'gasto',

        valor:
            valor,

        descricao:
            dados.descricao || null,

        cidade_origem:
            dados.cidade_origem || null,

        cidade_destino:
            dados.cidade_destino || null
    };


    const {
        data,
        error
    } = await supabaseClient
        .from('lancamentos')
        .insert(
            registro
        )
        .select()
        .single();


    if (error) {

        console.error(
            'ERRO AO CRIAR LANÇAMENTO:',
            error
        );

        throw error;
    }


    console.log(
        'LANÇAMENTO CRIADO:',
        data
    );

    await registrarAuditoria(
        'acao',
        `Criou um lançamento (${registro.tipo}) no valor de R$ ${valor}.`
    );

    return data;
}


// =====================================================
// EXCLUIR LANÇAMENTO
// =====================================================

async function excluirLancamento(
    lancamentoId
) {

    if (!operadorAtual) {

        await carregarOperadorAtual();

        if (!operadorAtual) {

            return false;
        }
    }


    if (
        !confirm(
            'Remover este lançamento? Essa ação não pode ser desfeita.'
        )
    ) {

        return false;
    }


    const {
        error
    } = await supabaseClient
        .from('lancamentos')
        .delete()
        .eq(
            'id',
            lancamentoId
        )
        .eq(
            'operador_id',
            operadorAtual.id
        );


    if (error) {

        console.error(
            'ERRO AO EXCLUIR LANÇAMENTO:',
            error
        );

        throw error;
    }


    console.log(
        'LANÇAMENTO EXCLUÍDO:',
        lancamentoId
    );

    await registrarAuditoria(
        'acao',
        `Excluiu um lançamento (ID ${lancamentoId}).`
    );

    return true;
}


// =====================================================
// ATUALIZAR LANÇAMENTO
// =====================================================

async function atualizarLancamento(
    lancamentoId,
    dados
) {

    if (!operadorAtual) {

        await carregarOperadorAtual();

        if (!operadorAtual) {

            throw new Error(
                'Operador não autenticado.'
            );
        }
    }


    const valor =
        Number(
            dados.valor
        );


    if (
        isNaN(valor) ||
        valor <= 0
    ) {

        throw new Error(
            'Informe um valor válido.'
        );
    }


    const {
        data,
        error
    } = await supabaseClient
        .from('lancamentos')
        .update({

            data:
                dados.data,

            tipo:
                dados.tipo,

            valor:
                valor,

            descricao:
                dados.descricao || null,

            cidade_origem:
                dados.cidade_origem || null,

            cidade_destino:
                dados.cidade_destino || null

        })
        .eq(
            'id',
            lancamentoId
        )
        .eq(
            'operador_id',
            operadorAtual.id
        )
        .select()
        .single();


    if (error) {

        console.error(
            'ERRO AO ATUALIZAR LANÇAMENTO:',
            error
        );

        throw error;
    }


    console.log(
        'LANÇAMENTO ATUALIZADO:',
        data
    );

    await registrarAuditoria(
        'acao',
        `Atualizou um lançamento (ID ${lancamentoId}).`
    );

    return data;
}