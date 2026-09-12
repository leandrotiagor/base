// =====================================================
// MÓDULO CARNÊ DE CONTRIBUIÇÃO
// =====================================================

const VERSICULO_CARNE = 'Quando vocês oferecerem um sacrifício de gratidão ao Senhor, ofereçam-no de maneira que seja aceito em favor de vocês.';
const CITACAO_CARNE = 'Levítico 22:29';


function gerarHtmlCapa(finalidade) {

    return `
        <div class="folha folha-capa">
            <div class="capa-igreja">IGREJA PENTECOSTAL DE JESUS CRISTO</div>
            <div class="capa-titulo">Semeador</div>
            <div class="capa-subtitulo">Carnê de Contribuição Voluntária</div>
            <div class="capa-finalidade">${escaparHtmlCarne(finalidade)}</div>
        </div>
    `;
}


function gerarHtmlParcela(numero) {

    const numeroFormatado = String(numero).padStart(2, '0');

    return `
        <div class="folha folha-parcela">

            <div class="parcela-canhoto">
                <div class="parcela-cabecalho">
                    <span class="parcela-rotulo">Contribuição Voluntária</span>
                    <span class="parcela-numero">Parcela ${numeroFormatado}</span>
                </div>
                <div class="parcela-versiculo">
                    ${VERSICULO_CARNE}
                    <span class="parcela-citacao">${CITACAO_CARNE}</span>
                </div>
                <div class="parcela-campo-linha">
                    <span class="parcela-campo-rotulo">Recebedor:</span>
                    <span class="parcela-campo-linha-em-branco"></span>
                </div>
            </div>

            <div class="parcela-principal">
                <div class="parcela-cabecalho">
                    <span class="parcela-rotulo">Contribuição Voluntária</span>
                    <span class="parcela-numero">Parcela ${numeroFormatado}</span>
                </div>
                <div class="parcela-versiculo">
                    ${VERSICULO_CARNE}
                    <span class="parcela-citacao">${CITACAO_CARNE}</span>
                </div>
                <div class="parcela-campos-inferiores">
                    <div class="parcela-campo-linha">
                        <span class="parcela-campo-rotulo">Data:</span>
                        <span class="parcela-campo-linha-em-branco parcela-campo-curto"></span>
                    </div>
                    <div class="parcela-campo-linha">
                        <span class="parcela-campo-rotulo">R$</span>
                        <span class="parcela-campo-linha-em-branco parcela-campo-curto"></span>
                    </div>
                    <div class="parcela-campo-linha parcela-campo-largo">
                        <span class="parcela-campo-rotulo">Contribuinte:</span>
                        <span class="parcela-campo-linha-em-branco"></span>
                    </div>
                </div>
            </div>

        </div>
    `;
}


function escaparHtmlCarne(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}


document.getElementById('formCarne').addEventListener('submit', (evento) => {

    evento.preventDefault();

    const finalidade = document.getElementById('finalidade').value.trim() ||
        'AQUISIÇÃO DE MATERIAIS E AJUDA PARA REFORMA DA IGREJA';

    const quantidade = Math.max(1, Math.min(20, Number(document.getElementById('quantidade').value) || 1));

    gerarCarne(finalidade, quantidade);
});


function gerarCarne(finalidade, quantidade) {

    const janela = window.open('', '_blank', 'width=900,height=1000');

    if (!janela) {
        alert('Seu navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
        return;
    }

    let folhasHtml = '';

    for (let copia = 0; copia < quantidade; copia++) {

        folhasHtml += gerarHtmlCapa(finalidade);

        for (let parcela = 1; parcela <= 10; parcela++) {
            folhasHtml += gerarHtmlParcela(parcela);
        }
    }

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Carnê de Contribuição</title>
            <style>
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

                @page {
                    size: A4 portrait;
                    margin: 1cm;
                }

                body {
                    font-family: Arial, sans-serif;
                    background: #eee;
                    margin: 0;
                    padding: 1cm;
                }

                .pilha {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.3cm;
                }

                .folha {
                    width: 21cm;
                    height: 6cm;
                    background: #fff;
                    border: 1px solid #999;
                    display: flex;
                    overflow: hidden;
                    break-inside: avoid;
                    page-break-inside: avoid;
                    position: relative;
                }

                /* ===== CAPA ===== */

                .folha-capa {
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 0.3cm;
                }

                .capa-igreja {
                    font-size: 0.32cm;
                    font-weight: bold;
                    color: #1f3a93;
                    letter-spacing: 0.03em;
                    margin-bottom: 0.15cm;
                }

                .capa-titulo {
                    font-family: 'Brush Script MT', cursive;
                    font-size: 1.6cm;
                    color: #6b2737;
                    line-height: 1;
                }

                .capa-subtitulo {
                    font-size: 0.4cm;
                    font-weight: bold;
                    color: #333;
                    margin-top: 0.1cm;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .capa-finalidade {
                    font-size: 0.26cm;
                    color: #555;
                    margin-top: 0.25cm;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                /* ===== PARCELAS ===== */

                .parcela-canhoto {
                    width: 6cm;
                    height: 6cm;
                    padding: 0.3cm;
                    border-right: 1px dashed #999;
                    display: flex;
                    flex-direction: column;
                }

                .parcela-principal {
                    width: 15cm;
                    height: 6cm;
                    padding: 0.3cm 0.5cm;
                    display: flex;
                    flex-direction: column;
                }

                .parcela-cabecalho {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    margin-bottom: 0.15cm;
                }

                .parcela-rotulo {
                    font-size: 0.22cm;
                    font-weight: bold;
                    color: #6b2737;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .parcela-numero {
                    font-size: 0.32cm;
                    font-weight: bold;
                    color: #111;
                    margin-top: 0.05cm;
                }

                .parcela-versiculo {
                    font-family: Georgia, 'Times New Roman', serif;
                    font-style: italic;
                    font-size: 0.19cm;
                    color: #444;
                    text-align: center;
                    line-height: 1.3;
                    flex: 1;
                }

                .parcela-citacao {
                    display: block;
                    margin-top: 0.08cm;
                    font-weight: bold;
                    font-style: normal;
                    font-size: 0.18cm;
                }

                .parcela-campo-linha {
                    display: flex;
                    align-items: flex-end;
                    gap: 0.15cm;
                    margin-top: 0.15cm;
                }

                .parcela-campo-rotulo {
                    font-size: 0.2cm;
                    font-weight: bold;
                    color: #333;
                    white-space: nowrap;
                }

                .parcela-campo-linha-em-branco {
                    flex: 1;
                    border-bottom: 0.4pt solid #999;
                    height: 0.4cm;
                }

                .parcela-campos-inferiores {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0 0.6cm;
                }

                .parcela-campo-curto {
                    max-width: 3cm;
                }

                .parcela-campo-largo {
                    width: 100%;
                }

                @media print {
                    body { padding: 0; background: #fff; }
                    .pilha { gap: 0.2cm; }
                }
            </style>
        </head>
        <body>

            <div class="pilha">
                ${folhasHtml}
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
