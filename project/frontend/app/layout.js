import "./globals.css";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata = {
  title: "OpsMind AI",
  description: "AI DevOps incident intelligence with memory-backed fix generation",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OpsMind AI",
  },
  icons: {
    icon: "/6F1E559E-0C07-40B9-8C4C-C151F5B31A6A_1_201_a.jpeg?v=20260415",
    apple: "/6F1E559E-0C07-40B9-8C4C-C151F5B31A6A_1_201_a.jpeg?v=20260415",
  },
  other: {
    "theme-color": "#0f172a",
    "mobile-web-app-capable": "yes",
    "mobile-web-app-status-bar-style": "black-translucent",
  },
};

// Proper viewport export for Next.js 14+
export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  viewportFit: "cover",
  userScalable: false,
  maximumScale: 1,
  minimumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="w-full h-full overflow-x-hidden">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="format-detection" content="email=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OpsMind" />
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="msapplication-TileImage" content="/6F1E559E-0C07-40B9-8C4C-C151F5B31A6A_1_201_a.jpeg" />
      </head>
      <body className={`${spaceGrotesk.variable} w-full min-h-screen overflow-x-hidden`}>{children}</body>
    </html>
  );
}
