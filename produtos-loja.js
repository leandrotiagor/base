// =====================================================
// LOJA ONLINE - Cadastro de produtos da vitrine pública
// =====================================================

const BUCKET_FOTOS = 'loja-fotos';

const gridProdutos = document.getElementById('gridProdutos');

const modalProduto = document.getElementById('modalProduto');
const formProduto = document.getElementById('formProduto');
const tituloModalProduto = document.getElementById('tituloModalProduto');

const produtoId = document.getElementById('produtoId');
const produtoTitulo = document.getElementById('produtoTitulo');
const produtoPreco = document.getElementById('produtoPreco');
const produtoDescricao = document.getElementById('produtoDescricao');
const produtoFoto = document.getElementById('produtoFoto');
const previaFoto = document.getElementById('previaFoto');
const produtoAtivo = document.getElementById('produtoAtivo');

const btnNovoProduto = document.getElementById('btnNovoProduto');
const btnFecharModalProduto = document.getElementById('btnFecharModalProduto');
const btnCancelarProduto = document.getElementById('btnCancelarProduto');
const btnSalvarProduto = document.getElementById('btnSalvarProduto');

let fotoAtualUrl = null;
let arquivoFotoSelecionado = null;

const btnUsarCelular = document.getElementById('btnUsarCelular');
const modalQrCode = document.getElementById('modalQrCode');
const imagemQrCode = document.getElementById('imagemQrCode');
const statusQrCode = document.getElementById('statusQrCode');
const btnFecharQrCode = document.getElementById('btnFecharQrCode');

let intervaloVerificacaoQr = null;


// =====================================================
// VERIFICA LOGIN
// =====================================================

async function verificarAcesso() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return false;
    }

    return true;
}


// =====================================================
// CARREGAR PRODUTOS
// =====================================================

async function carregarProdutos() {

    gridProdutos.innerHTML = '<p class="mensagem">Carregando produtos...</p>';

    const { data: produtos, error } = await supabaseClient
        .from('loja_produtos')
        .select('*')
        .order('criado_em', { ascending: false });

    if (error) {
        console.error('Erro ao carregar produtos:', error);
        gridProdutos.innerHTML = '<p class="mensagem">Não foi possível carregar os produtos.</p>';
        return;
    }

    if (!produtos || produtos.length === 0) {
        gridProdutos.innerHTML = '<p class="mensagem">Nenhum produto cadastrado ainda.</p>';
        return;
    }

    gridProdutos.innerHTML = '';

    produtos.forEach((produto) => {

        const card = document.createElement('div');
        card.className = 'produto-card';

        card.innerHTML = `
            <img class="produto-foto" src="${produto.foto_url || ''}" alt="${escaparHtml(produto.titulo)}"
                 onerror="this.style.opacity='0.3'">

            <div class="produto-info">

                <div class="produto-titulo"></div>

                <div class="produto-preco"></div>

                <div class="produto-status"></div>

                <div class="produto-acoes">
                    <button class="btn-editar" type="button">✏️ Editar</button>
                    <button class="btn-excluir" type="button">🗑️ Excluir</button>
                </div>

            </div>
        `;

        card.querySelector('.produto-titulo').textContent = produto.titulo;

        card.querySelector('.produto-preco').textContent =
            formatarPreco(produto.preco);

        const statusEl = card.querySelector('.produto-status');
        statusEl.textContent = produto.ativo ? '● Visível na vitrine' : '● Oculto';
        statusEl.classList.add(produto.ativo ? 'ativo' : 'inativo');

        card.querySelector('.btn-editar')
            .addEventListener('click', () => abrirEdicaoProduto(produto));

        card.querySelector('.btn-excluir')
            .addEventListener('click', () => excluirProduto(produto));

        gridProdutos.appendChild(card);
    });
}


function formatarPreco(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto || '';
    return div.innerHTML;
}


// =====================================================
// MODAL - ABRIR / FECHAR
// =====================================================

