import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'SAL Builder', description: 'Weekly SAL – Golden Goose' };

// imposta il tema prima del render (preferenza salvata, altrimenti sistema)
const THEME_JS = `try{var t=localStorage.getItem('sal-theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_JS }} /></head>
      <body>{children}</body>
    </html>
  );
}
