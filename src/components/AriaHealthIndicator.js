import React from 'react';
import { Text } from 'react-native';
import { aria } from '../api/aria';
import { ServiceHealthIndicator, detailStyles } from './ServiceHealthIndicator';

// Aria-specific detail rows. Shape mirrors /health on the aria side:
//   checks.cycle.{status, age_seconds, interval}
//   checks.db.{status}
//   checks.ollama.{status}   ← informational; aria's music sync doesn't depend on it
function renderAriaDetails(health) {
  const cycle = health.checks?.cycle;
  const db = health.checks?.db;
  const ollama = health.checks?.ollama;
  return (
    <>
      <Text style={detailStyles.row}>
        Cycle: {cycle?.status ?? '—'}
        {cycle?.interval ? ` (interval ${Math.round(cycle.interval / 60)}m)` : ''}
      </Text>
      <Text style={detailStyles.row}>DB: {db?.status ?? '—'}</Text>
      <Text style={detailStyles.row}>
        Ollama: {ollama?.status ?? '—'} (AI suggestions)
      </Text>
    </>
  );
}

export function AriaHealthIndicator(props) {
  return (
    <ServiceHealthIndicator
      serviceName="Aria"
      apiFn={aria.health}
      renderDetails={renderAriaDetails}
      {...props}
    />
  );
}
