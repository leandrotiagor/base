// =====================================================
// MÓDULO CREDENCIAL DE MEMBROS
// =====================================================

const formMembro = document.getElementById('formMembro');
const tituloForm = document.getElementById('tituloForm');
const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
const listaMembros = document.getElementById('listaMembros');

const fotoPreview = document.getElementById('fotoPreview');
const fotoPlaceholder = document.getElementById('fotoPlaceholder');
const fotoImg = document.getElementById('fotoImg');
const inputFoto = document.getElementById('inputFoto');

let fotoBase64Atual = null;
let fotoMimeAtual = null;

let nomeOperadorAtual = null;
let usuarioAtualId = null;


// =====================================================
// FOTO - UPLOAD DIRETO (CLICANDO NA PRÉVIA)
// =====================================================

inputFoto.addEventListener('change', () => {

    const arquivo = inputFoto.files[0];

    if (!arquivo) return;

    const leitor = new FileReader();

    leitor.onload = (evento) => {

        const base64Completo = evento.target.result;

        fotoBase64Atual = base64Completo.split(',')[1];
        fotoMimeAtual = arquivo.type;

        mostrarFotoPreview(base64Completo);
    };

    leitor.readAsDataURL(arquivo);
});


function mostrarFotoPreview(dataUrlOuBase64Completo) {

    fotoImg.src = dataUrlOuBase64Completo;
    fotoImg.style.display = 'block';
    fotoPlaceholder.style.display = 'none';
}

function limparFotoPreview() {

    fotoBase64Atual = null;
    fotoMimeAtual = null;
    fotoImg.src = '';
    fotoImg.style.display = 'none';
    fotoPlaceholder.style.display = 'block';
    inputFoto.value = '';
}


// =====================================================
// FOTO - VIA QR CODE (CELULAR)
// =====================================================

const modalQrcodeFoto = document.getElementById('modalQrcodeFoto');
const areaQrcodeFoto = document.getElementById('areaQrcodeFoto');
const statusQrcodeFoto = document.getElementById('statusQrcodeFoto');

let sessaoFotoId = null;
let intervaloVerificacaoFoto = null;

const URL_BASE_UPLOAD = window.location.origin + window.location.pathname.replace('credencial-membros.html', 'upload-foto.html');


document.getElementById('btnQrcodeFoto').addEventListener('click', async () => {

    modalQrcodeFoto.style.display = 'flex';
    areaQrcodeFoto.innerHTML = '';
    statusQrcodeFoto.innerHTML = '<span class="status-spinner"></span> Gerando QR Code...';

    const { data: sessao, error } = await supabaseClient
        .from('upload_sessoes')
        .insert({
            operador_id: usuarioAtualId,
            operador_nome: nomeOperadorAtual,
            tipo: 'foto'
        })
        .select()
        .single();

    if (error || !sessao) {
        console.error('Erro ao criar sessão de foto:', error);
        statusQrcodeFoto.textContent = 'Não foi possível gerar o QR Code.';
        return;
    }

    sessaoFotoId = sessao.id;

    const urlSessao = `${URL_BASE_UPLOAD}?sessao=${sessao.id}`;

    new QRCode(areaQrcodeFoto, {
        text: urlSessao,
        width: 200,
        height: 200
    });

    statusQrcodeFoto.innerHTML = '<span class="status-spinner"></span> Aguardando a foto...';

    iniciarVerificacaoFoto();
});


function iniciarVerificacaoFoto() {

    pararVerificacaoFoto();

    const inicio = Date.now();
    const LIMITE_MS = 11 * 60 * 1000;

    intervaloVerificacaoFoto = setInterval(async () => {

        if (Date.now() - inicio > LIMITE_MS) {
            pararVerificacaoFoto();
            statusQrcodeFoto.textContent = 'Tempo esgotado. Feche e tente novamente.';
            return;
        }

        const { data: sessao, error } = await supabaseClient
            .from('upload_sessoes')
            .select('status, foto_base64, mime_type')
            .eq('id', sessaoFotoId)
            .single();

        if (error) {
            console.error('Erro ao verificar sessão de foto:', error);
            return;
        }

        if (sessao?.status === 'concluido') {

            pararVerificacaoFoto();

            fotoBase64Atual = sessao.foto_base64;
            fotoMimeAtual = sessao.mime_type || 'image/jpeg';

            mostrarFotoPreview(`data:${fotoMimeAtual};base64,${fotoBase64Atual}`);

            modalQrcodeFoto.style.display = 'none';
        }

    }, 3000);
}

function pararVerificacaoFoto() {
    if (intervaloVerificacaoFoto) {
        clearInterval(intervaloVerificacaoFoto);
        intervaloVerificacaoFoto = null;
    }
}

document.getElementById('btnFecharModalQrcode').addEventListener('click', () => {
    pararVerificacaoFoto();
    modalQrcodeFoto.style.display = 'none';
});


