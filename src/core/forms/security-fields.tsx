import 'server-only';

import Script from 'next/script';

import { projectConfig } from '@project/config';

import { TURNSTILE_ORIGIN } from '@/core/project/define';

import { FormHiddenField } from './fields';
import { turnstileEnabled } from './spam';

/** Visually and semantically hidden; bots that fill every input reveal themselves. */
const HONEYPOT_STYLE = {
  position: 'absolute',
  left: '-10000px',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
} as const;

/**
 * Anti-spam fields for a site form (honeypot, Turnstile when enabled); render
 * inside the `<form>` (pass it from a server component to the client form as a
 * prop). The timing token is requested by `useSiteForm` after hydration, or
 * comes with the confirm step without JavaScript, so the page stays static.
 */
export function FormSecurityFields(_props: { formId: string }) {
  const siteKey = turnstileEnabled() ? projectConfig.forms.turnstile?.siteKey : undefined;
  return (
    <>
      <div aria-hidden="true" style={HONEYPOT_STYLE}>
        <label>
          Website
          <input type="text" name={FormHiddenField.Honeypot} tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {siteKey ? (
        <>
          <div className="cf-turnstile" data-sitekey={siteKey} />
          <Script src={`${TURNSTILE_ORIGIN}/turnstile/v0/api.js`} strategy="afterInteractive" />
        </>
      ) : null}
    </>
  );
}
