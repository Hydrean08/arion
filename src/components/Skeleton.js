import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../theme';

const W      = Dimensions.get('window').width;
const COLS   = Math.floor(W / 130);
const CARD_W = (W - 24 - (COLS - 1) * 10) / COLS;
const CARD_H = Math.round(CARD_W * 1.5);

const NAME_WIDTHS = [150, 130, 170, 120, 160, 140, 180];
const META_WIDTHS = [80,  90,  70,  85,  75,  95,  80];

function usePulse() {
  const val = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 0.75, duration: 900, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [val]);
  return val;
}

export function SkeletonPosterGrid({ showStats = false }) {
  const opacity = usePulse();
  return (
    <View style={styles.root}>
      {showStats && (
        <>
          <View style={styles.statsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Animated.View key={i} style={[styles.statBox, { opacity }]} />
            ))}
          </View>
          <Animated.View style={[styles.searchBox, { opacity }]} />
          <View style={styles.pillRow}>
            {[50, 68, 60, 68, 60].map((w, i) => (
              <Animated.View key={i} style={[styles.pill, { width: w, opacity }]} />
            ))}
          </View>
        </>
      )}
      <View style={styles.grid}>
        {Array.from({ length: COLS * 4 }).map((_, i) => (
          <Animated.View key={i} style={[styles.poster, { width: CARD_W, height: CARD_H, opacity }]} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonArtistList({ showStats = false }) {
  const opacity = usePulse();
  return (
    <View style={styles.root}>
      {showStats && (
        <>
          <View style={styles.statsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Animated.View key={i} style={[styles.statBox, { opacity }]} />
            ))}
          </View>
          <View style={styles.tabRow}>
            <Animated.View style={[styles.tabBox, { opacity }]} />
            <Animated.View style={[styles.tabBox, { opacity }]} />
          </View>
        </>
      )}
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={styles.artistRow}>
          <Animated.View style={[styles.circle, { opacity }]} />
          <View style={styles.lines}>
            <Animated.View style={[styles.line,   { width: NAME_WIDTHS[i % 7], opacity }]} />
            <Animated.View style={[styles.lineSm, { width: META_WIDTHS[i % 7], opacity }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const bg = colors.surface;

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.bg },
  statsRow:  { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 8 },
  statBox:   { flex: 1, height: 52, borderRadius: 10, backgroundColor: bg },
  searchBox: { marginHorizontal: 12, height: 40, borderRadius: 10, backgroundColor: bg, marginBottom: 10 },
  pillRow:   { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 6 },
  pill:      { height: 30, borderRadius: 99, backgroundColor: bg },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  poster:    { borderRadius: 10, backgroundColor: bg },
  tabRow:    { flexDirection: 'row', marginHorizontal: 12, marginTop: 10, marginBottom: 12, gap: 8 },
  tabBox:    { flex: 1, height: 40, borderRadius: 10, backgroundColor: bg },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  circle:    { width: 48, height: 48, borderRadius: 24, backgroundColor: bg, flexShrink: 0 },
  lines:     { flex: 1, gap: 7 },
  line:      { height: 14, borderRadius: 4, backgroundColor: bg },
  lineSm:    { height: 11, borderRadius: 4, backgroundColor: bg },
});
