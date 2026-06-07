import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { CrowdProvider } from '@/context/CrowdContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import Navbar from '@/components/Navbar';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SmartCrowd — Plateforme de Gestion de Foule',
  description: 'Plateforme intelligente de gestion des foules en stade alimentée par l\'IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        <ThemeProvider>
          <ToastProvider>
            <CrowdProvider>
              <Navbar />
              <main>{children}</main>
            </CrowdProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
