import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorMessage } from '@/components/survey/ErrorMessage';
import { PrimaryButton } from '@/components/survey/PrimaryButton';
import { AdminApiError, adminApi } from './api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(email, password);
      void navigate('/admin');
    } catch (failure) {
      setError(
        failure instanceof AdminApiError && failure.status === 429
          ? 'Too many attempts. Please wait a minute.'
          : 'Email or password is not correct.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 text-foreground">
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-sm rounded-lg border bg-card p-6"
      >
        <h1 className="text-xl font-semibold">Survey admin</h1>
        <div className="mt-6 grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            className="h-11"
          />
        </div>
        <div className="mt-4 grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            className="h-11"
          />
        </div>
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <PrimaryButton type="submit" busy={busy} className="mt-6 sm:w-full">
          Sign in
        </PrimaryButton>
      </form>
    </main>
  );
}
