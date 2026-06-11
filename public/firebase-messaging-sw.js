/**
 * FCM background handler for web push. Registered with firebaseConfig query param from the client.
 */
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

function getFirebaseConfig() {
  try {
    const params = new URL(self.location.href).searchParams;
    const raw = params.get("firebaseConfig");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("[firebase-messaging-sw] Invalid firebaseConfig", e);
    return null;
  }
}

const firebaseConfig = getFirebaseConfig();
if (firebaseConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function (payload) {
    const data = payload.data || {};
    const title =
      payload.notification?.title ||
      data.articleTitle ||
      data.newsTitle ||
      data.title ||
      "GemX";
    const body = payload.notification?.body || data.body || "";

    const options = {
      body: body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: data,
    };

    return self.registration.showNotification(title, options);
  });
}

function resolveNotificationUrl(data) {
  if (data.screen === "article" && data.articleId) {
    return "/articles/" + data.articleId;
  }
  if (data.screen === "news" && data.newsId) {
    return "/news/" + data.newsId;
  }
  if (data.link && String(data.link).startsWith("/")) {
    return data.link;
  }
  return "/";
}

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const data = event.notification.data || {};
  const targetPath = resolveNotificationUrl(data);

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.indexOf(self.location.origin) === 0 && "focus" in client) {
            client.navigate(targetPath);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(self.location.origin + targetPath);
        }
      })
  );
});
