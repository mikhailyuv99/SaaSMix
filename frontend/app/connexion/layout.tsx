import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre compte Siberia Mix pour accéder à vos projets et lancer vos mixes.",
};

export default function ConnexionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
