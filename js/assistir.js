// ==================== ASSISTIR — jogo ao vivo dentro do app ====================
// A transmissão da CazéTV (Copa) BLOQUEIA o player embutido (embed) e é
// geo-restrita ao Brasil — isso é decisão do canal, não dá pra contornar por código
// (e "puxar o stream" seria pirataria, então não fazemos). Por isso a tela é um
// LANÇADOR: explica e manda assistir no YouTube (grátis/4K), com uma dica de
// picture-in-picture pra assistir + palpitar ao mesmo tempo.
//
// O player embutido (iframe) só é usado se você configurar um VIDEO_ID de um vídeo
// que PERMITA incorporação — aí ele toca dentro do app. Sem VIDEO_ID, mostra o
// lançador (caso padrão da CazéTV).
const TRANSMISSAO = {
  CANAL_ID: 'UCZiYbVptd3PVPf4f6eR6UaQ', // CazéTV (referência)
  VIDEO_ID: '',                          // opcional: ID de um vídeo QUE PERMITA embed -> toca no app
  LINK_YT: 'https://www.youtube.com/@CazeTV/live', // "Assistir no YouTube"
  NOME: 'CazéTV',
};

let _assistirCarregado = false;

function carregarViewAssistir() {
  const wrap = document.getElementById('assistir-player-wrap');
  const launcher = document.getElementById('assistir-launcher');
  const player = document.getElementById('assistir-player');

  // Só embute se houver um VIDEO_ID configurado (assumindo que permite embed).
  if (TRANSMISSAO.VIDEO_ID && player && wrap) {
    if (!_assistirCarregado) {
      player.innerHTML = `<iframe src="https://www.youtube.com/embed/${TRANSMISSAO.VIDEO_ID}?autoplay=1&playsinline=1"
          title="Transmissão ao vivo" class="absolute inset-0 w-full h-full" frameborder="0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      _assistirCarregado = true;
    }
    wrap.classList.remove('hidden');
    if (launcher) launcher.classList.add('hidden');
  } else {
    // Caso padrão (CazéTV): sem embed, mostra o lançador.
    if (wrap) wrap.classList.add('hidden');
    if (launcher) launcher.classList.remove('hidden');
  }

  const linkBtn = document.getElementById('assistir-link-yt');
  if (linkBtn) linkBtn.href = TRANSMISSAO.LINK_YT;
}
