type Pose = { head: [number, number]; body: string; equipment: string }

const poses: Record<string, Pose> = {
  'Приседания на стул': { head: [74, 32], body: 'M71 42 58 66 79 67 85 91 M58 66 74 76 75 91 M68 49 83 55 96 51', equipment: 'M43 65H59 M44 65V92 M44 65V44 M57 66V92' },
  'Сгибание рук с гантелями': { head: [68, 25], body: 'M68 36V64 L57 91 M68 64 78 91 M68 42 81 60 92 46 M68 42 56 60 47 47', equipment: 'M87 46H97 M42 47H52' },
  'Отжимания от стены': { head: [93, 29], body: 'M89 39 75 59 52 91 M75 59 58 91 M89 44 99 56 112 45 M90 44 102 48 112 38', equipment: 'M112 19V92' },
  'Жим гантелей вверх': { head: [72, 39], body: 'M72 50V70 L62 91 M72 70 82 91 M72 51 53 43 53 24 M72 51 91 43 91 24', equipment: 'M47 23H59 M85 23H97' },
  'Подъёмы на носки': { head: [68, 23], body: 'M68 34V63 L61 83 69 91H76 M68 63 74 83 82 91H89 M68 43 86 48 102 48', equipment: 'M104 40V92' },
  'Ягодичный мостик': { head: [38, 81], body: 'M48 84 74 62 91 65 105 91H114 M54 80 69 85H79', equipment: 'M24 93H119' },
  'Тяга гантели одной рукой': { head: [91, 35], body: 'M85 45 66 53 58 71 49 92 M66 53 70 72 73 92 M82 46 97 66 M76 49 62 55 77 64', equipment: 'M91 67H109V92 M71 64H83' },
  'Разгибание ноги сидя': { head: [65, 27], body: 'M65 38V64H84 L107 69 M84 64 84 92 M65 44 74 59 82 62', equipment: 'M51 66H71 M52 66V93 M69 66V93 M52 66V43' },
  'Птица-собака': { head: [100, 52], body: 'M92 58 63 62 38 61 27 65 M63 62 57 85H44 M90 58 88 90H95 M91 57 117 56', equipment: 'M25 93H119' },
  'Разведение рук в стороны': { head: [72, 25], body: 'M72 36V65 L62 91 M72 65 82 91 M38 42 54 44 72 42 90 44 106 42', equipment: 'M33 42H43 M101 42H111' },
}

export function ExercisePose({ name }: { name: string }) {
  const pose = poses[name]
  if (!pose) return null
  return <svg className="h-36 w-full rounded-xl bg-[#e4f2e8]" viewBox="0 0 144 108" role="img" aria-label={`Схема упражнения · ${name}`}>
    <path d="M22 94H122" stroke="#96b6a3" strokeWidth="1.5" />
    <path d={pose.equipment} fill="none" stroke="#53836a" strokeWidth="3" strokeLinecap="round" />
    <circle cx={pose.head[0]} cy={pose.head[1]} r="8" fill="#174c36" />
    <path d={pose.body} fill="none" stroke="#174c36" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
