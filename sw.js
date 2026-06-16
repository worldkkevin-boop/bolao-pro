// ==================== ESCUTA DE NOTIFICAÇÕES PUSH ====================

// Disparado quando o servidor (Supabase) envia um Push
self.addEventListener('push', function(event) {
  if (event.data) {
    let data = {};
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
    
    const options = {
      body: data.body || 'Você tem uma novidade no bolão!',
      icon: '/midia/icon-192.png', // Aponta para a imagem na pasta midia
      vibrate: [200, 100, 200, 100, 200], // Vibração personalizada 📳
      data: {
        url: data.url || '/' // Para onde o app vai se o cara clicar na notificação
      }
    };

    const title = data.title || 'Bolão Pro 🏆';

    // Mostra a notificação na tela
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Disparado quando o usuário clica na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Fecha a notificação da tela
  
  // Abre o aplicativo na URL que veio junto com a notificação
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Se o app já estiver aberto, foca nele e muda a rota
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Se estiver fechado, abre uma nova janela no app
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