// =====================================================
// CARREGAR MEMBROS
// =====================================================

async function carregarMembros() {

    listaMembros.innerHTML = '<tr><td colspan="6" class="mensagem">Carregando membros...</td></tr>';

    const { data, error } = await supabaseClient
        .from('membros')
        .select('*')
        .order('nome_completo');

    if (error) {
        console.error('Erro ao carregar membros:', error);
        listaMembros.innerHTML = '<tr><td colspan="6" class="mensagem">Erro ao carregar membros.</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        listaMembros.innerHTML = '<tr><td colspan="6" class="mensagem">Nenhum membro cadastrado ainda.</td></tr>';
        return;
    }

    listaMembros.innerHTML = '';

    data.forEach(membro => {

        const linha = document.createElement('tr');

        linha.innerHTML = `
            <td></td>
            <td class="celula-nome"></td>
            <td class="celula-nascimento"></td>
            <td class="celula-batismo"></td>
            <td class="celula-telefone"></td>
            <td>
                <button type="button" class="btn-acao btn-editar">Editar</button>
                <button type="button" class="btn-imprimir btn-imprimir-credencial">🖨️ Credencial</button>
                <button type="button" class="btn-acao-excluir btn-excluir">Excluir</button>
            </td>
        `;

        const celulaFoto = linha.children[0];

        if (membro.foto_base64) {
            const img = document.createElement('img');
            img.className = 'foto-mini';
            img.src = `data:${membro.foto_mime_type || 'image/jpeg'};base64,${membro.foto_base64}`;
            celulaFoto.appendChild(img);
        } else {
            celulaFoto.textContent = '—';
        }

        linha.querySelector('.celula-nome').textContent = membro.nome_completo;
        linha.querySelector('.celula-nascimento').textContent = formatarDataBR(membro.data_nascimento);
        linha.querySelector('.celula-batismo').textContent = formatarDataBR(membro.data_batismo);
        linha.querySelector('.celula-telefone').textContent = membro.telefone || '—';

        linha.querySelector('.btn-editar').addEventListener('click', () => preencherParaEdicao(membro));
        linha.querySelector('.btn-excluir').addEventListener('click', () => excluirMembro(membro));
        linha.querySelector('.btn-imprimir-credencial').addEventListener('click', () => imprimirCredencial(membro));

        listaMembros.appendChild(linha);
    });
}


function formatarDataBR(dataISO) {
    if (!dataISO) return '—';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}


// =====================================================
// SALVAR (CRIAR OU EDITAR)
// =====================================================

formMembro.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    const id = document.getElementById('membroId').value;

    const dados = {
        nome_completo: document.getElementById('nomeCompleto').value.trim(),
        data_nascimento: document.getElementById('dataNascimento').value || null,
        data_batismo: document.getElementById('dataBatismo').value || null,
        telefone: document.getElementById('telefone').value.trim() || null,
        endereco: document.getElementById('endereco').value.trim() || null,
        foto_base64: fotoBase64Atual,
        foto_mime_type: fotoMimeAtual
    };

    if (!dados.nome_completo) {
        alert('Informe o nome completo do membro.');
        return;
    }

    const botao = document.getElementById('btnSalvarMembro');
    botao.disabled = true;

    try {

        if (id) {

            const { error } = await supabaseClient
                .from('membros')
                .update(dados)
                .eq('id', id);

            if (error) throw error;

            await registrarAuditoria('acao', `Editou o membro "${dados.nome_completo}".`);

        } else {

            const { error } = await supabaseClient
                .from('membros')
                .insert({
                    ...dados,
                    operador_id: usuarioAtualId,
                    operador_nome: nomeOperadorAtual
                });

            if (error) throw error;

            await registrarAuditoria('acao', `Cadastrou o membro "${dados.nome_completo}".`);
        }

        cancelarEdicao();

        await carregarMembros();

    } catch (erro) {

        console.error('Erro ao salvar membro:', erro);
        alert('Não foi possível salvar o membro.\n\nDetalhes: ' + (erro.message || JSON.stringify(erro)));

    } finally {

        botao.disabled = false;
    }
});


// =====================================================
// EDITAR / CANCELAR
// =====================================================

