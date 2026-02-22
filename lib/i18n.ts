export type Locale = 'fr';

type TranslationTree = {
  goalLabels: Record<string, string>;
  levelLabels: Record<string, string>;
};

const translations: Record<Locale, TranslationTree> = {
  fr: {
    goalLabels: {
      fat_loss: 'Perte de gras',
      muscle_gain: 'Prise de muscle',
      strength: 'Force',
      recomp: 'Recomposition corporelle',
      endurance: 'Endurance',
      general_fitness: 'Forme générale'
    },
    levelLabels: {
      beginner: 'Débutant',
      intermediate: 'Intermédiaire',
      advanced: 'Avancé'
    }
  }
};

export const t = (locale: Locale): TranslationTree => translations[locale];