function abrirNovoProduto() {

    formProduto.reset();

    produtoId.value = '';
    fotoAtualUrl = null;
    arquivoFotoSelecionado = null;
    previaFoto.style.display = 'none';
    produtoAtivo.checked = true;

    tituloModalProduto.textContent = '➕ Novo produto';

    modalProduto.style.display = 'flex';
}

function abrirEdicaoProduto(produto) {

    formProduto.reset();

    produtoId.value = produto.id;
    produtoTitulo.value = produto.titulo || '';
    produtoPreco.value = produto.preco || '';
    produtoDescricao.value = produto.descricao || '';
    produtoAtivo.checked = !!produto.ativo;

    fotoAtualUrl = produto.foto_url || null;
    arquivoFotoSelecionado = null;

    if (fotoAtualUrl) {
        previaFoto.src = fotoAtualUrl;
        previaFoto.style.display = 'block';
    } else {
        previaFoto.style.display = 'none';
    }

    tituloModalProduto.textContent = 'Editar produto';

    modalProduto.style.display = 'flex';
}

function fecharModalProduto() {
    modalProduto.style.display = 'none';
    formProduto.reset();
    pararVerificacaoQr();
}

btnNovoProduto.addEventListener('click', abrirNovoProduto);
btnFecharModalProduto.addEventListener('click', fecharModalProduto);
btnCancelarProduto.addEventListener('click', fecharModalProduto);


// =====================================================
// PRÉVIA DA FOTO SELECIONADA
// =====================================================

produtoFoto.addEventListener('change', () => {

    const arquivo = produtoFoto.files[0];

    if (!arquivo) {
        arquivoFotoSelecionado = null;
        return;
    }

    arquivoFotoSelecionado = arquivo;

    const leitor = new FileReader();

    leitor.onload = (evento) => {
        previaFoto.src = evento.target.result;
        previaFoto.style.display = 'block';
    };

    leitor.readAsDataURL(arquivo);
});


// =====================================================
// ENVIAR FOTO PARA O STORAGE
// =====================================================

async function enviarFotoProduto(arquivo) {

    const extensao = arquivo.name.split('.').pop();

    const nomeArquivo =
        `produto_${Date.now()}_${Math.random().toString(36).slice(2)}.${extensao}`;

    const { error: erroUpload } = await supabaseClient
        .storage
        .from(BUCKET_FOTOS)
        .upload(nomeArquivo, arquivo, {
            cacheControl: '3600',
            upsert: false
        });

    if (erroUpload) {
        throw erroUpload;
    }

    const { data: dadosPublicos } = supabaseClient
        .storage
        .from(BUCKET_FOTOS)
        .getPublicUrl(nomeArquivo);

    return dadosPublicos.publicUrl;
}


// =====================================================
// SALVAR (CRIAR OU EDITAR) PRODUTO
// =====================================================

formProduto.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    btnSalvarProduto.disabled = true;
    btnSalvarProduto.textContent = 'Salvando...';

    try {

        let urlFoto = fotoAtualUrl;

        if (arquivoFotoSelecionado) {
            urlFoto = await enviarFotoProduto(arquivoFotoSelecionado);
        }

        const dadosProduto = {
            titulo: produtoTitulo.value.trim(),
            preco: parseFloat(produtoPreco.value) || 0,
            descricao: produtoDescricao.value.trim(),
            foto_url: urlFoto,
            ativo: produtoAtivo.checked
        };

        let erroSalvar = null;

        if (produtoId.value) {

            const { error } = await supabaseClient
                .from('loja_produtos')
                .update(dadosProduto)
                .eq('id', produtoId.value);

            erroSalvar = error;

        } else {

            const { error } = await supabaseClient
                .from('loja_produtos')
                .insert(dadosProduto);

            erroSalvar = error;
        }

        if (erroSalvar) {
            throw erroSalvar;
        }

        await registrarAuditoria(
            'acao',
            produtoId.value
                ? `Editou o produto da loja: ${dadosProduto.titulo}`
                : `Cadastrou um novo produto na loja: ${dadosProduto.titulo}`
        );

        fecharModalProduto();
        await carregarProdutos();

    } catch (erro) {

        console.error('Erro ao salvar produto:', erro);

        alert(
            'Não foi possível salvar o produto.\n\n' +
            (erro.message || 'Erro desconhecido.')
        );

    } finally {

        btnSalvarProduto.disabled = false;
        btnSalvarProduto.textContent = 'Salvar produto';
    }
});


