// ==================== ASSISTIR — jogo ao vivo dentro do app ====================
// Embute a transmissão ao vivo (ex.: CazéTV) num player do YouTube dentro do app,
// pra galera assistir e palpitar na mesma tela.
//
// ⚠️ A transmissão pode: (a) BLOQUEAR a incorporação (embed) por direitos — comum
// em Copa —, mostrando "Assista no YouTube"; e/ou (b) ser GEO-RESTRITA ao Brasil.
// Nada disso é controlável pelo nosso lado (é decisão do canal). Por isso o botão
// "Abrir no YouTube" fica SEMPRE visível como plano B.
//
// Manutenção: por padrão embute a LIVE ATUAL do canal (não precisa trocar link por
// jogo). Se quiser fixar um vídeo específico, cole o ID em VIDEO_ID.
const TRANSMISSAO = {
  CANAL_ID: 'UCZiYbVptd3PVPf4f6eR6UaQ', // CazéTV — embute a live atual automaticamente
  VIDEO_ID: '',                          // opcional: ID de um vídeo específico (tem prioridade)
  LINK_YT: 'https://www.youtube.com/@CazeTV/live', // botão/atalho "Abrir no YouTube"
  NOME: 'CazéTV',
};

let _assistirCarregado = false;

// Monta o iframe do player. Só cria uma vez (não reinicia o vídeo ao voltar pra view).
function carregarViewAssistir() {
  const player = document.getElementById('assistir-player');
  if (player && !_assistirCarregado) {
    const src = TRANSMISSAO.VIDEO_ID
      ? `https://www.youtube.com/embed/${TRANSMISSAO.VIDEO_ID}?autoplay=1&playsinline=1`
      : `https://www.youtube.com/embed/live_stream?channel=${TRANSMISSAO.CANAL_ID}&autoplay=1&playsinline=1`;
    player.innerHTML = `<iframe src="${src}" title="Transmissão ao vivo"
        class="absolute inset-0 w-full h-full" frameborder="0"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    _assistirCarregado = true;
  }
  const linkBtn = document.getElementById('assistir-link-yt');
  if (linkBtn) linkBtn.href = TRANSMISSAO.LINK_YT;
}
