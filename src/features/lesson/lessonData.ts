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
    name: 'Open Strike',
    difficulty: 'Beginner',
    bpm: 80,
    sequence: ['OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN'],
    description: 'Master the resonant ringing sound! Let the Manjira sing freely.',
    passAccuracy: 70
  },
  {
    id: 'lesson_2',
    name: 'Close Strike',
    difficulty: 'Beginner',
    bpm: 80,
    sequence: ['CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED'],
    description: 'Learn to quiet the sound quickly for a sharp, clear beat.',
    passAccuracy: 70
  },
  {
    id: 'lesson_3',
    name: 'Alternate Strikes',
    difficulty: 'Intermediate',
    bpm: 90,
    sequence: [
      'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED',
      'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED', 'OPEN', 'CLOSED'
    ],
    description: 'Bring them together! Practice switching between Open and Close.',
    passAccuracy: 75
  }
];