function preencherParaEdicao(membro) {

    document.getElementById('membroId').value = membro.id;
    document.getElementById('nomeCompleto').value = membro.nome_completo;
    document.getElementById('dataNascimento').value = membro.data_nascimento || '';
    document.getElementById('dataBatismo').value = membro.data_batismo || '';
    document.getElementById('telefone').value = membro.telefone || '';
    document.getElementById('endereco').value = membro.endereco || '';

    if (membro.foto_base64) {
        fotoBase64Atual = membro.foto_base64;
        fotoMimeAtual = membro.foto_mime_type || 'image/jpeg';
        mostrarFotoPreview(`data:${fotoMimeAtual};base64,${fotoBase64Atual}`);
    } else {
        limparFotoPreview();
    }

    tituloForm.textContent = 'Editar membro';
    btnCancelarEdicao.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {

    formMembro.reset();
    document.getElementById('membroId').value = '';
    limparFotoPreview();
    tituloForm.textContent = 'Novo membro';
    btnCancelarEdicao.style.display = 'none';
}

btnCancelarEdicao.addEventListener('click', cancelarEdicao);


// =====================================================
// EXCLUIR
// =====================================================

async function excluirMembro(membro) {

    if (!confirm(`Excluir o membro "${membro.nome_completo}"?`)) {
        return;
    }

    const { error } = await supabaseClient
        .from('membros')
        .delete()
        .eq('id', membro.id);

    if (error) {
        console.error('Erro ao excluir membro:', error);
        alert('Não foi possível excluir o membro.');
        return;
    }

    await registrarAuditoria('acao', `Excluiu o membro "${membro.nome_completo}".`);

    await carregarMembros();
}


// =====================================================
// IMPRIMIR CREDENCIAL
// =====================================================

const LOGO_BADGE_BASE64 = 'data:image/png;base64,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';

function imprimirCredencial(membro) {

    const janela = window.open('', '_blank', 'width=420,height=650');

    if (!janela) {
        alert('Seu navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
        return;
    }

    const fotoSrc = membro.foto_base64
        ? `data:${membro.foto_mime_type || 'image/jpeg'};base64,${membro.foto_base64}`
        : '';

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Credencial - ${membro.nome_completo}</title>
            <style>
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    padding: 20px;
                    background: #f0f0f0;
                }
                .credencial {
                    width: 340px;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid #ccc;
                    background: #fff;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.15);
                }
                .cabecalho {
                    background: #168c8c;
                    color: #fff;
                    padding: 14px 16px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .cabecalho img {
                    width: 34px;
                    height: 34px;
                    border-radius: 6px;
                    background: #fff;
                    object-fit: contain;
                    padding: 2px;
                }
                .cabecalho span {
                    font-size: 13px;
                    font-weight: bold;
                    line-height: 1.3;
                }
                .corpo {
                    padding: 18px 16px;
                    display: flex;
                    gap: 14px;
                }
                .foto-credencial {
                    width: 90px;
                    height: 114px;
                    border-radius: 8px;
                    object-fit: cover;
                    border: 1px solid #ddd;
                    background: #f3f4f6;
                    flex-shrink: 0;
                }
                .dados-credencial { flex: 1; min-width: 0; }
                .dados-credencial h2 {
                    font-size: 16px;
                    margin: 0 0 10px;
                    color: #111827;
                    word-break: break-word;
                }
                .campo {
                    font-size: 11.5px;
                    color: #374151;
                    margin-bottom: 6px;
                }
                .campo strong {
                    display: block;
                    font-size: 9.5px;
                    color: #9ca3af;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .rodape {
                    text-align: center;
                    font-size: 9px;
                    color: #9ca3af;
                    padding: 8px 16px 14px;
                }
                @media print {
                    body { padding: 0; background: #fff; }
                }
            </style>
        </head>
        <body>

            <div class="credencial">

                <div class="cabecalho">
                    <img src="${LOGO_BADGE_BASE64}" alt="Logo">
                    <span>IGREJA PENTECOSTAL<br>DE JESUS CRISTO</span>
                </div>

                <div class="corpo">

                    ${fotoSrc ? `<img class="foto-credencial" src="${fotoSrc}" alt="Foto">` : '<div class="foto-credencial"></div>'}

                    <div class="dados-credencial">
                        <h2>${escaparHtmlCredencial(membro.nome_completo)}</h2>

                        <div class="campo">
                            <strong>Data de nascimento</strong>
                            ${formatarDataBR(membro.data_nascimento)}
                        </div>

                        <div class="campo">
                            <strong>Data de batismo</strong>
                            ${formatarDataBR(membro.data_batismo)}
                        </div>

                        <div class="campo">
                            <strong>Telefone</strong>
                            ${escaparHtmlCredencial(membro.telefone || '—')}
                        </div>

                        <div class="campo">
                            <strong>Endereço</strong>
                            ${escaparHtmlCredencial(membro.endereco || '—')}
                        </div>
                    </div>

                </div>

                <div class="rodape">Credencial de Membro — LT Sistemas</div>

            </div>

        </body>
        </html>
    `);

    janela.document.close();

    janela.onload = () => {
        janela.focus();
        janela.print();
    };

    setTimeout(() => {
        try { janela.focus(); janela.print(); } catch (e) {}
    }, 400);
}

function escaparHtmlCredencial(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}


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

    usuarioAtualId = user.id;

    try {
        const { data: op } = await supabaseClient
            .from('operadores')
            .select('nome')
            .eq('id', user.id)
            .single();
        nomeOperadorAtual = op?.nome || null;
    } catch (e) {}

    await carregarMembros();

})();
