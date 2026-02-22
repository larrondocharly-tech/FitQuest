export type Locale = "fr"; // plus tard: "fr" | "en"

export const t = (locale: Locale) => {
  const dict = {
    fr: {
      back: "Retour",
      week: "Semaine",
      focus: "Focus",
      generate: "Générer mon programme",
      creatingProgram: "Créer un programme",
    },
  } as const;

  return dict[locale];
};