import { useState } from "react";
import styles from "./LandingPage.module.css";

interface LandingPageProps {
  onEnter: () => void;
}

const FEATURES = [
  {
    icon: "\uD83E\uDDD9",
    title: "KI-Dungeon Master",
    description:
      "Ein intelligenter Spielleiter, der auf jede deiner Entscheidungen reagiert und eine lebendige Welt erschafft.",
  },
  {
    icon: "\uD83C\uDFA8",
    title: "Generierte Bilder",
    description:
      "Jede Szene, jedes Item und dein Charakter-Portrait werden in Echtzeit von KI generiert.",
  },
  {
    icon: "\uD83C\uDFB2",
    title: "D&D-Regelsystem",
    description:
      "Authentische Wuerfelwuerfe, Faehigkeitschecks und Kampfmechaniken basierend auf D&D 5e.",
  },
  {
    icon: "\u267E\uFE0F",
    title: "Unendliche Geschichten",
    description:
      "Keine zwei Abenteuer sind gleich. Die KI erschafft einzigartige Narrative fuer jeden Spieler.",
  },
  {
    icon: "\uD83D\uDCF1",
    title: "AR Item-Scanner",
    description:
      "Scanne echte Gegenstaende mit deiner Kamera und verwandle sie in magische RPG-Items.",
  },
  {
    icon: "\uD83D\uDCAD",
    title: "Gedaechtnis-System",
    description:
      "Die KI erinnert sich an deine Entscheidungen und webt sie in zukuenftige Geschichten ein.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Erstelle deinen Helden",
    description:
      "Waehle Rasse, Klasse und Hintergrundgeschichte. Die KI generiert ein einzigartiges Portrait.",
  },
  {
    number: "02",
    title: "Waehle dein Abenteuer",
    description:
      "Von duesteren Verliesen bis zu magischen Maerkten — waehle dein Szenario.",
  },
  {
    number: "03",
    title: "Erlebe die Geschichte",
    description:
      "Triff Entscheidungen, kaempfe Monster, sammle Schaetze. Jede Wahl formt die Welt.",
  },
];

const PRICING = [
  {
    name: "Abenteurer",
    price: "Kostenlos",
    period: "",
    features: [
      "10 Aktionen pro Tag",
      "Basis-Bildgenerierung",
      "1 Charakter-Slot",
      "Standard-Szenarien",
    ],
    cta: "Jetzt starten",
    highlighted: false,
  },
  {
    name: "Held",
    price: "9,99€",
    period: "/Monat",
    features: [
      "Unbegrenzte Aktionen",
      "HD-Bildgenerierung",
      "5 Charakter-Slots",
      "Alle Szenarien",
      "AR Item-Scanner",
      "Prioritaets-Support",
    ],
    cta: "Premium werden",
    highlighted: true,
  },
  {
    name: "Legende",
    price: "19,99€",
    period: "/Monat",
    features: [
      "Alles aus Held",
      "Eigene Szenarien erstellen",
      "Multiplayer (bald)",
      "API-Zugang",
      "Fruehzugang zu Features",
      "Discord VIP-Rolle",
    ],
    cta: "Legende werden",
    highlighted: false,
  },
];

