import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { ThemeToggle } from '@/app/ThemeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const sections = [
  {
    title: 'Respondent survey',
    description:
      'Mobile-first flow a Dynata panelist goes through. Start at Welcome and press Next.',
    links: [
      { to: '/survey/welcome', label: 'Welcome and consent' },
      { to: '/survey/single', label: 'Single choice (screener: “Under 18” screens out)' },
      { to: '/survey/multi', label: 'Multiple choice' },
      { to: '/survey/grid', label: 'Grid (stacked cards on phones)' },
      { to: '/survey/open', label: 'Open text' },
      { to: '/survey/number', label: 'Number' },
      { to: '/survey/rating', label: 'Rating 0–10' },
      { to: '/survey/end/complete', label: 'End screen: complete' },
      { to: '/survey/end/screenout', label: 'End screen: screen-out' },
    ],
  },
  {
    title: 'Admin dashboard',
    description: 'Screens for our team. Denser layout with a sidebar from tablet width.',
    links: [
      { to: '/admin/surveys', label: 'Survey list' },
      { to: '/admin/dashboard', label: 'Live fieldwork dashboard' },
    ],
  },
];

/** Entry page of the prototype: links to every screen for the product owner's review. */
export function PrototypeIndex() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">UI prototype · fake data</p>
            <h1 className="mt-1 text-2xl font-semibold">Survey Dynata App</h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="mt-8 grid gap-6">
          {sections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {section.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="flex min-h-11 items-center justify-between gap-4 py-2 hover:underline"
                      >
                        {link.label}
                        <ChevronRight
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
