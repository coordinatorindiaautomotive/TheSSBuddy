'use client';
import { Poppins, Roboto } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { SWRConfig } from 'swr';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-roboto',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${roboto.variable}`}>
      <body className={`${poppins.className} font-sans antialiased text-slate-900 selection:bg-blue-600 selection:text-white`}>
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
