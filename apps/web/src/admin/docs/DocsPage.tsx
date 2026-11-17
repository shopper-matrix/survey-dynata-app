import type { ReactNode } from 'react';

// Platform documentation for the team (German), shown in the admin area only: it describes
// how the platform works, how a survey goes into field and how the servers are run. No secrets
// or server addresses here: those live in the server's .env and the password manager. The
// technical source of truth stays in docs/runbook.md and deploy/README.md.

interface Section {
  id: string;
  title: string;
  body: ReactNode;
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-[13px] leading-relaxed">
      {children}
    </pre>
  );
}

function C({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">{children}</code>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 leading-relaxed">{children}</p>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 font-semibold">{children}</h3>;
}

function List({ items, ordered }: { items: ReactNode[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag
      className={`mt-3 space-y-1.5 pl-5 leading-relaxed ${ordered ? 'list-decimal' : 'list-disc'}`}
    >
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Tag>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-md border-l-4 border-amber-500 bg-amber-500/10 p-3 text-sm leading-relaxed">
      {children}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-3 py-2 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t align-top">
              {row.map((cell, column) => (
                <td key={column} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const sections: Section[] = [
  {
    id: 'ueberblick',
    title: 'Überblick',
    body: (
      <>
        <P>
          Die Plattform führt Online-Umfragen mit Teilnehmern aus dem Dynata-Panel durch. Dynata
          schickt Teilnehmer über einen Link in die Umfrage; am Ende schickt die Plattform sie mit
          einem signierten Link zu Dynata zurück, damit Dynata das Ergebnis (Complete, Screen-out,
          Overquota, Quality) zählt.
        </P>
        <Table
          head={['Teil', 'Aufgabe']}
          rows={[
            ['Umfrage (Teilnehmer)', 'Willkommensseite, eine Frage pro Seite, mobil optimiert'],
            [
              'Admin-Bereich',
              'Umfragen bauen, testen, Quoten, Dynata-Einstellungen, Dashboard, Export',
            ],
            ['API', 'Entscheidet Ablauf, Quoten, Qualitätsprüfungen und den Rückleitungs-Link'],
            ['Datenbank', 'PostgreSQL: Umfragen, Teilnehmer, Antworten'],
          ]}
        />
        <Table
          head={['Umgebung', 'Adresse', 'Code-Stand']}
          rows={[
            [
              'Produktion',
              <C key="p">serafima.cloud</C>,
              <>
                Branch <C>main</C>
              </>,
            ],
            [
              'Staging (Test)',
              <C key="s">staging.serafima.cloud</C>,
              <>
                Branch <C>dev</C>
              </>,
            ],
          ]}
        />
        <P>
          Beide Umgebungen laufen getrennt (eigene Datenbank, eigene Einstellungen) auf demselben
          Server. Neues wird immer zuerst auf Staging getestet.
        </P>
      </>
    ),
  },
  {
    id: 'ablauf',
    title: 'Ablauf eines Teilnehmers',
    body: (
      <>
        <List
          ordered
          items={[
            <>
              Dynata öffnet den Einstiegslink <C>https://serafima.cloud/s/&lt;Umfrage-ID&gt;</C> und
              hängt <C>?psid=…</C> an (die Teilnehmer-ID von Dynata).
            </>,
            'Die Plattform legt den Teilnehmer an, merkt sich die psid, wählt die Sprache (Browser oder ?lang=) und markiert doppelte IP-Adressen/Geräte.',
            'Willkommensseite mit Datenschutzhinweis und Bot-Schutz. „Start“ beginnt die Umfrage, „Nein danke“ endet als Screen-out.',
            'Fragen, eine pro Seite. Screener und volle Quoten beenden die Umfrage sofort.',
            'Nach der letzten Frage: Qualitätsprüfungen, dann Quoten, dann das Ergebnis.',
            'Weiterleitung zu Dynata mit dem signierten End-Link. Ein Neuladen liefert denselben Link.',
          ]}
        />
        <P>
          Teilnehmer können oben rechts die Sprache wechseln, wenn die Umfrage eine Übersetzung
          hat. Die automatische Browser-Übersetzung ist gesperrt, weil sie die Seite zum Absturz
          bringt.
        </P>
      </>
    ),
  },
  {
    id: 'umfrage',
    title: 'Umfrage anlegen und bearbeiten',
    body: (
      <>
        <P>
          Neue Umfrage: <strong>Surveys</strong> → Titel und Ziel-Completes eingeben. Große
          Fragebögen werden als JSON-Datei importiert (Format:{' '}
          <C>packages/shared/src/survey-definition.ts</C>). Der Import legt sie als Entwurf an; eine
          Umfrage mit Teilnehmern kann nicht mehr überschrieben werden.
        </P>
        <Code>{`# auf dem Server, Datei vorher in den API-Container kopieren
cd /opt/survey-staging/current/deploy
docker compose -f compose.prod.yaml cp umfrage.json api:/tmp/umfrage.json
docker compose -f compose.prod.yaml exec api pnpm survey:import /tmp/umfrage.json
docker compose -f compose.prod.yaml exec api rm /tmp/umfrage.json`}</Code>
        <H3>Die Reiter einer Umfrage</H3>
        <Table
          head={['Reiter', 'Inhalt']}
          rows={[
            ['Questions', 'Blöcke und Fragen, Anzeige-Logik, Screener, Handy-Vorschau'],
            [
              'Quotas',
              'Quotenzellen: „Cap“ schließt bei Erreichen (Overquota), „Minimum“ nur zur Kontrolle',
            ],
            [
              'Settings',
              'Willkommenstext, Länge, Datenschutz, Qualitätsprüfungen, Aufbewahrungsdauer',
            ],
            ['Dynata', 'Dynata-Projekt-ID, Einstiegslink für Dynata, Sicherheitsmodus'],
            ['Dashboard', 'Feldstand, Quoten, letzte Teilnehmer, Testlinks, Export'],
          ]}
        />
        <H3>Status einer Umfrage</H3>
        <Table
          head={['Status', 'Bedeutung']}
          rows={[
            ['Draft', 'Entwurf, frei bearbeitbar'],
            ['Test', 'Alle Teilnehmer sind Testteilnehmer: keine Weiterleitung zu Dynata'],
            ['Live', 'Im Feld: echte Teilnehmer, Weiterleitung zu Dynata'],
            ['Closed', 'Beendet, neue Teilnehmer werden abgewiesen'],
          ]}
        />
        <P>
          <strong>Pause survey</strong> hält eine Live-Umfrage an: Wer schon drin ist, darf fertig
          machen; neue Teilnehmer gehen mit dem Overquota-Link zurück. <strong>Resume</strong> macht
          weiter.
        </P>
      </>
    ),
  },
  {
    id: 'testen',
    title: 'Testen',
    body: (
      <>
        <List
          items={[
            <>
              <strong>Testlinks</strong> (Dashboard → Test links): Die psid beginnt mit{' '}
              <C>TEST-</C>. Testteilnehmer landen am Ende auf einer internen Seite, die zeigt,
              welcher Dynata-Link erzeugt worden wäre. Sie zählen nicht in Quoten und Statistik.
            </>,
            'Testteilnehmer löschen: im Dashboard bei den Testlinks.',
            <>
              <strong>Dynata-Test</strong>: Im Dynata+-Projekt den Survey-Test starten. Die Umfrage
              muss dafür auf <strong>Live</strong> stehen, sonst wird nicht zu Dynata
              zurückgeleitet. Dafür die Staging-Umgebung nehmen.
            </>,
            'Doppelte IP/Gerät (duplicate_ip, duplicate_device) sind bei Tests vom selben Rechner normal: Es sind nur Hinweise, sie beenden die Umfrage nicht.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'dynata',
    title: 'Dynata-Anbindung',
    body: (
      <>
        <P>
          Sicherheitsmodus im Dynata+-Projekt: <strong>Dynata Secured Links (End)</strong>. Der
          Einstiegslink ist nicht signiert; die Plattform signiert die End-Links selbst
          (HMAC-SHA256 mit Key-ID und Secret von Dynata).
        </P>
        <Table
          head={['Ergebnis', 'End-Link (ohne Signatur)']}
          rows={[
            ['Complete', <C key="1">…/projects/end?rst=1&amp;psid=…</C>],
            ['Screen-out', <C key="2">…/projects/end?rst=2&amp;psid=…</C>],
            ['Quality', <C key="3">…/projects/end?rst=2&amp;qFlag=1&amp;psid=…</C>],
            ['Overquota', <C key="4">…/projects/end?rst=3&amp;psid=…</C>],
          ]}
        />
        <P>
          Die Plattform hängt <C>&amp;_k=&lt;Key-ID&gt;&amp;_s=&lt;Signatur&gt;</C> an. Neues
          Dynata-Projekt: Einstiegslink aus dem Reiter <strong>Dynata</strong> in Dynata+
          eintragen, Sicherheitsmodus „End“ wählen und <em>nicht</em> nachträglich ändern (sonst
          neues Projekt anlegen), dann einen Test bis Complete durchlaufen.
        </P>
        <H3>Einstellungen auf dem Server (.env)</H3>
        <Table
          head={['Variable', 'Wert']}
          rows={[
            [<C key="m">DYNATA_MODE</C>, 'live (echte Dynata-Links) oder mock (interne Testseiten)'],
            [<C key="s">DYNATA_SECURITY</C>, 'end'],
            [<C key="k">DYNATA_KEY_ID</C>, 'Key-ID von Dynata'],
            [<C key="x">DYNATA_SECRET</C>, 'Secret von Dynata: nur in der .env, nie in Chat/Git'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'qualitaet',
    title: 'Datenqualität',
    body: (
      <>
        <Table
          head={['Prüfung', 'Was passiert']}
          rows={[
            [
              'Speeders',
              'Viel schneller als der Median: nur markieren oder als Quality beenden (Settings)',
            ],
            ['Straightlining', 'Gleiche Antwort in allen Zeilen einer Matrix: markieren/beenden'],
            [
              'Attention checks',
              'Kontrollfrage falsch beantwortet: markieren/beenden. Mehrere erwartete Antworten = alle müssen gewählt sein',
            ],
            ['Honeypot', 'Unsichtbares Feld ausgefüllt (Bot): sofort Quality'],
            ['Bot-Schutz', 'Cloudflare Turnstile auf der Willkommensseite (falls eingerichtet)'],
            ['Doppelte IP/Gerät', 'Nur Markierung im Dashboard, kein Abbruch'],
          ]}
        />
        <P>
          Die Prüfungen laufen am Ende der Umfrage, vor den Quoten. IP-Adressen werden nur als
          Hash gespeichert; Namen, E-Mail oder Telefonnummer werden nicht erhoben.
        </P>
      </>
    ),
  },
  {
    id: 'auswertung',
    title: 'Auswertung und Export',
    body: (
      <>
        <P>
          <strong>Dashboard</strong>: Completes, Screen-outs, Overquotas, Quality-Abbrüche,
          Inzidenz, mediane Dauer, Verlauf, Quotenstand und die letzten Teilnehmer mit ihren
          Markierungen.
        </P>
        <P>
          <strong>Export CSV</strong> und <strong>Export SPSS</strong> im Dashboard liefern die
          Antworten. Die Dateien enthalten Teilnehmerdaten: nur auf verschlüsselten Geräten
          speichern.
        </P>
      </>
    ),
  },
  {
    id: 'benutzer',
    title: 'Benutzer und Rollen',
    body: (
      <>
        <Table
          head={['Rolle', 'Darf']}
          rows={[
            ['owner', 'Alles wie editor, dazu Umfragen löschen und das Admin-Protokoll sehen'],
            ['editor', 'Umfragen anlegen, bearbeiten, testen, live schalten, exportieren'],
            ['viewer', 'Nur ansehen'],
          ]}
        />
        <P>
          Neuen Admin anlegen oder Passwort zurücksetzen (auf dem Server). Das Passwort wird
          erzeugt und einmal angezeigt:
        </P>
        <Code>{`cd /opt/survey/current/deploy      # Staging: /opt/survey-staging/current/deploy
docker compose -f compose.prod.yaml exec api pnpm admin:create name@firma.de editor`}</Code>
      </>
    ),
  },
  {
    id: 'deploy',
    title: 'Deployment',
    body: (
      <>
        <H3>Automatisch über GitHub</H3>
        <List
          ordered
          items={[
            <>
              Änderung auf <C>dev</C> pushen → Tests (CI) laufen → bei Erfolg Deploy auf{' '}
              <strong>Staging</strong>.
            </>,
            'Auf Staging prüfen.',
            <>
              Pull Request <C>dev</C> → <C>main</C> mergen → CI → Deploy auf{' '}
              <strong>Produktion</strong>.
            </>,
          ]}
        />
        <P>Jeder Deploy macht automatisch:</P>
        <List
          ordered
          items={[
            'Datenbank-Backup (geprüft)',
            'neue Version bauen und starten (Datenbank-Migrationen laufen beim Start)',
            'Gesundheitsprüfung (API, Datenbank, Webseite) bis zu 3 Minuten',
            'Erfolg: neue Version wird „current“. Fehler: die vorige Version startet wieder.',
          ]}
        />
        <Note>
          Voraussetzung (einmalig): In GitHub unter Settings → Secrets and variables → Actions die
          Secrets <C>DEPLOY_HOST</C>, <C>DEPLOY_SSH_KEY</C> und <C>DEPLOY_KNOWN_HOSTS</C>{' '}
          anlegen; der öffentliche Schlüssel kommt auf den Server. Der Deploy-Workflow wird aktiv,
          sobald er auf <C>main</C> liegt. Manuell neu ausrollen: GitHub → Actions → Deploy → Run
          workflow.
        </Note>
        <H3>Von Hand (ohne GitHub)</H3>
        <Code>{`# auf dem eigenen Rechner, im Repository
SHA=$(git rev-parse HEAD)
REL=/opt/survey-staging/releases/$(date -u +%Y%m%dT%H%M%SZ)-\${SHA:0:7}
git archive --format=tar.gz -o rel.tgz $SHA
scp rel.tgz root@<server>:/tmp/rel.tgz
ssh root@<server> "mkdir -p $REL && tar -xzf /tmp/rel.tgz -C $REL && bash $REL/deploy/deploy.sh $REL"`}</Code>
        <P>
          Für Produktion <C>/opt/survey</C> statt <C>/opt/survey-staging</C>.
        </P>
        <H3>Zurückrollen</H3>
        <Code>{`bash /opt/survey/current/deploy/rollback.sh`}</Code>
        <P>
          Startet die vorige Version. Das betrifft nur den Code; hat die fehlerhafte Version die
          Datenbank verändert, das Backup von davor zurückspielen (siehe <C>docs/runbook.md</C>).
        </P>
        <H3>Aufbau auf dem Server</H3>
        <Code>{`/opt/survey/                 Produktion (Staging: /opt/survey-staging)
  .env                       Einstellungen und Secrets (nur auf dem Server)
  releases/<zeit>-<sha>/     eine Kopie pro Deploy (die letzten 5)
  current -> releases/…      die laufende Version
  backups/*.dump             Datenbank-Backups (die letzten 30)`}</Code>
        <P>
          Ein gemeinsamer Proxy (Caddy) nimmt alle Anfragen an, holt die HTTPS-Zertifikate und
          leitet jede Domain an ihre Umgebung weiter.
        </P>
      </>
    ),
  },
  {
    id: 'backups',
    title: 'Backups und Überwachung',
    body: (
      <>
        <List
          items={[
            'Vor jedem Deploy und Rollback automatisch, auf dem Server.',
            <>
              Von Hand auf dem Server: <C>bash /opt/survey/current/deploy/backup.sh name</C>
            </>,
            <>
              Täglich auf den eigenen PC (Windows, im Repository-Ordner):{' '}
              <C>powershell -ExecutionPolicy Bypass -File .\deploy\pull-backup.ps1</C>. Speichert
              nach <C>Dokumente\survey-backups</C>, prüft die Datei und löscht Kopien älter als 14
              Tage.
            </>,
          ]}
        />
        <P>
          Wiederherstellen und Backups prüfen: <C>docs/runbook.md</C>, Abschnitt „Backups and
          restore“.
        </P>
        <P>
          Überwachung: UptimeRobot prüft alle 5 Minuten <C>https://serafima.cloud/health</C> (Wort{' '}
          <C>&quot;database&quot;:&quot;ok&quot;</C>) und schickt bei Ausfall eine E-Mail.
        </P>
      </>
    ),
  },
  {
    id: 'checkliste',
    title: 'Checkliste Feldstart',
    body: (
      <List
        ordered
        items={[
          'Umfrage vollständig auf Staging getestet (alle Wege: Complete, Screen-out, Overquota, Quality).',
          'Code auf main gemergt und auf Produktion ausgerollt.',
          <>
            Produktions-.env: <C>DYNATA_MODE=live</C>, <C>DYNATA_SECURITY=end</C>, Key-ID und
            Secret gesetzt.
          </>,
          'Umfrage in Produktion importiert, Quoten und Dynata-Projekt-ID eingetragen.',
          'Einstiegslink aus dem Reiter Dynata im Dynata-Projekt eingetragen, Dynata-Test bis Complete.',
          'Testteilnehmer gelöscht, Umfrage auf Live.',
          'Backup gemacht, Überwachung aktiv.',
        ]}
      />
    ),
  },
];

/** Admin documentation: how the platform works and how it is deployed. */
export default function DocsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Dokumentation</h1>
      <p className="mt-2 text-muted-foreground">
        Wie die Plattform funktioniert, wie eine Umfrage ins Feld geht und wie sie betrieben wird.
      </p>

      <nav aria-label="Inhalt" className="mt-6 rounded-lg border p-4">
        <p className="text-sm font-semibold">Inhalt</p>
        <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="underline-offset-4 hover:underline">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-10 scroll-mt-6">
          <h2 className="border-b pb-2 text-xl font-semibold">{section.title}</h2>
          {section.body}
        </section>
      ))}
    </div>
  );
}
