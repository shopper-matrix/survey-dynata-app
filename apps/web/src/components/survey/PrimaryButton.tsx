import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

type PrimaryButtonProps = ComponentProps<typeof Button> & { busy?: boolean };

/** The one main action of a screen (Next, Start): large, full-width on phones. */
export function PrimaryButton({
  busy = false,
  disabled,
  children,
  className,
  ...props
}: PrimaryButtonProps) {
  return (
    <Button
      size="lg"
      className={`h-12 w-full text-base sm:w-auto sm:px-10 ${className ?? ''}`}
      {...props}
      disabled={busy || disabled === true}
    >
      {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