export function LandingPage({ onEnter }: LandingPageProps) {
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <div className={styles.landing}>
      {/* Ambient background */}
      <div className={styles.ambientBg}>
        <div className={styles.ambientOrb1} />
        <div className={styles.ambientOrb2} />
        <div className={styles.ambientOrb3} />
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>{"\u2728"}</span>
          <span className={styles.logoText}>Aetheria AI</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features">Features</a>
          <a href="#how-it-works">So funktioniert's</a>
          <a href="#pricing">Preise</a>
        </div>
        <button className={styles.navCta} onClick={onEnter}>
          Spielen
        </button>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span>{"\uD83C\uDFAE"}</span> KI-gesteuertes RPG
          </div>
          <h1 className={styles.heroTitle}>
            Dein Abenteuer.
            <br />
            <span className={styles.heroHighlight}>Unendlich einzigartig.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Aetheria AI ist ein Text-Adventure-RPG, in dem eine kuenstliche
            Intelligenz als dein persoenlicher Dungeon Master fungiert. Jede
            Entscheidung formt die Welt. Jedes Abenteuer ist einzigartig.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={onEnter}>
              <span>{"\u2694\uFE0F"}</span> Kostenlos starten
            </button>
            <a href="#how-it-works" className={styles.secondaryBtn}>
              <span>{"\u25B6\uFE0F"}</span> So funktioniert's
            </a>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>10K+</span>
              <span className={styles.statLabel}>Abenteurer</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>50K+</span>
              <span className={styles.statLabel}>Geschichten</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>4.9</span>
              <span className={styles.statLabel}>Bewertung</span>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroCard}>
            <div className={styles.heroCardGlow} />
            <div className={styles.heroCardContent}>
              <div className={styles.mockPortrait}>
                <span>{"\uD83E\uDDD9\u200D\u2642\uFE0F"}</span>
              </div>
              <div className={styles.mockText}>
                <div className={styles.mockLine} style={{ width: "80%" }} />
                <div className={styles.mockLine} style={{ width: "60%" }} />
                <div className={styles.mockLine} style={{ width: "90%" }} />
              </div>
              <div className={styles.mockOptions}>
                <div className={styles.mockOption}>{"\u2694\uFE0F"} Angreifen</div>
                <div className={styles.mockOption}>{"\uD83D\uDDE3\uFE0F"} Verhandeln</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Features</span>
          <h2 className={styles.sectionTitle}>
            Warum Aetheria AI?
          </h2>
          <p className={styles.sectionSubtitle}>
            Modernste KI-Technologie trifft auf klassisches Pen & Paper Rollenspiel.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {FEATURES.map((feature, index) => (
            <div
              key={index}
              className={`${styles.featureCard} ${activeFeature === index ? styles.featureCardActive : ""}`}
              onMouseEnter={() => setActiveFeature(index)}
            >
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={styles.howItWorks}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Einfach starten</span>
          <h2 className={styles.sectionTitle}>So funktioniert's</h2>
          <p className={styles.sectionSubtitle}>
            In drei Schritten zum epischen Abenteuer.
          </p>
        </div>

        <div className={styles.stepsContainer}>
          {STEPS.map((step, index) => (
            <div key={index} className={styles.step}>
              <div className={styles.stepNumber}>{step.number}</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.description}</p>
              </div>
              {index < STEPS.length - 1 && <div className={styles.stepConnector} />}
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className={styles.pricing}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Preise</span>
          <h2 className={styles.sectionTitle}>Waehle deinen Pfad</h2>
          <p className={styles.sectionSubtitle}>
            Starte kostenlos. Upgrade wenn du bereit bist.
          </p>
        </div>

        <div className={styles.pricingGrid}>
          {PRICING.map((plan, index) => (
            <div
              key={index}
              className={`${styles.pricingCard} ${plan.highlighted ? styles.pricingCardHighlighted : ""}`}
            >
              {plan.highlighted && (
                <div className={styles.pricingBadge}>Beliebteste Wahl</div>
              )}
              <h3 className={styles.pricingName}>{plan.name}</h3>
              <div className={styles.pricingPrice}>
                <span className={styles.priceValue}>{plan.price}</span>
                <span className={styles.pricePeriod}>{plan.period}</span>
              </div>
              <ul className={styles.pricingFeatures}>
                {plan.features.map((feature, i) => (
                  <li key={i}>
                    <span className={styles.checkIcon}>{"\u2713"}</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={plan.highlighted ? styles.primaryBtn : styles.outlineBtn}
                onClick={onEnter}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCta}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            Bereit fuer dein Abenteuer?
          </h2>
          <p className={styles.ctaSubtitle}>
            Schliesse dich tausenden Abenteurern an und erlebe Geschichten,
            die nur fuer dich geschrieben werden.
          </p>
          <button className={styles.primaryBtn} onClick={onEnter}>
            <span>{"\u2728"}</span> Jetzt kostenlos spielen
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <span className={styles.logoIcon}>{"\u2728"}</span>
            <span className={styles.logoText}>Aetheria AI</span>
            <p className={styles.footerTagline}>
              Unendliche Abenteuer, angetrieben von KI.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerColumn}>
              <h4>Produkt</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Preise</a>
              <a href="#how-it-works">So funktioniert's</a>
            </div>
            <div className={styles.footerColumn}>
              <h4>Rechtliches</h4>
              <a href="#">Datenschutz</a>
              <a href="#">AGB</a>
              <a href="#">Impressum</a>
            </div>
            <div className={styles.footerColumn}>
              <h4>Community</h4>
              <a href="#">Discord</a>
              <a href="#">Twitter</a>
              <a href="#">Reddit</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>&copy; 2024 Aetheria AI. Alle Rechte vorbehalten.</p>
        </div>
      </footer>
    </div>
  );
}
