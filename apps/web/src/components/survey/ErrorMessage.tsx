import { CircleAlert } from 'lucide-react';

interface ErrorMessageProps {
  id?: string;
  children: string;
}

/** Friendly inline validation message, announced to screen readers. */
export function ErrorMessage({ id, children }: ErrorMessageProps) {
  return (
    <p id={id} role="alert" className="mt-4 flex items-center gap-2 font-medium text-destructive">
      <CircleAlert aria-hidden className="size-5 shrink-0" />
      {children}
    </p>
  );
}
