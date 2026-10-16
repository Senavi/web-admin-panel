'use client';

/**
 * PROJECT: the cookie banner and the loader of consent-based scripts
 * (Settings → Integrations). A small card in the bottom-right corner, not a
 * full-width bar. Scripts load only after "Accept"; the choice is remembered
 * for 6 months and the footer's "Cookie settings" reopens it. Texts are
 * interface texts (namespace `cookie`); styling uses the site tokens. Replace
 * this file to restyle it.
 */
import Script from 'next/script';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { buttonClasses } from './ui/button-styles';

const COOKIE_NAME = 'cookie-consent';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
/** Event the footer link dispatches to reopen the banner. */
export const OPEN_COOKIE_SETTINGS = 'cookie-settings:open';

type Choice = 'accepted' | 'declined';

export interface ConsentScriptProps {
  readonly id: string;
  readonly strategy: 'afterInteractive' | 'lazyOnload';
  readonly src?: string;
  readonly inline?: string;
}

export interface CookieBannerTexts {
  readonly label: string;
  readonly text: string;
  readonly privacy: string;
  readonly accept: string;
  readonly decline: string;
}

const PENDING = 'pending';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stored choice (`accepted` / `declined`), '' when none, `pending` while rendering on the server. */
function readChoice(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match?.[1] === 'accepted' || match?.[1] === 'declined' ? match[1] : '';
}

function writeChoice(choice: Choice): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${choice}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  listeners.forEach((listener) => listener());
}

export function CookieBanner({
  texts,
  scripts,
  privacyHref,
}: {
  texts: CookieBannerTexts;
  scripts: readonly ConsentScriptProps[];
  privacyHref?: string;
}) {
  const stored = useSyncExternalStore(subscribe, readChoice, () => PENDING);
  const [reopened, setReopened] = useState(false);
  const choice = stored === 'accepted' || stored === 'declined' ? stored : null;
  // Nothing is shown before the cookie has been read on the client.
  const open = stored !== PENDING && (choice === null || reopened);

  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen);
  }, []);

  const decide = (next: Choice) => {
    const wasAccepted = choice === 'accepted';
    setReopened(false);
    writeChoice(next);
    // Scripts that are already running cannot be unloaded: start fresh without them.
    if (wasAccepted && next === 'declined') window.location.reload();
  };

  return (
    <>
      {choice === 'accepted'
        ? scripts.map((script) =>
            script.src ? (
              <Script key={script.id} id={script.id} src={script.src} strategy={script.strategy} />
            ) : (
              <Script key={script.id} id={script.id} strategy={script.strategy}>
                {script.inline}
              </Script>
            ),
          )
        : null}
      {open ? (
        <section
          aria-label={texts.label}
          data-cookie-banner
          className="fixed right-4 bottom-4 left-4 z-overlay flex max-w-banner flex-col gap-4 rounded-lg border-thin border-border bg-background p-5 shadow-lg sm:left-auto"
        >
          <p className="text-body-sm text-foreground">
            {texts.text}
            {privacyHref ? (
              <>
                {' '}
                <a href={privacyHref} className="underline underline-offset-4 hover:text-primary">
                  {texts.privacy}
                </a>
              </>
            ) : null}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className={buttonClasses('secondary', 'flex-1')}
              onClick={() => decide('declined')}
            >
              {texts.decline}
            </button>
            <button
              type="button"
              className={buttonClasses('secondary', 'flex-1')}
              onClick={() => decide('accepted')}
            >
              {texts.accept}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Footer link that reopens the banner. */
export function CookieSettingsLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="text-body-sm text-muted-foreground hover:text-foreground"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}
    >
      {label}
    </button>
  );
}