// =====================================================
// EXCLUIR PRODUTO
// =====================================================

async function excluirProduto(produto) {

    const confirmar = confirm(
        `Excluir o produto "${produto.titulo}"? Essa ação não pode ser desfeita.`
    );

    if (!confirmar) {
        return;
    }

    try {

        const { error } = await supabaseClient
            .from('loja_produtos')
            .delete()
            .eq('id', produto.id);

        if (error) {
            throw error;
        }

        await registrarAuditoria(
            'acao',
            `Excluiu o produto da loja: ${produto.titulo}`
        );

        await carregarProdutos();

    } catch (erro) {

        console.error('Erro ao excluir produto:', erro);

        alert(
            'Não foi possível excluir o produto.\n\n' +
            (erro.message || 'Erro desconhecido.')
        );
    }
}


// =====================================================
// ENVIAR FOTO PELO CELULAR (QR CODE)
// =====================================================

function pararVerificacaoQr() {

    if (intervaloVerificacaoQr) {
        clearInterval(intervaloVerificacaoQr);
        intervaloVerificacaoQr = null;
    }
}

function fecharModalQrCode() {
    pararVerificacaoQr();
    modalQrCode.style.display = 'none';
}

btnFecharQrCode.addEventListener('click', fecharModalQrCode);

btnUsarCelular.addEventListener('click', async () => {

    try {

        // Cria uma sessão de upload no banco
        const { data: sessao, error } = await supabaseClient
            .from('loja_upload_sessoes')
            .insert({ status: 'aguardando' })
            .select('id')
            .single();

        if (error || !sessao) {
            throw error || new Error('Não foi possível criar a sessão.');
        }

        // Monta o link que vai dentro do QR Code (mesma origem do sistema)
        const linkUpload =
            `${window.location.origin}/loja-upload-foto.html?sessao=${sessao.id}`;

        // Gera a imagem do QR Code (serviço público, só recebe o link acima)
        imagemQrCode.src =
            'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' +
            encodeURIComponent(linkUpload);

        statusQrCode.textContent = 'Aguardando foto...';
        statusQrCode.style.color = '#168c8c';

        modalQrCode.style.display = 'flex';

        // Fica checando se a foto já chegou
        pararVerificacaoQr();

        intervaloVerificacaoQr = setInterval(async () => {

            const { data: sessaoAtual, error: erroChecagem } =
                await supabaseClient
                    .from('loja_upload_sessoes')
                    .select('status, foto_url')
                    .eq('id', sessao.id)
                    .single();

            if (erroChecagem) {
                return;
            }

            if (sessaoAtual.status === 'concluido' && sessaoAtual.foto_url) {

                pararVerificacaoQr();

                // Usa a foto recebida no formulário do produto
                fotoAtualUrl = sessaoAtual.foto_url;
                arquivoFotoSelecionado = null;
                produtoFoto.value = '';

                previaFoto.src = fotoAtualUrl;
                previaFoto.style.display = 'block';

                statusQrCode.textContent = '✅ Foto recebida!';
                statusQrCode.style.color = '#15803d';

                setTimeout(fecharModalQrCode, 1200);
            }

        }, 2500);

    } catch (erro) {

        console.error('Erro ao gerar QR Code:', erro);

        alert(
            'Não foi possível gerar o QR Code.\n\n' +
            (erro.message || 'Erro desconhecido.')
        );
    }
});


// =====================================================
// INÍCIO
// =====================================================

(async function iniciar() {

    const acessoLiberado = await verificarAcesso();

    if (acessoLiberado) {
        carregarProdutos();
    }

})();
