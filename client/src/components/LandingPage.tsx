import { useState } from "react";
import styles from "./LandingPage.module.css";

interface LandingPageProps {
  onEnter: () => void;
}

const FEATURES = [
  {
    icon: "🧙",
    title: "KI-Dungeon Master",
    description:
      "Ein intelligenter Spielleiter, der auf jede deiner Entscheidungen reagiert und eine lebendige Welt erschafft.",
  },
  {
    icon: "🎨",
    title: "Generierte Bilder",
    description:
      "Jede Szene, jedes Item und dein Charakter-Portrait werden in Echtzeit von KI generiert.",
  },
  {
    icon: "🎲",
    title: "D&D-Regelsystem",
    description:
      "Authentische Würfelwürfe, Fähigkeitschecks und Kampfmechaniken basierend auf D&D 5e.",
  },
  {
    icon: "♾️",
    title: "Unendliche Geschichten",
    description:
      "Keine zwei Abenteuer sind gleich. Die KI erschafft einzigartige Narrative für jeden Spieler.",
  },
  {
    icon: "📱",
    title: "AR Item-Scanner",
    description:
      "Scanne echte Gegenstände mit deiner Kamera und verwandle sie in magische RPG-Items.",
  },
  {
    icon: "💭",
    title: "Gedächtnis-System",
    description:
      "Die KI erinnert sich an deine Entscheidungen und webt sie in zukünftige Geschichten ein.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Erstelle deinen Helden",
    description:
      "Wähle Rasse, Klasse und Hintergrundgeschichte. Die KI generiert ein einzigartiges Portrait.",
  },
  {
    number: "02",
    title: "Wähle dein Abenteuer",
    description:
      "Von düsteren Verliesen bis zu magischen Märkten — wähle dein Szenario.",
  },
  {
    number: "03",
    title: "Erlebe die Geschichte",
    description:
      "Triff Entscheidungen, kämpfe Monster, sammle Schätze. Jede Wahl formt die Welt.",
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
    notIncluded: [
      "HD-Bildgenerierung",
      "AR Item-Scanner",
      "Eigene Szenarien",
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
      "Prioritäts-Support",
    ],
    notIncluded: [
      "Eigene Szenarien erstellen",
      "API-Zugang",
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
      "Frühzugang zu Features",
      "Discord VIP-Rolle",
    ],
    notIncluded: [],
    cta: "Legende werden",
    highlighted: false,
  },
];

const TESTIMONIALS = [
  {
    name: "Max S.",
    role: "D&D-Veteran",
    avatar: "🧙‍♂️",
    text: "Endlich kann ich auch alleine epische Abenteuer erleben! Die KI reagiert so intelligent auf meine Entscheidungen, dass es sich wie ein echter Spielleiter anfühlt.",
    rating: 5,
  },
  {
    name: "Lisa M.",
    role: "RPG-Neuling",
    avatar: "🧝‍♀️",
    text: "Als Anfängerin war ich skeptisch, aber Aetheria hat mir die Welt der Rollenspiele eröffnet. Die generierten Bilder sind wunderschön!",
    rating: 5,
  },
  {
    name: "Tim K.",
    role: "Game Designer",
    avatar: "🎮",
    text: "Die Technologie hinter Aetheria ist beeindruckend. Jede Session fühlt sich frisch und einzigartig an. Das Gedächtnis-System ist genial.",
    rating: 5,
  },
  {
    name: "Sarah B.",
    role: "Fantasy-Autorin",
    avatar: "📚",
    text: "Ich nutze Aetheria als Inspirationsquelle für meine Geschichten. Die KI erschafft Plots, auf die ich selbst nie gekommen wäre!",
    rating: 5,
  },
];

