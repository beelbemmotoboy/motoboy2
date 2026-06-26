const defaultVapidPublicKey = 'BAXY5I91oBPJ1H3AtwWz8JvlhepX2ZPZ7vslDEQ25W1J6N5hDxOBiu3zxii9xl8t7Vl-qEFbQ6luAjOnzgMsOIs';
const vapidPublicKey = import.meta.env.VITE_OBRAS_PUSH_PUBLIC_KEY || defaultVapidPublicKey;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function getPushSupportStatus() {
  if (!('Notification' in window)) return 'unsupported';
  if (!('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission || 'default';
}

export async function registerObrasServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Este navegador nao suporta service worker.');
  }

  const baseUrl = import.meta.env.BASE_URL || '/';
  return navigator.serviceWorker.register(`${baseUrl}obras-push-sw.js`);
}

export async function enableObrasPushNotifications(saveSubscription) {
  if (!('Notification' in window)) {
    throw new Error('Este navegador nao suporta notificacoes.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissao de notificacao nao concedida.');
  }

  const registration = await registerObrasServiceWorker();

  if (!('PushManager' in window) || !registration.pushManager || !vapidPublicKey) {
    return { mode: 'local', permission };
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  const serialized = subscription.toJSON();
  await saveSubscription({
    endpoint: serialized.endpoint,
    keys: serialized.keys,
    userAgent: navigator.userAgent,
  });

  return { mode: 'push', permission };
}

export async function disableObrasPushNotifications(deactivateSubscription) {
  if (!('serviceWorker' in navigator)) {
    return { mode: 'unsupported' };
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration?.pushManager
    ? await registration.pushManager.getSubscription()
    : null;

  if (!subscription) {
    return { mode: 'none' };
  }

  const { endpoint } = subscription;
  await subscription.unsubscribe();
  if (endpoint && deactivateSubscription) {
    await deactivateSubscription(endpoint);
  }

  return { mode: 'disabled', endpoint };
}

export async function showObrasBrowserNotification(notification) {
  if (!notification || !('Notification' in window) || Notification.permission !== 'granted') return false;

  const registration = 'serviceWorker' in navigator
    ? await navigator.serviceWorker.getRegistration()
    : null;
  const options = {
    body: notification.body || '',
    tag: notification.id || notification.type || 'beelbem-obras',
    data: {
      url: `${import.meta.env.BASE_URL || '/'}?notification=${notification.id || ''}`,
      notification,
    },
    icon: `${import.meta.env.BASE_URL || '/'}beelbem-obras.svg`,
    badge: `${import.meta.env.BASE_URL || '/'}beelbem-obras.svg`,
  };

  if (registration?.showNotification) {
    await registration.showNotification(notification.title || 'Beelbem Obras', options);
    return true;
  }

  new Notification(notification.title || 'Beelbem Obras', options);
  return true;
}
