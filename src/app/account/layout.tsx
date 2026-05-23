// Account-area layout. Wraps every /account/* page in a <main> landmark so
// screen-reader landmark navigation reaches the page content (audit P1 —
// account pages previously rendered into a <div> with no semantic role,
// invisible to "skip to main" / landmark-rotor commands). Also marks the
// subtree dynamic since every page below it reads the user's session.

export const dynamic = 'force-dynamic';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <main id="account-main">{children}</main>;
}
