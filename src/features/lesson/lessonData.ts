export interface Lesson {
  id: string;
  name: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Master';
  bpm: number;
  sequence: ('OPEN' | 'CLOSED')[];
  description: string;
  passAccuracy: number; // Percentage threshold to unlock next
}

export const LESSONS: Lesson[] = [
  {
    id: 'lesson_1',
    name: 'Tardi Strike',
    difficulty: 'Beginner',
    bpm: 80,
    sequence: ['CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED'],
    description: 'Master the dampened sharp sound ("तर्डी")! Grip the metal rim firmly with your fingers for a crisp beat.',
    passAccuracy: 70
  },
  {
    id: 'lesson_2',
    name: 'Murda Strike',
    difficulty: 'Beginner',
    bpm: 80,
    sequence: ['OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN'],
    description: 'Master the resonant ringing sound ("मुर्दा")! Strike edge-to-edge and let the Manjira ring freely.',
    passAccuracy: 70
  },
  {
    id: 'lesson_3',
    name: 'Tardi & Murda Alternation',
    difficulty: 'Intermediate',
    bpm: 90,
    sequence: [
      'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN',
      'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN'
    ],
    description: 'The foundational rhythmic pattern! Anchor on Tardi (closed) then resolve to Murda (open).',
    passAccuracy: 75
  }
];
