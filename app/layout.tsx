import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'US-A00 Minimal App',
  description: 'Minimal Next.js app with persistence layer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
