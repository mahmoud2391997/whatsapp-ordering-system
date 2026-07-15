import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fresh Greens — WhatsApp Ordering System',
  description: 'Farm-fresh vegetables & fruits ordering via WhatsApp AI bot',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
