import { Geist, Geist_Mono } from 'next/font/google';

/** Admin fonts (shadcn defaults). The public site declares its own in src/site/theme/fonts.ts. */
export const adminSans = Geist({ variable: '--font-sans', subsets: ['latin'], display: 'swap' });
export const adminMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});
