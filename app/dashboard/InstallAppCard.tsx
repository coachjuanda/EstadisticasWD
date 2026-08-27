'use client';

import { useEffect, useState } from 'react';

type Platform = 'ios' | 'android' | 'other';

// Evento no estandarizado (solo Chromium) -- @types/dom todavía no lo trae.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS 13+ reporta un userAgent de Mac de escritorio; se distingue por
  // soporte de touch, que un Mac real no tiene.
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function isStandaloneDisplay() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari/iOS expone esta bandera propia -- no soporta display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallAppCard() {
  const [platform, setPlatform] = useState<Platform>('other');
  const [hidden, setHidden] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // navigator/matchMedia no existen durante el render en servidor -- este
    // primer setState tiene que pasar después de montar en el cliente (si se
    // calculara durante el render con un lazy initializer, el resultado no
    // coincidiría con el HTML ya enviado por el servidor y React marcaría un
    // mismatch de hidratación).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform());
    setHidden(isStandaloneDisplay());

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setHidden(true);
      setDeferredPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (hidden) return null;

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  // Chrome/Android (y Chrome/Edge de escritorio) sí exponen el prompt nativo
  // -- se usa ese en vez de instrucciones manuales cuando está disponible.
  if (deferredPrompt) {
    return (
      <div className="mx-auto mt-8 max-w-sm rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center">
        <p className="text-sm font-medium text-neutral-800">Instala la app para acceso rápido desde tu celular</p>
        <button
          type="button"
          onClick={handleInstallClick}
          className="mt-3 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover"
        >
          Instalar app
        </button>
      </div>
    );
  }

  // Safari/iOS nunca dispara beforeinstallprompt -- la única forma de
  // instalar es manual, así que se muestran instrucciones fijas.
  if (platform === 'ios') {
    return (
      <div className="mx-auto mt-8 max-w-sm rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center text-sm text-neutral-700">
        <p className="font-medium text-neutral-800">Instala la app en tu iPhone o iPad</p>
        <p className="mt-2">
          Toca el botón <strong>Compartir</strong> (el cuadro con la flecha hacia arriba) en la barra de Safari y luego elige{' '}
          <strong>&ldquo;Agregar a inicio&rdquo;</strong>.
        </p>
      </div>
    );
  }

  // Android sin beforeinstallprompt todavía disponible (navegador distinto
  // de Chrome, o Chrome aún evaluando los criterios de instalabilidad) --
  // se da la ruta manual equivalente en vez de no mostrar nada.
  if (platform === 'android') {
    return (
      <div className="mx-auto mt-8 max-w-sm rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center text-sm text-neutral-700">
        <p className="font-medium text-neutral-800">Instala la app en tu Android</p>
        <p className="mt-2">
          Abre el menú (⋮) de Chrome y elige <strong>&ldquo;Instalar app&rdquo;</strong> o{' '}
          <strong>&ldquo;Agregar a pantalla de inicio&rdquo;</strong>.
        </p>
      </div>
    );
  }

  return null;
}
