// =====================================================
// LOJA ONLINE - Cadastro de produtos da vitrine pública
// Versão com: categoria, status (disponível/vendido) e múltiplas fotos (até 5)
// =====================================================

const BUCKET_FOTOS = 'loja-fotos';
const MAX_FOTOS = 5;

const CATEGORIAS_BASE = [
    'Roupas',
    'Calçados',
    'Eletrônicos',
    'Móveis',
    'Decoração',
    'Brinquedos',
    'Outros'
];

const gridProdutos = document.getElementById('gridProdutos');

const modalProduto = document.getElementById('modalProduto');
const formProduto = document.getElementById('formProduto');
const tituloModalProduto = document.getElementById('tituloModalProduto');

const produtoId = document.getElementById('produtoId');
const produtoTitulo = document.getElementById('produtoTitulo');
const produtoPreco = document.getElementById('produtoPreco');
const produtoCategoria = document.getElementById('produtoCategoria');
const produtoStatus = document.getElementById('produtoStatus');
const produtoDescricao = document.getElementById('produtoDescricao');
const produtoFoto = document.getElementById('produtoFoto');
const listaFotos = document.getElementById('listaFotos');
const contadorFotos = document.getElementById('contadorFotos');
const produtoAtivo = document.getElementById('produtoAtivo');

const btnNovoProduto = document.getElementById('btnNovoProduto');
const btnFecharModalProduto = document.getElementById('btnFecharModalProduto');
const btnCancelarProduto = document.getElementById('btnCancelarProduto');
const btnSalvarProduto = document.getElementById('btnSalvarProduto');

const btnUsarCelular = document.getElementById('btnUsarCelular');
const modalQrCode = document.getElementById('modalQrCode');
const imagemQrCode = document.getElementById('imagemQrCode');
const statusQrCode = document.getElementById('statusQrCode');
const btnFecharQrCode = document.getElementById('btnFecharQrCode');
const btnConcluirQrCode = document.getElementById('btnConcluirQrCode');

let todosOsProdutosCache = [];

// Lista de trabalho das fotos do produto que está sendo criado/editado.
// Cada item: { tipo: 'existente' | 'novo', url, arquivo? }
let fotosAtuais = [];