const CHARACTER_CLASSES = [
  {
    name: "Krieger",
    icon: "⚔️",
    color: "#dc3545",
    description: "Meister des Nahkampfs mit schwerer Rüstung und verheerenden Angriffen.",
    stats: { str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 10 },
    abilities: ["Zweiter Wind", "Aktionsstoß", "Unbeugsam"],
  },
  {
    name: "Magier",
    icon: "🔮",
    color: "#9370db",
    description: "Beherrscher arkaner Künste mit mächtigen Zaubern und Ritualen.",
    stats: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    abilities: ["Feuerball", "Teleportation", "Arkane Erholung"],
  },
  {
    name: "Schurke",
    icon: "🗡️",
    color: "#28a745",
    description: "Meister der Schatten, Experte für Hinterhalte und tödliche Präzision.",
    stats: { str: 10, dex: 18, con: 12, int: 14, wis: 10, cha: 14 },
    abilities: ["Hinterhältiger Angriff", "Ausweichen", "Schlösser knacken"],
  },
  {
    name: "Kleriker",
    icon: "✨",
    color: "#ffc107",
    description: "Göttlicher Diener mit heilenden Kräften und schützender Magie.",
    stats: { str: 14, dex: 10, con: 14, int: 10, wis: 18, cha: 12 },
    abilities: ["Heilen", "Segen", "Untote vertreiben"],
  },
  {
    name: "Waldläufer",
    icon: "🏹",
    color: "#17a2b8",
    description: "Kundiger Jäger und Spurenleser mit einem Tierbegleiter.",
    stats: { str: 14, dex: 16, con: 14, int: 12, wis: 14, cha: 10 },
    abilities: ["Bevorzugter Feind", "Tierbegleiter", "Natürliches Verstecken"],
  },
  {
    name: "Barde",
    icon: "🎵",
    color: "#e83e8c",
    description: "Charismatischer Künstler, dessen Musik Freunde stärkt und Feinde schwächt.",
    stats: { str: 10, dex: 14, con: 12, int: 14, wis: 10, cha: 18 },
    abilities: ["Bardische Inspiration", "Spottgesang", "Vielseitigkeit"],
  },
];

const FAQS = [
  {
    question: "Was ist Aetheria AI?",
    answer: "Aetheria AI ist ein KI-gesteuertes Text-Adventure-RPG, bei dem eine künstliche Intelligenz als dein persönlicher Dungeon Master fungiert. Du erlebst einzigartige Abenteuer mit generierten Bildern, authentischen D&D-Mechaniken und einer Geschichte, die sich an deine Entscheidungen anpasst.",
  },
  {
    question: "Brauche ich Erfahrung mit Rollenspielen?",
    answer: "Nein! Aetheria ist für Anfänger und Veteranen gleichermaßen geeignet. Das Spiel führt dich sanft in die Mechaniken ein und erklärt alle Regeln, während du spielst. Die KI passt sich deinem Erfahrungslevel an.",
  },
  {
    question: "Wie funktioniert die Bildgenerierung?",
    answer: "Wir nutzen modernste KI-Technologie (Gemini/DALL-E), um in Echtzeit Bilder zu generieren. Jede Szene, dein Charakter-Portrait und gefundene Items werden individuell für dich erstellt — keine zwei Bilder sind gleich!",
  },
  {
    question: "Kann ich auch offline spielen?",
    answer: "Nein, Aetheria benötigt eine Internetverbindung, da die KI-Modelle auf unseren Servern laufen. Wir arbeiten jedoch an einem Offline-Modus für Premium-Nutzer.",
  },
  {
    question: "Wie funktioniert der AR Item-Scanner?",
    answer: "Mit der Kamera deines Smartphones kannst du echte Gegenstände scannen. Unsere KI analysiert das Objekt und verwandelt es in ein einzigartiges magisches Item für dein Abenteuer — komplett mit Statistiken und Beschreibung!",
  },
  {
    question: "Werden meine Fortschritte gespeichert?",
    answer: "Ja! Deine Charaktere, Fortschritte und die gesamte Geschichte werden automatisch in der Cloud gespeichert. Du kannst jederzeit dort weitermachen, wo du aufgehört hast — auch auf anderen Geräten.",
  },
  {
    question: "Kann ich mit Freunden spielen?",
    answer: "Der Multiplayer-Modus befindet sich derzeit in Entwicklung und wird bald für Legende-Abonnenten verfügbar sein. Dann kannst du mit bis zu 4 Freunden gemeinsame Abenteuer erleben!",
  },
  {
    question: "Wie kündige ich mein Abo?",
    answer: "Du kannst dein Abonnement jederzeit in deinen Kontoeinstellungen kündigen. Es entstehen keine versteckten Kosten und du behältst Zugang bis zum Ende des Abrechnungszeitraums.",
  },
];

