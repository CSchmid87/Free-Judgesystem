import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Judgesystem',
  description: 'LAN-based judging system for events',
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
