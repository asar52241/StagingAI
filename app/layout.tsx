import type { Metadata } from "next";
import "./globals.css";
// Syne is used by the Edition Mode design
// eslint-disable-next-line @next/next/no-page-custom-font -- loaded in head for all pages

export const metadata: Metadata = {
  title: "Удаление предметов с фото для недвижимости",
  description:
    "Онлайн-инструмент для агентов и брокеров: уберите мебель и лишние вещи с фото комнаты и подготовьте кадр для объявления.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
