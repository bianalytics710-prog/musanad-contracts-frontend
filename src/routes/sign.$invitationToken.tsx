/**
 * Public route — /sign/:invitationToken
 *
 * Mode: regenerate — this is the M3 entry point for the public signing
 * ceremony. Lovable's `sign.$invitationId.tsx` referenced an internal
 * supabase signature_id; M3 routes by plaintext invitation_token (the
 * server-side fn_ hashes-and-matches).
 *
 * Public route conventions:
 *   - NO auth wrapper. NO ProtectedRoute. NO authStore dependency.
 *   - The signatureService uses an apiPublicClient that does NOT attach
 *     Authorization headers — defense in depth against accidental token
 *     leakage to a public endpoint.
 *   - i18n + RTL are locked to invitation.language inside the
 *     SigningCeremony component (route-level effect).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { SigningCeremony } from "@/features/signatures/components/SigningCeremony";

export const Route = createFileRoute("/sign/$invitationToken")({
  component: SignRoute,
});

function SignRoute() {
  const { invitationToken } = Route.useParams();
  return (
    <ErrorBoundary>
      <SigningCeremony invitationToken={invitationToken} />
    </ErrorBoundary>
  );
}

export default SignRoute;
