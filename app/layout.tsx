import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoofLead",
  description: "Property research and estimates for roofing contractors.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
