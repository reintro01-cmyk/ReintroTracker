import { useState, useCallback } from "react";
import { EntryModal } from "./components/EntryModal.jsx";
import { RecipesPage } from "./components/RecipesPage.jsx";
import { OnboardingWizard } from "./components/OnboardingWizard.jsx";
import { AppSidebar } from "./components/AppSidebar.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { AuthLanding } from "./components/AuthLanding.jsx";
import { Toast } from "./components/Toast.jsx";
import { SettingsDrawer } from "./components/SettingsDrawer.jsx";
import { PasswordResetModal } from "./components/PasswordResetModal.jsx";
import { HomeTab } from "./components/tabs/HomeTab.jsx";
import { LogTab } from "./components/tabs/LogTab.jsx";
import { ScheduleTab } from "./components/tabs/ScheduleTab.jsx";
import { ReportsTab } from "./components/tabs/ReportsTab.jsx";
import { ProfileTab } from "./components/tabs/ProfileTab.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useAppState } from "./hooks/useAppState.js";
import { Settings } from "lucide-react";

export default function ReintroductionTrackerApp() {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const auth = useAuth({ showToast });
  const app  = useAppState({ session: auth.session, showToast });

  const [tab, setTab] = useState("home");
  const [selected, setSelected] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleSignOut() {
    await auth.signOut();
    app.resetState();
    setSettingsOpen(false);
  }

  function handleExitGuestMode() {
    auth.exitGuestMode();
    setSettingsOpen(false);
  }

  if (!auth.session && !auth.guestMode && !auth.showPasswordReset) {
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
          onContinueAsGuest={auth.continueAsGuest}
        />
      </>
    );
  }

  const { state } = app;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {!state.onboardingComplete && (
        <OnboardingWizard onComplete={app.handleOnboardingComplete} />
      )}

      <AppSidebar
        tab={tab}
        onTabChange={setTab}
        stats={app.stats}
        session={auth.session}
        syncStatus={app.syncStatus}
        phaseInfo={app.phaseInfo}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-56">

        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100 h-14 flex items-center px-4 md:px-6 gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="lg:hidden font-bold text-sm text-slate-900 leading-tight">Reintro Tracker</div>
            <div className="lg:hidden text-xs text-slate-500 leading-tight">
              {app.phaseInfo?.phase === "detox"   ? `Detox · Day ${app.phaseInfo.day} of ${app.phaseInfo.totalDays ?? 14}` :
               app.phaseInfo?.phase === "reintro" ? `Reintroduction · Day ${app.phaseInfo.day}` :
               "Pre-programme"}
            </div>
            <div className="hidden lg:block text-sm font-semibold text-slate-900">
              {state.user.name ? `${state.user.name}'s Programme` : "My Programme"}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block text-xs font-medium text-slate-500 tabular-nums">
              {app.phaseInfo?.phase === "detox"
                ? `Programme: Day ${app.phaseInfo.day} of ${app.phaseInfo.totalDays ?? 14}`
                : app.phaseInfo?.phase === "reintro"
                ? `Reintroduction · Day ${app.phaseInfo.day}`
                : app.phaseInfo?.daysUntilStart != null
                ? `Starts in ${app.phaseInfo.daysUntilStart} days`
                : "Programme"}
            </div>
            <button
              onClick={() => setSettingsOpen(v => !v)}
              aria-label="Account & settings"
              aria-expanded={settingsOpen}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1">
          <div className="px-4 py-6 pb-28 lg:pb-10">

            {tab === "home" && (
              <HomeTab
                phaseInfo={app.phaseInfo}
                stats={app.stats}
                reintroStart={app.reintroStart}
                finishDate={app.schedule.length ? app.schedule[app.schedule.length - 1].date : null}
                todayItem={app.todayItem}
                nextFood={state.foods[0]}
                status={state.status}
                weights={state.body.weights}
                weightGoal={state.weightGoal}
                programmeStart={state.programmeStart}
                detoxDuration={state.detoxDuration}
                introOrder={state.introOrder}
                schedule={app.schedule}
                onSetGoal={app.handleWeightGoalChange}
                onSelect={setSelected}
                onNavigate={setTab}
                onUpdate={app.handleProgrammeSettingsUpdate}
              />
            )}

            {tab === "log" && (
              <LogTab
                session={auth.session}
                nutrition={state.nutrition}
                country="india"
              />
            )}

            {tab === "schedule" && (
              <ScheduleTab
                months={app.months}
                foods={state.foods}
                removed={state.removed}
                status={state.status}
                allergies={state.allergies || []}
                favouriteFoods={state.favouriteFoods || []}
                introOrder={state.introOrder}
                preferredGroups={state.preferredGroups}
                recentlyClearedFoodId={app.recentlyClearedFoodId}
                reintroStart={app.reintroStart}
                schedule={app.schedule}
                onSelect={setSelected}
                onReorderGroups={app.reorderFoodsByGroups}
                onResetOrder={app.resetFoodOrder}
                onUpdateAllergies={app.updateAllergies}
                onAddFood={app.addNewFood}
                onRemoveFood={app.removeFood}
                onRestoreFood={app.restoreFood}
                onMoveFood={app.moveFood}
                onToggleFav={app.toggleFavouriteFood}
              />
            )}

            {tab === "recipes" && (
              <RecipesPage
                session={auth.session}
                country="india"
                favourites={state.favourites}
                favouriteFoods={state.favouriteFoods || []}
                onToggleFavourite={app.toggleFavouriteRecipe}
                statusMap={state.status}
                nutrition={state.nutrition}
                onNutritionChange={app.updateNutrition}
              />
            )}

            {tab === "reports" && (
              <ReportsTab
                foods={state.foods}
                status={state.status}
                observations={state.observations}
                body={state.body}
                onBodyChange={app.updateBody}
              />
            )}

            {tab === "profile" && (
              <ProfileTab body={state.body} onBodyChange={app.updateBody} />
            )}

          </div>
        </main>
      </div>

      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        session={auth.session}
        syncStatus={app.syncStatus}
        guestMode={auth.guestMode}
        authMode={auth.authMode}
        authEmail={auth.authEmail}
        authPassword={auth.authPassword}
        authMessage={auth.authMessage}
        rememberedEmails={auth.rememberedEmails}
        userName={state.user.name}
        onAuthModeChange={auth.setAuthMode}
        onEmailChange={auth.setAuthEmail}
        onPasswordChange={auth.setAuthPassword}
        onSubmit={auth.handleEmailPasswordAuth}
        onForgotPassword={auth.handleForgotPassword}
        onSignOut={handleSignOut}
        onExitGuestMode={handleExitGuestMode}
        onNameChange={app.updateUserName}
        onExportJson={app.exportJson}
        onExportCsv={app.exportCsv}
        onImportJson={app.handleImportJson}
        onReset={app.resetAll}
      />

      <BottomNav tab={tab} onTabChange={setTab} stats={app.stats} />

      {auth.showPasswordReset && <PasswordResetModal onSubmit={auth.handleSetNewPassword} />}

      {selected && (
        <EntryModal
          selected={selected}
          intake={state.intake[selected.food.id]}
          observation={state.observations[selected.food.id]}
          status={state.status[selected.food.id] || "Pending"}
          pinnedDate={state.pinnedFoods?.[selected.food.id]}
          pinnedFoods={state.pinnedFoods}
          skipObserve={!!state.skipObserve?.[selected.food.id]}
          reintroStart={app.reintroStart}
          schedule={app.schedule}
          onClose={() => setSelected(null)}
          onSaveIntake={app.saveIntake}
          onSaveObservation={app.updateFoodStatus}
          onSetObserveDay={app.setObserveDay}
          onPinDate={app.pinFoodDate}
          onUnpin={app.unpinFood}
        />
      )}
    </div>
  );
}
