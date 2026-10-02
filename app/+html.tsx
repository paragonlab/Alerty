import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

const SITE = "https://pulso-ciudadano.com";
const TITLE = "Pulso Ciudadano · Cómo está tu colonia en Culiacán";
const DESCRIPTION =
  "Vecinos de Culiacán avisándose entre sí. Checa cómo está tu zona antes de salir. No es un canal de denuncia y no llama al 911.";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Pulso Ciudadano",
      alternateName: "Pulso",
      url: SITE,
      inLanguage: "es-MX",
      description: DESCRIPTION,
    },
    {
      "@type": "MobileApplication",
      name: "Pulso Ciudadano",
      alternateName: "Pulso",
      url: SITE,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "iOS, Android, Web",
      inLanguage: "es-MX",
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
      areaServed: {
        "@type": "City",
        name: "Culiacán",
        containedInPlace: { "@type": "State", name: "Sinaloa" },
      },
    },
  ],
};

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={SITE} />
        <link rel="icon" href="/favicon.ico" />
        <link rel="alternate" type="text/plain" href={`${SITE}/llms.txt`} title="Resumen para agentes" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_MX" />
        <meta property="og:site_name" content="Pulso Ciudadano" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE} />
        <meta property="og:image" content={`${SITE}/icon.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={`${SITE}/icon.png`} />
        <meta name="theme-color" content="#F6F2EA" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        <noscript>
          <h1>Pulso Ciudadano</h1>
          <p>{DESCRIPTION}</p>
          <p>
            Es la red de vecinos de Culiacán para saber cómo está tu zona antes de salir. El mapa, los
            pulsos y el aviso a vecinos cercanos no se envían a la policía ni al 911. Resumen para
            agentes: <a href="/llms.txt">llms.txt</a>. Privacidad: <a href="/privacy">/privacy</a>.
          </p>
        </noscript>
      </body>
    </html>
  );
}
