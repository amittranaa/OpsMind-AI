export const metadata = {
  title: "Hindsight DevOps Assistant",
  description: "Incident learning with memory-backed fix generation",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
