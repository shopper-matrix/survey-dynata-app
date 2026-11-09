import type { ReactNode } from 'react';

interface OptionCardProps {
  htmlFor: string;
  control: ReactNode;
  label: string;
}

/** Full-width tappable answer row (at least 44 px high) wrapping a radio or checkbox. */
export function OptionCard({ htmlFor, control, label }: OptionCardProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-3 text-base transition-colors hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
    >
      {control}
      <span>{label}</span>
    </label>
  );
}
