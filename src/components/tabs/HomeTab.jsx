import { PhaseHeroCard } from "../PhaseHeroCard.jsx";
import { WeightWidget } from "../WeightWidget.jsx";
import { TodayCard } from "../TodayCard.jsx";
import { RecipeOfTheDay } from "../RecipeOfTheDay.jsx";
import { UpcomingList } from "../UpcomingList.jsx";
import { ProgrammeSettings } from "../ProgrammeSettings.jsx";
import { iso } from "../../utils/dates";

export function HomeTab({
  phaseInfo, stats, reintroStart, finishDate,
  todayItem, nextFood,
  status, weights, weightGoal,
  programmeStart, detoxDuration, introOrder,
  schedule,
  onSetGoal, onSelect, onNavigate, onUpdate,
}) {
  return (
    <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto animate-fadeUp">
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6">
        {/* Main column */}
        <div className="space-y-5">
          <PhaseHeroCard
            phaseInfo={phaseInfo}
            stats={stats}
            reintroStart={reintroStart}
            nextFood={nextFood}
            finishDate={finishDate}
          />
          {/* Weight widget — mobile only; desktop in right col */}
          <div className="lg:hidden">
            <WeightWidget
              weights={weights}
              weightGoal={weightGoal}
              onSetGoal={onSetGoal}
              onNavigate={onNavigate}
            />
          </div>
          <TodayCard
            todayItem={todayItem}
            status={status}
            onSelect={onSelect}
            programmeStart={programmeStart}
            reintroStart={iso(reintroStart)}
            phaseInfo={phaseInfo}
            nextFoodName={nextFood?.name}
          />
          {/* Recipe of the Day — mobile only; desktop in right col */}
          <div className="lg:hidden">
            <RecipeOfTheDay
              statusMap={status}
              programmeStart={programmeStart}
              detoxDuration={detoxDuration}

              onNavigate={onNavigate}
            />
          </div>
          <UpcomingList
            schedule={schedule}
            status={status}
            onSelect={onSelect}
            onNavigate={onNavigate}
          />
          {/* Programme settings — mobile only; desktop in right col */}
          <div className="lg:hidden">
            <ProgrammeSettings
              programmeStart={programmeStart}
              detoxDuration={detoxDuration ?? 14}
              introOrder={introOrder}
              onUpdate={onUpdate}
            />
          </div>
        </div>
        {/* Right column — desktop only */}
        <div className="hidden lg:flex flex-col gap-5">
          <WeightWidget
            weights={weights}
            weightGoal={weightGoal}
            onSetGoal={onSetGoal}
            onNavigate={onNavigate}
          />
          <RecipeOfTheDay
            statusMap={status}
            programmeStart={programmeStart}
            detoxDuration={detoxDuration}
            onNavigate={onNavigate}
          />
          <ProgrammeSettings
            programmeStart={programmeStart}
            detoxDuration={detoxDuration ?? 14}
            introOrder={introOrder}
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </div>
  );
}
