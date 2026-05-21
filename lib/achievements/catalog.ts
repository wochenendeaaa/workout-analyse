export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_upload",
    title: "Erster Upload",
    description: "Erstes Training hochgeladen",
    icon: "🚀",
  },
  {
    id: "first_pr",
    title: "Erster PR",
    description: "Ersten persönlichen Rekord aufgestellt",
    icon: "🏆",
  },
  {
    id: "streak_5",
    title: "5er-Serie",
    description: "5 Trainingseinheiten in Folge",
    icon: "🔥",
  },
  {
    id: "streak_10",
    title: "10er-Serie",
    description: "10 Trainingseinheiten in Folge",
    icon: "⚡",
  },
  {
    id: "bench_100",
    title: "Drei Platten",
    description: "Bankdrücken e1RM ≥ 100 kg",
    icon: "💪",
  },
  {
    id: "ton_day",
    title: "Tonnentag",
    description: "1.000 kg Gesamtvolumen an einem Tag",
    icon: "🏋️",
  },
  {
    id: "sessions_10",
    title: "10 Sessions",
    description: "10 Trainingseinheiten absolviert",
    icon: "📅",
  },
  {
    id: "sessions_50",
    title: "50 Sessions",
    description: "50 Trainingseinheiten absolviert",
    icon: "🎯",
  },
];
