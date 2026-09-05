'use client';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { SWRConfig } from 'swr';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className={`${inter.className} font-sans antialiased text-slate-900 selection:bg-[#053D3A] selection:text-white`}>
        <SWRConfig
          value={{
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
            dedupingInterval: 30000,
            keepPreviousData: true,
            provider: () => new Map(),
          }}
        >
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: { borderRadius: '10px', background: '#1e293b', color: '#fff', fontSize: '14px' },
                success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </AuthProvider>
        </SWRConfig>
      </body>
    </html>
  );
}
