import React from 'react';
import { Text } from 'react-native';
import { orion } from '../api/orion';
import { ServiceHealthIndicator, detailStyles } from './ServiceHealthIndicator';

// Orion-specific detail rows. Shape mirrors /health on the orion side:
//   checks.cycle.{status, age_seconds, poll_interval}
//   checks.predictor_db.{status, feature_kinds}
//   checks.tmdb_cache.{entries, ttl_seconds}
function renderOrionDetails(health) {
  const cycle = health.checks?.cycle;
  const predictor = health.checks?.predictor_db;
  const cache = health.checks?.tmdb_cache;
  return (
    <>
      <Text style={detailStyles.row}>
        Cycle: {cycle?.status ?? '—'}
        {cycle?.poll_interval ? ` (poll ${cycle.poll_interval}s)` : ''}
      </Text>
      <Text style={detailStyles.row}>
        Predictor DB: {predictor?.status ?? '—'}
        {predictor?.feature_kinds != null ? ` · ${predictor.feature_kinds} feature kinds` : ''}
      </Text>
      <Text style={detailStyles.row}>
        TMDB cache: {cache?.entries ?? '—'} entries
        {cache?.ttl_seconds ? ` · TTL ${Math.round(cache.ttl_seconds / 3600)}h` : ''}
      </Text>
    </>
  );
}

export function OrionHealthIndicator(props) {
  return (
    <ServiceHealthIndicator
      serviceName="Orion"
      apiFn={orion.health}
      renderDetails={renderOrionDetails}
      {...props}
    />
  );
}
