import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SW } = Dimensions.get('window');
const MAP_SIZE = Math.min(SW - 48, 320);
const CENTER = MAP_SIZE / 2;

// Star systems positioned in a spiral galaxy pattern
const SYSTEMS = [
  { name: 'Corvax Prime', x: 0.50, y: 0.48, size: 4 },
  { name: 'Korveth', x: 0.42, y: 0.55, size: 3 },
  { name: "Vrak'Shaddain", x: 0.65, y: 0.60, size: 3 },
  { name: "Ky'rrahsh", x: 0.35, y: 0.38, size: 3 },
  { name: "Xeel'tharia", x: 0.72, y: 0.42, size: 2 },
  { name: "Kzz'el", x: 0.78, y: 0.68, size: 2 },
  { name: "Dathrym", x: 0.22, y: 0.70, size: 2 },
  { name: "Lorthal", x: 0.30, y: 0.25, size: 2 },
  { name: "Jhakkar", x: 0.82, y: 0.30, size: 2 },
  { name: "Tak'odrin", x: 0.55, y: 0.32, size: 2 },
  { name: "Bhatuu", x: 0.18, y: 0.50, size: 2 },
  { name: "Vhandir", x: 0.60, y: 0.78, size: 2 },
  { name: "Ord Mantyll", x: 0.40, y: 0.72, size: 2 },
  { name: "Bhracca", x: 0.85, y: 0.52, size: 2 },
  { name: "Floxxum", x: 0.25, y: 0.82, size: 2 },
  { name: "Mustavor", x: 0.68, y: 0.20, size: 2 },
  { name: "Nebora", x: 0.48, y: 0.65, size: 2 },
  { name: "Vhandalor", x: 0.58, y: 0.15, size: 2 },
];

// Background stars
const BG_STARS = Array.from({ length: 60 }, () => ({
  x: Math.random(),
  y: Math.random(),
  size: Math.random() * 1.5 + 0.5,
  opacity: Math.random() * 0.4 + 0.1,
}));

interface HoloTableProps {
  accentColor?: string;
}