let sessaoQrAtual = null;
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

    todosOsProdutosCache = produtos || [];

    if (todosOsProdutosCache.length === 0) {
        gridProdutos.innerHTML = '<p class="mensagem">Nenhum produto cadastrado ainda.</p>';
        return;
    }

    gridProdutos.innerHTML = '';

    todosOsProdutosCache.forEach((produto) => {

        const fotos = Array.isArray(produto.fotos) ? produto.fotos : [];
        const capa = fotos[0] || produto.foto_url || '';
        const totalFotos = fotos.length || (produto.foto_url ? 1 : 0);

        const card = document.createElement('div');
        card.className = 'produto-card';

        card.innerHTML = `
            <div class="produto-capa">
                <img class="produto-foto" src="${capa}" alt="${escaparHtml(produto.titulo)}"
                     onerror="this.style.opacity='0.3'">
                ${totalFotos > 1 ? `<span class="selo-fotos">📷 ${totalFotos}</span>` : ''}
                ${produto.status === 'vendido' ? '<span class="selo-vendido">VENDIDO</span>' : ''}
            </div>

            <div class="produto-info">

                <div class="produto-titulo"></div>

                ${produto.categoria ? `<div class="produto-categoria"></div>` : ''}

                <div class="produto-preco"></div>

                <div class="produto-status"></div>

                <div class="produto-acoes">
                    <button class="btn-editar" type="button">✏️ Editar</button>
                    <button class="btn-excluir" type="button">🗑️ Excluir</button>
                </div>

            </div>
        `;

        card.querySelector('.produto-titulo').textContent = produto.titulo;

        const categoriaEl = card.querySelector('.produto-categoria');
        if (categoriaEl) {
            categoriaEl.textContent = produto.categoria;
        }

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
// SELECT DE CATEGORIA
// =====================================================

function preencherSelectCategorias(categoriaSelecionada) {

    const categoriasExistentes = todosOsProdutosCache
        .map(p => p.categoria)
        .filter(Boolean);

    const todasCategorias = Array.from(
        new Set([...CATEGORIAS_BASE, ...categoriasExistentes])
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (categoriaSelecionada && !todasCategorias.includes(categoriaSelecionada)) {
        todasCategorias.push(categoriaSelecionada);
    }

    produtoCategoria.innerHTML = todasCategorias
        .map(cat => `<option value="${escaparHtml(cat)}">${escaparHtml(cat)}</option>`)
        .join('');

    if (categoriaSelecionada) {
        produtoCategoria.value = categoriaSelecionada;
    }
}


// =====================================================
// GERENCIAMENTO DAS FOTOS (LISTA DE TRABALHO)
// =====================================================

function renderizarFotos() {

    listaFotos.innerHTML = '';

    fotosAtuais.forEach((foto, indice) => {

        const item = document.createElement('div');
        item.className = 'foto-item';

        item.innerHTML = `
            <img src="${foto.url}" alt="Foto ${indice + 1}">
            ${indice === 0 ? '<span class="capa">Capa</span>' : ''}
            <button type="button" class="remover" title="Remover">×</button>
            ${indice !== 0 ? '<button type="button" class="mover" title="Definir como capa">★</button>' : ''}
        `;

        item.querySelector('.remover').addEventListener('click', () => {
            fotosAtuais.splice(indice, 1);
            renderizarFotos();
        });

        const btnMover = item.querySelector('.mover');
        if (btnMover) {
            btnMover.addEventListener('click', () => {
                const [selecionada] = fotosAtuais.splice(indice, 1);
                fotosAtuais.unshift(selecionada);
                renderizarFotos();
            });
        }

        listaFotos.appendChild(item);
    });

    contadorFotos.textContent = fotosAtuais.length > 0
        ? `${fotosAtuais.length} de ${MAX_FOTOS} fotos adicionadas.`
        : 'Nenhuma foto adicionada.';
}

function adicionarFotosNovas(arquivos) {

    const espacoDisponivel = MAX_FOTOS - fotosAtuais.length;

    if (espacoDisponivel <= 0) {
        alert(`Você já atingiu o limite de ${MAX_FOTOS} fotos.`);
        return;
    }

    const arquivosAceitos = Array.from(arquivos).slice(0, espacoDisponivel);

    if (arquivos.length > arquivosAceitos.length) {
        alert(`Só é possível adicionar mais ${espacoDisponivel} foto(s). O restante foi ignorado.`);
    }

    arquivosAceitos.forEach((arquivo) => {
        fotosAtuais.push({
            tipo: 'novo',
            arquivo,
            url: URL.createObjectURL(arquivo)
        });
    });

    renderizarFotos();
}

produtoFoto.addEventListener('change', () => {

    if (produtoFoto.files && produtoFoto.files.length > 0) {
        adicionarFotosNovas(produtoFoto.files);
    }

    produtoFoto.value = '';
});


// =====================================================
// MODAL - ABRIR / FECHAR
// =====================================================

function abrirNovoProduto() {

    formProduto.reset();

    produtoId.value = '';
    fotosAtuais = [];
    renderizarFotos();

    produtoAtivo.checked = true;
    produtoStatus.value = 'disponivel';

    preencherSelectCategorias();

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
    produtoStatus.value = produto.status || 'disponivel';

    preencherSelectCategorias(produto.categoria || '');

    const fotosExistentes = Array.isArray(produto.fotos) && produto.fotos.length > 0
        ? produto.fotos
        : (produto.foto_url ? [produto.foto_url] : []);

    fotosAtuais = fotosExistentes.map(url => ({ tipo: 'existente', url }));
    renderizarFotos();

    tituloModalProduto.textContent = 'Editar produto';

    modalProduto.style.display = 'flex';
}

function fecharModalProduto() {
    modalProduto.style.display = 'none';
    formProduto.reset();
    fotosAtuais = [];
    fecharModalQrCode();
}

btnNovoProduto.addEventListener('click', abrirNovoProduto);
btnFecharModalProduto.addEventListener('click', fecharModalProduto);
btnCancelarProduto.addEventListener('click', fecharModalProduto);


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

        // Envia pro storage só as fotos novas (as "existentes" já têm URL)
        const urlsFinais = [];

        for (const foto of fotosAtuais) {

            if (foto.tipo === 'existente') {
                urlsFinais.push(foto.url);
            } else {
                const urlEnviada = await enviarFotoProduto(foto.arquivo);
                urlsFinais.push(urlEnviada);
            }
        }

        const dadosProduto = {
            titulo: produtoTitulo.value.trim(),
            preco: parseFloat(produtoPreco.value) || 0,
            categoria: produtoCategoria.value || null,
            status: produtoStatus.value || 'disponivel',
            descricao: produtoDescricao.value.trim(),
            fotos: urlsFinais,
            foto_url: urlsFinais[0] || null,
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
// ENVIAR FOTOS PELO CELULAR (QR CODE) - aceita várias seguidas
// =====================================================

function pararVerificacaoQr() {

    if (intervaloVerificacaoQr) {
        clearInterval(intervaloVerificacaoQr);
        intervaloVerificacaoQr = null;
    }
}

function fecharModalQrCode() {
    pararVerificacaoQr();
    sessaoQrAtual = null;
    modalQrCode.style.display = 'none';
}

btnFecharQrCode.addEventListener('click', fecharModalQrCode);
btnConcluirQrCode.addEventListener('click', fecharModalQrCode);

async function gerarNovaSessaoQr() {

    const { data: sessao, error } = await supabaseClient
        .from('loja_upload_sessoes')
        .insert({ status: 'aguardando' })
        .select('id')
        .single();

    if (error || !sessao) {
        throw error || new Error('Não foi possível criar a sessão.');
    }

    sessaoQrAtual = sessao.id;

    const linkUpload =
        `${window.location.origin}/loja-upload-foto.html?sessao=${sessao.id}`;

    imagemQrCode.src =
        'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' +
        encodeURIComponent(linkUpload);

    statusQrCode.textContent = 'Aguardando foto...';
    statusQrCode.style.color = '#168c8c';

    pararVerificacaoQr();

    intervaloVerificacaoQr = setInterval(async () => {

        if (!sessaoQrAtual) {
            return;
        }

        const { data: sessaoAtual, error: erroChecagem } =
            await supabaseClient
                .from('loja_upload_sessoes')
                .select('status, foto_url')
                .eq('id', sessaoQrAtual)
                .single();

        if (erroChecagem) {
            return;
        }

        if (sessaoAtual.status === 'concluido' && sessaoAtual.foto_url) {

            pararVerificacaoQr();

            fotosAtuais.push({
                tipo: 'existente',
                url: sessaoAtual.foto_url
            });

            renderizarFotos();

            if (fotosAtuais.length >= MAX_FOTOS) {

                statusQrCode.textContent = `✅ Limite de ${MAX_FOTOS} fotos atingido!`;
                statusQrCode.style.color = '#15803d';

                setTimeout(fecharModalQrCode, 1500);

            } else {

                statusQrCode.textContent = '✅ Foto recebida! Pode enviar outra ou concluir.';
                statusQrCode.style.color = '#15803d';

                await gerarNovaSessaoQr();
            }
        }

    }, 2500);
}

btnUsarCelular.addEventListener('click', async () => {

    if (fotosAtuais.length >= MAX_FOTOS) {
        alert(`Você já atingiu o limite de ${MAX_FOTOS} fotos.`);
        return;
    }

    try {

        modalQrCode.style.display = 'flex';
        await gerarNovaSessaoQr();

    } catch (erro) {

        console.error('Erro ao gerar QR Code:', erro);

        alert(
            'Não foi possível gerar o QR Code.\n\n' +
            (erro.message || 'Erro desconhecido.')
        );

        fecharModalQrCode();
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
