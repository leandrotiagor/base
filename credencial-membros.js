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
        numero: document.getElementById('numero').value.trim() || null,
        bairro: document.getElementById('bairro').value.trim() || null,
        cidade: document.getElementById('cidade').value.trim() || null,
        estado: document.getElementById('estado').value.trim() || null,
        onde_congrega: document.getElementById('ondeCongrega').value.trim() || null,
        estado_civil: document.getElementById('estadoCivil').value.trim() || null,
        naturalidade: document.getElementById('naturalidade').value.trim() || null,
        naturalidade_estado: document.getElementById('naturalidadeEstado').value.trim() || null,
        nome_pai: document.getElementById('nomePai').value.trim() || null,
        nome_mae: document.getElementById('nomeMae').value.trim() || null,
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
    document.getElementById('numero').value = membro.numero || '';
    document.getElementById('bairro').value = membro.bairro || '';
    document.getElementById('cidade').value = membro.cidade || '';
    document.getElementById('estado').value = membro.estado || '';
    document.getElementById('ondeCongrega').value = membro.onde_congrega || '';
    document.getElementById('estadoCivil').value = membro.estado_civil || '';
    document.getElementById('naturalidade').value = membro.naturalidade || '';
    document.getElementById('naturalidadeEstado').value = membro.naturalidade_estado || '';
    document.getElementById('nomePai').value = membro.nome_pai || '';
    document.getElementById('nomeMae').value = membro.nome_mae || '';

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