export const HoloTableGalaxy: React.FC<HoloTableProps> = ({ accentColor = '#4FC3F7' }) => {
  const [routeNodes, setRouteNodes] = useState<number[]>([]);
  const [trailNodes, setTrailNodes] = useState<number[]>([]);
  const [activeNode, setActiveNode] = useState(-1);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const flickerAnim = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Pulse for active node
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Holographic flicker
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flickerAnim, { toValue: 0.85, duration: 100, useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Rotating scan effect
  useEffect(() => {
    Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 4000, useNativeDriver: false })
    ).start();
  }, []);

  // Route glow
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  // Generate and animate hyperspace routes
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let stepTimer: ReturnType<typeof setTimeout>;

    const animateRoute = () => {
      // Pick random start and end
      const start = Math.floor(Math.random() * SYSTEMS.length);
      let end = start;
      while (end === start) end = Math.floor(Math.random() * SYSTEMS.length);

      // Build path through 3-5 systems
      const pathLength = 3 + Math.floor(Math.random() * 3);
      const path = [start];
      const used = new Set([start]);

      for (let i = 1; i < pathLength; i++) {
        // Find nearest unvisited system
        const current = path[path.length - 1];
        let nearest = -1;
        let nearestDist = Infinity;
        for (let j = 0; j < SYSTEMS.length; j++) {
          if (used.has(j)) continue;
          const dx = SYSTEMS[j].x - SYSTEMS[current].x;
          const dy = SYSTEMS[j].y - SYSTEMS[current].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist) { nearestDist = dist; nearest = j; }
        }
        if (nearest >= 0) { path.push(nearest); used.add(nearest); }
      }

      setRouteNodes(path);
      setTrailNodes([]);
      setActiveNode(0);

      let step = 0;
      interval = setInterval(() => {
        step++;
        if (step >= path.length) {
          clearInterval(interval);
          setTrailNodes([...path]);
          setActiveNode(-1);
          stepTimer = setTimeout(animateRoute, 800);
        } else {
          setActiveNode(step);
          setTrailNodes(path.slice(0, step));
        }
      }, 500);
    };

    animateRoute();
    return () => { clearInterval(interval); clearTimeout(stepTimer); };
  }, []);

  const scanRotation = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.6],
  });

  return (
    <Animated.View style={[styles.container, { opacity: flickerAnim }]}>
      <Text style={[styles.title, { color: accentColor }]}>HOLOGRAPHIC NAVIGATION</Text>
      <Text style={styles.subtitle}>Navicomputer plotting hyperspace route...</Text>

      {/* Holo-table surface */}
      <View style={[styles.holoTable, { width: MAP_SIZE, height: MAP_SIZE }]}>
        {/* Holographic glow ring */}
        <View style={[styles.glowRing, {
          borderColor: accentColor,
          width: MAP_SIZE + 8, height: MAP_SIZE + 8,
          borderRadius: (MAP_SIZE + 8) / 2,
        }]} />

        {/* Galaxy spiral hint - concentric rings */}
        {[0.2, 0.35, 0.5, 0.65, 0.8].map((r, i) => (
          <View key={`ring-${i}`} style={[styles.galaxyRing, {
            width: MAP_SIZE * r, height: MAP_SIZE * r,
            borderRadius: MAP_SIZE * r / 2,
            borderColor: `${accentColor}15`,
            top: CENTER - (MAP_SIZE * r / 2),
            left: CENTER - (MAP_SIZE * r / 2),
          }]} />
        ))}

        {/* Rotating scan line */}
        <Animated.View style={[styles.scanLine, {
          transform: [{ rotate: scanRotation }],
          width: MAP_SIZE / 2,
          left: CENTER,
          top: CENTER - 1,
          backgroundColor: accentColor,
        }]} />

        {/* Background stars */}
        {BG_STARS.map((star, i) => (
          <View key={`bg-${i}`} style={[styles.bgStar, {
            left: star.x * MAP_SIZE,
            top: star.y * MAP_SIZE,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            opacity: star.opacity,
          }]} />
        ))}

        {/* Route lines */}
        {trailNodes.length > 1 && trailNodes.map((nodeIdx, i) => {
          if (i === 0) return null;
          const prev = SYSTEMS[trailNodes[i - 1]];
          const curr = SYSTEMS[nodeIdx];
          const x1 = prev.x * MAP_SIZE;
          const y1 = prev.y * MAP_SIZE;
          const x2 = curr.x * MAP_SIZE;
          const y2 = curr.y * MAP_SIZE;
          const dx = x2 - x1; const dy = y2 - y1;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          return (
            <Animated.View key={`line-${i}`} style={[styles.routeLine, {
              width: length, left: x1, top: y1 - 1,
              backgroundColor: accentColor,
              opacity: glowOpacity,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: 'left center',
            }]} />
          );
        })}

        {/* Star systems */}
        {SYSTEMS.map((sys, i) => {
          const isActive = routeNodes[activeNode] === i;
          const isTrail = trailNodes.includes(i);
          const isOnRoute = routeNodes.includes(i);
          return (
            <View key={i} style={{ position: 'absolute', left: sys.x * MAP_SIZE - 20, top: sys.y * MAP_SIZE - 12, alignItems: 'center', width: 40 }}>
              <Animated.View style={[
                styles.starNode,
                {
                  width: sys.size * 2 + 2,
                  height: sys.size * 2 + 2,
                  borderRadius: sys.size + 1,
                  backgroundColor: isActive ? '#fff' : isTrail ? accentColor : isOnRoute ? `${accentColor}88` : `${accentColor}30`,
                },
                isActive && { opacity: pulseAnim, shadowColor: '#fff', shadowRadius: 8, shadowOpacity: 0.8 },
              ]} />
              <Text style={[
                styles.systemLabel,
                isActive && { color: '#fff', fontWeight: 'bold' },
                isTrail && { color: accentColor },
              ]} numberOfLines={1}>
                {sys.name}
              </Text>
            </View>
          );
        })}

        {/* Center core glow */}
        <View style={[styles.coreGlow, {
          backgroundColor: `${accentColor}20`,
          left: CENTER - 15, top: CENTER - 15,
        }]} />
      </View>

      {/* Status readout */}
      <View style={styles.readout}>
        <View style={[styles.readoutDot, { backgroundColor: accentColor }]} />
        <Text style={[styles.readoutText, { color: `${accentColor}CC` }]}>
          {activeNode >= 0 && routeNodes[activeNode] !== undefined
            ? `WAYPOINT ${activeNode + 1}/${routeNodes.length}: ${SYSTEMS[routeNodes[activeNode]]?.name}`
            : 'RECALCULATING ROUTE...'}
        </Text>
      </View>
      <Text style={styles.coordText}>
        {activeNode >= 0 && routeNodes[activeNode] !== undefined
          ? `BEARING ${(Math.random() * 360).toFixed(1)}° | DIST ${(Math.random() * 50 + 5).toFixed(1)} PARSECS`
          : 'SCANNING HYPERSPACE LANES...'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center', padding: 16,
  },
  title: {
    fontSize: 13, fontWeight: 'bold', letterSpacing: 3, marginBottom: 2,
  },
  subtitle: {
    color: '#556', fontSize: 11, marginBottom: 12, fontStyle: 'italic',
  },
  holoTable: {
    borderRadius: 999, overflow: 'hidden',
    backgroundColor: 'rgba(0,10,20,0.8)',
    borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)',
    position: 'relative',
  },
  glowRing: {
    position: 'absolute', top: -4, left: -4,
    borderWidth: 1, opacity: 0.3,
  },
  galaxyRing: {
    position: 'absolute', borderWidth: 1,
  },
  scanLine: {
    position: 'absolute', height: 2, opacity: 0.15,
    transformOrigin: 'left center',
  },
  bgStar: {
    position: 'absolute', backgroundColor: 'rgba(200,220,255,0.6)',
  },
  routeLine: {
    position: 'absolute', height: 2, transformOrigin: 'left center',
  },
  starNode: {
    marginBottom: 1,
  },
  systemLabel: {
    color: 'rgba(150,180,200,0.5)', fontSize: 6, textAlign: 'center',
    letterSpacing: 0.5,
  },
  coreGlow: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15,
  },
  readout: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
  },
  readoutDot: {
    width: 6, height: 6, borderRadius: 3, marginRight: 8,
  },
  readoutText: {
    fontSize: 11, fontFamily: 'monospace', letterSpacing: 0.5,
  },
  coordText: {
    color: '#445', fontSize: 9, fontFamily: 'monospace', marginTop: 4, letterSpacing: 1,
  },
});