const GAME_SCREENSHOTS = [
  {
    title: "Epische Schlachten",
    description: "Kämpfe gegen furchteinflößende Monster in rundenbasierten Kämpfen.",
    icon: "⚔️",
  },
  {
    title: "Lebendige Welten",
    description: "Erkunde handgefertigte Szenarien mit KI-generierten Beschreibungen.",
    icon: "🏰",
  },
  {
    title: "Einzigartige Items",
    description: "Sammle legendäre Ausrüstung mit individuell generierten Bildern.",
    icon: "💎",
  },
  {
    title: "Charakter-Portraits",
    description: "Jeder Held erhält ein einzigartiges, KI-generiertes Portrait.",
    icon: "🖼️",
  },
];

const TECH_STACK = [
  { name: "Gemini AI", description: "Modernste Sprachmodelle für intelligente Spielleitung", icon: "🧠" },
  { name: "Echtzeit-Bilder", description: "KI-generierte Grafiken in Sekunden", icon: "🎨" },
  { name: "D&D 5e Engine", description: "Authentisches Regelwerk für echtes RPG-Feeling", icon: "🎲" },
  { name: "Cloud-Sync", description: "Spielstände sicher in der Cloud gespeichert", icon: "☁️" },
];

export function LandingPage({ onEnter }: LandingPageProps) {
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeClass, setActiveClass] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setEmailSubmitted(true);
      setEmail("");
    }
  };

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
          <span className={styles.logoIcon}>✨</span>
          <span className={styles.logoText}>Aetheria AI</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features">Features</a>
          <a href="#classes">Klassen</a>
          <a href="#how-it-works">So funktioniert's</a>
          <a href="#pricing">Preise</a>
          <a href="#faq">FAQ</a>
        </div>
        <button className={styles.navCta} onClick={onEnter}>
          Spielen
        </button>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span>🎮</span> KI-gesteuertes RPG
          </div>
          <h1 className={styles.heroTitle}>
            Dein Abenteuer.
            <br />
            <span className={styles.heroHighlight}>Unendlich einzigartig.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Aetheria AI ist ein Text-Adventure-RPG, in dem eine künstliche
            Intelligenz als dein persönlicher Dungeon Master fungiert. Jede
            Entscheidung formt die Welt. Jedes Abenteuer ist einzigartig.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={onEnter}>
              <span>⚔️</span> Kostenlos starten
            </button>
            <a href="#how-it-works" className={styles.secondaryBtn}>
              <span>▶️</span> So funktioniert's
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
                <span>🧙‍♂️</span>
              </div>
              <div className={styles.mockText}>
                <div className={styles.mockLine} style={{ width: "80%" }} />
                <div className={styles.mockLine} style={{ width: "60%" }} />
                <div className={styles.mockLine} style={{ width: "90%" }} />
              </div>
              <div className={styles.mockOptions}>
                <div className={styles.mockOption}>⚔️ Angreifen</div>
                <div className={styles.mockOption}>🗣️ Verhandeln</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Powered By Section */}
      <section className={styles.poweredBy}>
        <p className={styles.poweredByTitle}>Angetrieben von modernster Technologie</p>
        <div className={styles.techGrid}>
          {TECH_STACK.map((tech, index) => (
            <div key={index} className={styles.techItem}>
              <span className={styles.techIcon}>{tech.icon}</span>
              <div className={styles.techInfo}>
                <span className={styles.techName}>{tech.name}</span>
                <span className={styles.techDesc}>{tech.description}</span>
              </div>
            </div>
          ))}
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

      {/* Character Classes Showcase */}
      <section id="classes" className={styles.classesSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Klassen</span>
          <h2 className={styles.sectionTitle}>Wähle deinen Pfad</h2>
          <p className={styles.sectionSubtitle}>
            6 einzigartige Klassen mit individuellen Fähigkeiten und Spielstilen.
          </p>
        </div>

        <div className={styles.classesContainer}>
          <div className={styles.classSelector}>
            {CHARACTER_CLASSES.map((cls, index) => (
              <button
                key={index}
                className={`${styles.classTab} ${activeClass === index ? styles.classTabActive : ""}`}
                onClick={() => setActiveClass(index)}
                style={{ "--class-color": cls.color } as React.CSSProperties}
              >
                <span className={styles.classTabIcon}>{cls.icon}</span>
                <span className={styles.classTabName}>{cls.name}</span>
              </button>
            ))}
          </div>

          <div className={styles.classDetails}>
            <div className={styles.classCard} style={{ "--class-color": CHARACTER_CLASSES[activeClass].color } as React.CSSProperties}>
              <div className={styles.classHeader}>
                <div className={styles.classIconLarge}>{CHARACTER_CLASSES[activeClass].icon}</div>
                <div className={styles.classInfo}>
                  <h3 className={styles.className}>{CHARACTER_CLASSES[activeClass].name}</h3>
                  <p className={styles.classDescription}>{CHARACTER_CLASSES[activeClass].description}</p>
                </div>
              </div>

              <div className={styles.classStats}>
                <h4>Attribute</h4>
                <div className={styles.statsGrid}>
                  {Object.entries(CHARACTER_CLASSES[activeClass].stats).map(([stat, value]) => (
                    <div key={stat} className={styles.statItem}>
                      <span className={styles.statName}>{stat.toUpperCase()}</span>
                      <div className={styles.statBar}>
                        <div
                          className={styles.statFill}
                          style={{ width: `${(value / 20) * 100}%`, backgroundColor: CHARACTER_CLASSES[activeClass].color }}
                        />
                      </div>
                      <span className={styles.statValue}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.classAbilities}>
                <h4>Fähigkeiten</h4>
                <div className={styles.abilitiesList}>
                  {CHARACTER_CLASSES[activeClass].abilities.map((ability, i) => (
                    <span key={i} className={styles.abilityTag} style={{ borderColor: CHARACTER_CLASSES[activeClass].color }}>
                      {ability}
                    </span>
                  ))}
                </div>
              </div>

              <button className={styles.primaryBtn} onClick={onEnter}>
                Als {CHARACTER_CLASSES[activeClass].name} starten
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Game Screenshots / Demo */}
      <section className={styles.demoSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Einblick</span>
          <h2 className={styles.sectionTitle}>Erlebe die Magie</h2>
          <p className={styles.sectionSubtitle}>
            Tauche ein in eine Welt voller Abenteuer, Geheimnisse und epischer Momente.
          </p>
        </div>

        <div className={styles.demoGrid}>
          {GAME_SCREENSHOTS.map((screenshot, index) => (
            <div key={index} className={styles.demoCard}>
              <div className={styles.demoIcon}>{screenshot.icon}</div>
              <h3 className={styles.demoTitle}>{screenshot.title}</h3>
              <p className={styles.demoDescription}>{screenshot.description}</p>
            </div>
          ))}
        </div>

        <div className={styles.demoPreview}>
          <div className={styles.previewWindow}>
            <div className={styles.previewHeader}>
              <div className={styles.previewDots}>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className={styles.previewTitle}>Aetheria AI - Live Session</span>
            </div>
            <div className={styles.previewContent}>
              <div className={styles.previewScene}>
                <div className={styles.previewSceneIcon}>🏰</div>
                <div className={styles.previewSceneText}>
                  <strong>Die verlassene Bibliothek</strong>
                  <p>Du betrittst einen staubigen Raum voller uralter Bücher. Mondlicht fällt durch ein zerbrochenes Fenster...</p>
                </div>
              </div>
              <div className={styles.previewActions}>
                <span className={styles.previewAction}>📖 Bücher untersuchen</span>
                <span className={styles.previewAction}>🔍 Raum durchsuchen</span>
                <span className={styles.previewAction}>🚪 Weitergehen</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className={styles.testimonials}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Community</span>
          <h2 className={styles.sectionTitle}>Was unsere Abenteurer sagen</h2>
          <p className={styles.sectionSubtitle}>
            Tausende Spieler erleben bereits ihre eigenen einzigartigen Geschichten.
          </p>
        </div>

        <div className={styles.testimonialsGrid}>
          {TESTIMONIALS.map((testimonial, index) => (
            <div key={index} className={styles.testimonialCard}>
              <div className={styles.testimonialStars}>
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <span key={i}>⭐</span>
                ))}
              </div>
              <p className={styles.testimonialText}>"{testimonial.text}"</p>
              <div className={styles.testimonialAuthor}>
                <span className={styles.testimonialAvatar}>{testimonial.avatar}</span>
                <div className={styles.testimonialInfo}>
                  <span className={styles.testimonialName}>{testimonial.name}</span>
                  <span className={styles.testimonialRole}>{testimonial.role}</span>
                </div>
              </div>
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
          <h2 className={styles.sectionTitle}>Wähle deinen Pfad</h2>
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
                    <span className={styles.checkIcon}>✓</span>
                    {feature}
                  </li>
                ))}
                {plan.notIncluded.map((feature, i) => (
                  <li key={`not-${i}`} className={styles.notIncluded}>
                    <span className={styles.crossIcon}>✗</span>
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

        <p className={styles.pricingNote}>
          💡 Alle Preise inkl. MwSt. Jederzeit kündbar. Keine versteckten Kosten.
        </p>
      </section>

      {/* FAQ Section */}
      <section id="faq" className={styles.faqSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>FAQ</span>
          <h2 className={styles.sectionTitle}>Häufige Fragen</h2>
          <p className={styles.sectionSubtitle}>
            Alles was du wissen musst, bevor du loslegst.
          </p>
        </div>

        <div className={styles.faqList}>
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className={`${styles.faqItem} ${openFaq === index ? styles.faqItemOpen : ""}`}
            >
              <button
                className={styles.faqQuestion}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <span>{faq.question}</span>
                <span className={styles.faqToggle}>{openFaq === index ? "−" : "+"}</span>
              </button>
              <div className={styles.faqAnswer}>
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Newsletter Section */}
      <section className={styles.newsletter}>
        <div className={styles.newsletterContent}>
          <div className={styles.newsletterIcon}>📬</div>
          <h2 className={styles.newsletterTitle}>Bleib auf dem Laufenden</h2>
          <p className={styles.newsletterSubtitle}>
            Erhalte Updates zu neuen Features, Szenarien und exklusiven Angeboten.
          </p>

          {emailSubmitted ? (
            <div className={styles.newsletterSuccess}>
              <span>✅</span> Danke! Du bist jetzt angemeldet.
            </div>
          ) : (
            <form className={styles.newsletterForm} onSubmit={handleNewsletterSubmit}>
              <input
                type="email"
                placeholder="deine@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.newsletterInput}
                required
              />
              <button type="submit" className={styles.primaryBtn}>
                Anmelden
              </button>
            </form>
          )}

          <p className={styles.newsletterDisclaimer}>
            Kein Spam, versprochen. Jederzeit abmeldbar.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCta}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            Bereit für dein Abenteuer?
          </h2>
          <p className={styles.ctaSubtitle}>
            Schließe dich tausenden Abenteurern an und erlebe Geschichten,
            die nur für dich geschrieben werden.
          </p>
          <button className={styles.primaryBtn} onClick={onEnter}>
            <span>✨</span> Jetzt kostenlos spielen
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <span className={styles.logoIcon}>✨</span>
            <span className={styles.logoText}>Aetheria AI</span>
            <p className={styles.footerTagline}>
              Unendliche Abenteuer, angetrieben von KI.
            </p>
            <div className={styles.socialLinks}>
              <a href="#" className={styles.socialLink}>🎮 Discord</a>
              <a href="#" className={styles.socialLink}>🐦 Twitter</a>
              <a href="#" className={styles.socialLink}>📺 YouTube</a>
            </div>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerColumn}>
              <h4>Produkt</h4>
              <a href="#features">Features</a>
              <a href="#classes">Klassen</a>
              <a href="#pricing">Preise</a>
              <a href="#how-it-works">So funktioniert's</a>
            </div>
            <div className={styles.footerColumn}>
              <h4>Support</h4>
              <a href="#faq">FAQ</a>
              <a href="#">Hilfe-Center</a>
              <a href="#">Kontakt</a>
              <a href="#">Bug melden</a>
            </div>
            <div className={styles.footerColumn}>
              <h4>Rechtliches</h4>
              <a href="#">Datenschutz</a>
              <a href="#">AGB</a>
              <a href="#">Impressum</a>
              <a href="#">Cookie-Richtlinie</a>
            </div>
            <div className={styles.footerColumn}>
              <h4>Community</h4>
              <a href="#">Discord Server</a>
              <a href="#">Reddit</a>
              <a href="#">Fan-Art</a>
              <a href="#">Feedback geben</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>© 2024 Aetheria AI. Alle Rechte vorbehalten. Mit ❤️ gemacht für Abenteurer.</p>
        </div>
      </footer>
    </div>
  );
}