function imprimirCredencial(membro) {

    const janela = window.open('', '_blank', 'width=820,height=400');

    if (!janela) {
        alert('Seu navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
        return;
    }

    const fotoSrc = membro.foto_base64
        ? `data:${membro.foto_mime_type || 'image/jpeg'};base64,${membro.foto_base64}`
        : '';

    const enderecoLinha = [membro.endereco, membro.numero ? `N° ${membro.numero}` : null]
        .filter(Boolean).join(', ');

    const naturalLinha = [membro.naturalidade, membro.naturalidade_estado]
        .filter(Boolean).join(' - ');

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Credencial - ${membro.nome_completo}</title>
            <style>
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

                @page {
                    size: 20cm 7cm;
                    margin: 0;
                }

                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 10px;
                    background: #eee;
                }

                .credencial {
                    display: flex;
                    width: 20cm;
                    height: 7cm;
                    background: #fff;
                    border: 1px solid #999;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.15);
                    overflow: hidden;
                }

                .painel {
                    width: 10cm;
                    height: 7cm;
                    padding: 0.35cm 0.4cm;
                    border-left: 0.12cm solid #c0392b;
                    position: relative;
                    overflow: hidden;
                }

                .painel + .painel {
                    border-left: 0.12cm dashed #1f3a93;
                }

                .titulo-painel {
                    font-size: 0.34cm;
                    font-weight: bold;
                    margin: 0 0 0.12cm;
                    letter-spacing: 0.01em;
                    line-height: 1.15;
                }

                .regua {
                    height: 0.06cm;
                    background: #c0392b;
                    margin-bottom: 0.04cm;
                }

                .regua-azul {
                    height: 0.045cm;
                    background: #1f3a93;
                    margin-bottom: 0.22cm;
                }

                .linha-campo {
                    font-size: 0.24cm;
                    margin-bottom: 0.14cm;
                    border-bottom: 0.4pt solid #333;
                    padding-bottom: 0.03cm;
                    line-height: 1.2;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .linha-campo .rotulo { color: #111; }
                .linha-campo .valor { font-weight: normal; }

                .bloco-esquerdo-inferior {
                    display: flex;
                    gap: 0.3cm;
                    margin-top: 0.2cm;
                    align-items: flex-start;
                }

                .foto-credencial {
                    width: 2.4cm;
                    height: 3.1cm;
                    object-fit: cover;
                    border: 0.4pt solid #ccc;
                    background: #f3f4f6;
                    flex-shrink: 0;
                }

                .verso-texto {
                    font-family: Georgia, 'Times New Roman', serif;
                    font-style: italic;
                    font-size: 0.24cm;
                    text-align: center;
                    line-height: 1.35;
                }
                .verso-texto .citacao {
                    display: block;
                    margin-top: 0.15cm;
                    font-weight: bold;
                    font-style: normal;
                    font-size: 0.22cm;
                }

                .nota-rodape-esquerda {
                    font-size: 0.16cm;
                    color: #333;
                    text-align: center;
                    margin-top: 0.2cm;
                    line-height: 1.2;
                }

                .subtitulo-endereco {
                    font-size: 0.19cm;
                    color: #333;
                    text-align: center;
                    margin-bottom: 0.18cm;
                    line-height: 1.25;
                }

                .campo-linha-dupla {
                    display: flex;
                    gap: 0.2cm;
                }
                .campo-linha-dupla .linha-campo { flex: 1; min-width: 0; }

                .assinatura {
                    margin-top: 0.22cm;
                    text-align: center;
                }
                .assinatura .nome-assinatura {
                    font-family: 'Brush Script MT', cursive;
                    font-size: 0.4cm;
                    border-bottom: 0.4pt solid #333;
                    padding-bottom: 0.05cm;
                    margin-bottom: 0.05cm;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .assinatura .rotulo-assinatura {
                    font-size: 0.17cm;
                    color: #555;
                }

                @media print {
                    body {
                        padding: 0;
                        background: #fff;
                        align-items: stretch;
                        justify-content: stretch;
                    }
                    .credencial {
                        border: none;
                        box-shadow: none;
                    }
                }
            </style>
        </head>
        <body>

            <div class="credencial">

                <div class="painel">

                    <div class="titulo-painel">IDENTIDADE DE MEMBRO</div>
                    <div class="regua"></div>
                    <div class="regua-azul"></div>

                    <div class="linha-campo">
                        <span class="rotulo">Onde congrega:</span>
                        <span class="valor"> ${escaparHtmlCredencial(membro.onde_congrega || '')}</span>
                    </div>

                    <div class="linha-campo">
                        <span class="rotulo">Data do batismo:</span>
                        <span class="valor"> ${formatarDataBR(membro.data_batismo)}</span>
                    </div>

                    <div class="bloco-esquerdo-inferior">

                        ${fotoSrc ? `<img class="foto-credencial" src="${fotoSrc}" alt="Foto">` : '<div class="foto-credencial"></div>'}

                        <div class="verso-texto">
                            Sofre pois, comigo, as aflições como bom soldado de Jesus Cristo.
                            <span class="citacao">II Tim. 2.3</span>
                        </div>

                    </div>

                    <div class="nota-rodape-esquerda">Só é Válida com o Visto Anual do Dirigente no Verso</div>

                </div>

                <div class="painel">

                    <div class="titulo-painel">IGREJA PENTECOSTAL DE JESUS CRISTO</div>

                    <div class="subtitulo-endereco">
                        Sede: R. Gen. Djalma da Rocha Lima, 70 - Cep 81730-370<br>
                        Boqueirão - Curitiba - Pr.
                    </div>

                    <div class="linha-campo">
                        <span class="rotulo">Nome:</span>
                        <span class="valor"> ${escaparHtmlCredencial(membro.nome_completo)}</span>
                    </div>

                    <div class="linha-campo">
                        <span class="rotulo">End.:</span>
                        <span class="valor"> ${escaparHtmlCredencial(enderecoLinha || '—')}</span>
                    </div>

                    <div class="linha-campo">
                        <span class="rotulo">Bairro:</span>
                        <span class="valor"> ${escaparHtmlCredencial(membro.bairro || '—')}</span>
                    </div>

                    <div class="campo-linha-dupla">
                        <div class="linha-campo">
                            <span class="rotulo">Cidade:</span>
                            <span class="valor"> ${escaparHtmlCredencial(membro.cidade || '—')}</span>
                        </div>
                        <div class="linha-campo" style="flex: 0 0 1.2cm;">
                            <span class="rotulo">Est.:</span>
                            <span class="valor"> ${escaparHtmlCredencial(membro.estado || '—')}</span>
                        </div>
                    </div>

                    <div class="campo-linha-dupla">
                        <div class="linha-campo">
                            <span class="rotulo">Nascimento:</span>
                            <span class="valor"> ${formatarDataBR(membro.data_nascimento)}</span>
                        </div>
                        <div class="linha-campo">
                            <span class="rotulo">Est. Civil:</span>
                            <span class="valor"> ${escaparHtmlCredencial(membro.estado_civil || '—')}</span>
                        </div>
                    </div>

                    <div class="linha-campo">
                        <span class="rotulo">Natural:</span>
                        <span class="valor"> ${escaparHtmlCredencial(naturalLinha || '—')}</span>
                    </div>

                    <div class="linha-campo">
                        <span class="rotulo">Pai:</span>
                        <span class="valor"> ${escaparHtmlCredencial(membro.nome_pai || '—')}</span>
                    </div>

                    <div class="linha-campo">
                        <span class="rotulo">Mãe:</span>
                        <span class="valor"> ${escaparHtmlCredencial(membro.nome_mae || '—')}</span>
                    </div>

                    <div class="assinatura">
                        <div class="nome-assinatura">${escaparHtmlCredencial(membro.nome_completo)}</div>
                        <div class="rotulo-assinatura">Ass. do Portador</div>
                    </div>

                </div>

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
