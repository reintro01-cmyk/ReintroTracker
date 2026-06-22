import { useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { AuthLanding } from "../components/AuthLanding.jsx";
import { Toast } from "../components/Toast.jsx";
import { useClinicIdentity } from "./useClinicIdentity.js";
import { AdminShell } from "./shells/AdminShell.jsx";
import { ClinicianShell } from "./shells/ClinicianShell.jsx";
import { PatientShell } from "./shells/PatientShell.jsx";
import { Bootstrap } from "./Bootstrap.jsx";
import { Loader2 } from "lucide-react";

// Root of the clinic edition. Auth → resolve identity → render the shell for the user's role.
// Admin wins over other staff roles; a pure patient gets the patient shell; anyone with neither a
// membership nor a patient record lands on Bootstrap (create a clinic, or wait for an invite).
export default function ClinicApp() {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const auth = useAuth({ showToast });
  const identity = useClinicIdentity(auth.session);

  if (!auth.session) {
    return (
      <>
        {toast && <Toast message={toast.message} type={toast.type} />}
        <AuthLanding
          mode={auth.authMode}
          onModeChange={auth.setAuthMode}
          email={auth.authEmail}
          onEmailChange={auth.setAuthEmail}
          password={auth.authPassword}
          onPasswordChange={auth.setAuthPassword}
          message={auth.authMessage}
          rememberedEmails={auth.rememberedEmails}
          onSubmit={auth.handleEmailPasswordAuth}
          onForgotPassword={auth.handleForgotPassword}
          onContinueAsGuest={() => showToast("Clinic access is by invitation — please sign in or create an account.")}
          signUpPendingEmail={auth.signUpPendingEmail}
          onResendSignUpConfirmation={auth.resendSignUpConfirmation}
          onDismissSignUpPending={auth.dismissSignUpPending}
        />
      </>
    );
  }

  let view;
  if (identity.loading) {
    view = (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading your workspace…
      </div>
    );
  } else if (identity.isAdmin) {
    view = <AdminShell auth={auth} identity={identity} showToast={showToast} />;
  } else if (identity.isStaff) {
    view = <ClinicianShell auth={auth} identity={identity} showToast={showToast} />;
  } else if (identity.isPatient) {
    view = <PatientShell auth={auth} identity={identity} showToast={showToast} />;
  } else {
    view = <Bootstrap auth={auth} identity={identity} showToast={showToast} />;
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} />}
      {view}
    </>
  );
}
