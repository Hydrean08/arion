export const colors = {
  bg:      '#0f0f13',
  surface: '#1a1a24',
  card:    '#1e1e2e',
  border:  '#2a2a3a',
  accent:  '#6c63ff',
  accent2: '#a78bfa',
  text:    '#e2e2f0',
  muted:   '#888899',
  green:   '#4ade80',
  yellow:  '#facc15',
  red:     '#f87171',
  blue:    '#60a5fa',
};

export const statusColors = {
  resolved:    colors.green,
  complete:    colors.green,
  done:        colors.green,
  partial:     colors.yellow,
  pending:     colors.blue,
  queued:      colors.blue,
  downloading: colors.accent2,
  missing:     colors.muted,
  failed:      colors.red,
  error:       colors.red,
};

export const statusBg = {
  resolved:    '#14401a',
  complete:    '#14401a',
  done:        '#14401a',
  partial:     '#2d2a00',
  pending:     '#1a1a2e',
  queued:      '#1a1a2e',
  downloading: '#1e1a3a',
  missing:     '#1e1e2e',
  failed:      '#3d1515',
  error:       '#3d1515',
};
