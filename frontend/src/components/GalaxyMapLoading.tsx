import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

// Galaxy map grid - Galactic sector coordinates
// Each cell: 0=empty, 1=star, 2=route-node, 3=current-plot
const GALAXY_SECTORS = [
  ['Vhaxen Arm',     'Wyld Reach',    'Uncharted Veil',    'Thyxi Bound',    'Wyld Reach'       ],
  ['Vex Marches',    "Kzz'el",        "Dathrym",           "Lorthal",        "Jhakkar"          ],
  ['Myd Reach',      "Tak'odrin",     "Nebora",            "Ky'rrahsh",      "Xeel'tharia"      ],
  ['Expanse',        "Ord Mantyll",   "Corr Worlds",       "Korveth",        "Nal Vzorga"       ],
  ['Inr Marches',    "Bhatuu",        "Corvax Prime",      "Kuathh",          "Floxxum"          ],
  ['Voidcore',       "Bhracca",       "Byzzar",            "Vrak'Shaddain",  "Vhandir"          ],
];

const ROUTE_CONNECTIONS = [
  [0,1], [1,2], [2,3], [3,4],
  [5,6], [6,7], [7,8], [8,9],
  [10,11], [11,12], [12,13], [13,14],
  [15,16], [16,17], [17,18], [18,19],
  [20,21], [21,22], [22,23], [23,24],
  [25,26], [26,27], [27,28], [28,29],
  // Verticals
  [0,5], [1,6], [2,7], [3,8], [4,9],
  [5,10], [6,11], [7,12], [8,13], [9,14],
  [10,15], [11,16], [12,17], [13,18], [14,19],
  [15,20], [16,21], [17,22], [18,23], [19,24],
  [20,25], [21,26], [22,27], [23,28], [24,29],
];

interface GalaxyMapLoadingProps {
  accentColor?: string;
}

export const GalaxyMapLoading: React.FC<GalaxyMapLoadingProps> = ({
  accentColor = '#FFD700',
}) => {
  const [plotPath, setPlotPath] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for the active node
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Scan line animation
  useEffect(() => {
    const scan = Animated.loop(
      Animated.timing(scanLineAnim, { toValue: 1, duration: 3000, useNativeDriver: false })
    );
    scan.start();
    return () => scan.stop();
  }, []);

  // Generate random hyperspace route and animate it
  useEffect(() => {
    const generateRoute = () => {
      // Start from a random edge sector, navigate toward center
      const totalCells = 30;
      const path: number[] = [];
      let current = Math.floor(Math.random() * 5); // Top row
      path.push(current);

      for (let row = 1; row < 6; row++) {
        const col = current % 5;
        const nextCol = Math.max(0, Math.min(4, col + Math.floor(Math.random() * 3) - 1));
        current = row * 5 + nextCol;
        path.push(current);
      }
      return path;
    };

    let intervalId: ReturnType<typeof setInterval>;
    let stepTimeout: ReturnType<typeof setTimeout>;

    const animatePath = () => {
      const newPath = generateRoute();
      setPlotPath(newPath);
      setCurrentStep(0);

      let step = 0;
      intervalId = setInterval(() => {
        step++;
        if (step >= newPath.length) {
          clearInterval(intervalId);
          // After finishing, wait then restart with new path
          stepTimeout = setTimeout(animatePath, 1200);
        } else {
          setCurrentStep(step);
        }
      }, 400);
    };

    animatePath();

    return () => {
      clearInterval(intervalId);
      clearTimeout(stepTimeout);
    };
  }, []);

  const flatSectors = GALAXY_SECTORS.flat();
  const scanLineTop = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: accentColor }]}>PLOTTING HYPERSPACE ROUTE</Text>
      <Text style={styles.subtitle}>Navicomputer calculating...</Text>

      {/* Galaxy Grid */}
      <View style={styles.gridContainer}>
        {/* Scan line overlay */}
        <Animated.View
          style={[
            styles.scanLine,
            {
              top: scanLineTop,
              backgroundColor: accentColor,
            },
          ]}
        />

        {GALAXY_SECTORS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            {row.map((sectorName, colIdx) => {
              const cellIndex = rowIdx * 5 + colIdx;
              const isInPath = plotPath.includes(cellIndex);
              const pathPosition = plotPath.indexOf(cellIndex);
              const isReached = isInPath && pathPosition <= currentStep;
              const isCurrent = isInPath && pathPosition === currentStep;
              const isTrail = isInPath && pathPosition < currentStep;

              return (
                <View key={colIdx} style={styles.cellContainer}>
                  {/* Connection lines to right */}
                  {colIdx < 4 && (
                    <View
                      style={[
                        styles.hLine,
                        {
                          backgroundColor: (isTrail && plotPath.includes(cellIndex + 1) && plotPath.indexOf(cellIndex + 1) <= currentStep)
                            ? accentColor
                            : 'rgba(255,255,255,0.08)',
                        },
                      ]}
                    />
                  )}
                  {/* Connection lines down */}
                  {rowIdx < 5 && (
                    <View
                      style={[
                        styles.vLine,
                        {
                          backgroundColor: (isTrail && plotPath.includes(cellIndex + 5) && plotPath.indexOf(cellIndex + 5) <= currentStep)
                            ? accentColor
                            : 'rgba(255,255,255,0.08)',
                        },
                      ]}
                    />
                  )}

                  {/* Node */}
                  <Animated.View
                    style={[
                      styles.cell,
                      isReached && { borderColor: accentColor, borderWidth: 1 },
                      isTrail && { backgroundColor: `${accentColor}33` },
                      isCurrent && {
                        backgroundColor: accentColor,
                        opacity: pulseAnim,
                        shadowColor: accentColor,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 6,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isCurrent && styles.cellTextActive,
                        isTrail && { color: accentColor },
                      ]}
                      numberOfLines={1}
                    >
                      {sectorName.length > 7 ? sectorName.substring(0, 6) + '.' : sectorName}
                    </Text>
                  </Animated.View>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Status line */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
        <Text style={styles.statusText}>
          Sector {currentStep + 1}/{plotPath.length} | {flatSectors[plotPath[currentStep]] || '...'}
        </Text>
      </View>

      {/* Coordinates readout */}
      <Text style={styles.coordText}>
        {`> COORDINATES: ${String.fromCharCode(65 + (plotPath[currentStep] || 0) % 5)}${Math.floor((plotPath[currentStep] || 0) / 5) + 1}`}
        {`  BEARING: ${(Math.random() * 360).toFixed(1)}°`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    fontSize: 12,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  gridContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    overflow: 'hidden',
    position: 'relative',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.3,
    zIndex: 10,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 2,
  },
  cellContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 36,
  },
  hLine: {
    position: 'absolute',
    right: -8,
    top: '50%',
    width: 16,
    height: 1,
    zIndex: -1,
  },
  vLine: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    width: 1,
    height: 10,
    zIndex: -1,
  },
  cell: {
    width: 52,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cellText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 7,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cellTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  statusText: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  coordText: {
    color: '#555',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 6,
    letterSpacing: 1,
  },
});
