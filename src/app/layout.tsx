import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lingora API",
  description: "Backend API untuk platform Lingora",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
