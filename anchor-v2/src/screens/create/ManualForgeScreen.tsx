import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  StatusBar,
  PanResponder,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

// Color palette from the handoff document
const COLORS = {
  charcoal: '#1A1A1D',
  navy: '#0F1419',
  darkBlue: '#1a2332', // Darker blue background
  gold: '#D4AF37',
  bone: '#F5F5DC',
  deepPurple: '#3E2C5B',
  silver: '#C0C0C0',
};

interface Point {
  x: number;
  y: number;
}

interface PathData {
  points: Point[];
  color: string;
  strokeWidth: number;
}

const ManualForgeScreen = () => {
  const navigation = useNavigation();
  // Use ref for paths to avoid stale closure issues entirely
  const pathsRef = useRef<PathData[]>([]);
  const [, forceUpdate] = useState(0); // Counter to force re-renders
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState(COLORS.gold);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isErasing, setIsErasing] = useState(false);

  // Getter for paths (for rendering)
  const paths = pathsRef.current;

  const colors = [
    COLORS.gold,
    COLORS.bone,
    COLORS.deepPurple,
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
  ];

  const strokeWidths = [2, 4, 6, 8];

  // Current stroke ref
  const strokeRef = useRef<Point[]>([]);

  // Style refs to avoid stale closures
  const styleRef = useRef({ color: selectedColor, width: strokeWidth, isErasing });
  styleRef.current = { color: selectedColor, width: strokeWidth, isErasing };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        strokeRef.current = [{ x: locationX, y: locationY }];
        setCurrentPoints([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        strokeRef.current.push({ x: locationX, y: locationY });
        setCurrentPoints([...strokeRef.current]);
      },
      onPanResponderRelease: () => {
        if (strokeRef.current.length > 0) {
          const { color, width, isErasing } = styleRef.current;
          pathsRef.current = [
            ...pathsRef.current,
            {
              points: [...strokeRef.current],
              color: isErasing ? COLORS.navy : color,
              strokeWidth: isErasing ? width * 3 : width,
            },
          ];
          strokeRef.current = [];
          setCurrentPoints([]);
          forceUpdate(n => n + 1); // Trigger re-render to show new path
        }
      },
      onPanResponderTerminate: () => {
        if (strokeRef.current.length > 0) {
          const { color, width, isErasing } = styleRef.current;
          pathsRef.current = [
            ...pathsRef.current,
            {
              points: [...strokeRef.current],
              color: isErasing ? COLORS.navy : color,
              strokeWidth: isErasing ? width * 3 : width,
            },
          ];
          strokeRef.current = [];
          setCurrentPoints([]);
          forceUpdate(n => n + 1);
        }
      },
    })
  ).current;

  const pointsToPath = (points: Point[]): string => {
    if (points.length === 0) return '';

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  const handleUndo = () => {
    pathsRef.current = pathsRef.current.slice(0, -1);
    forceUpdate(n => n + 1);
  };

  const handleClear = () => {
    pathsRef.current = [];
    forceUpdate(n => n + 1);
  };

  const handleSave = () => {
    // This would export the sigil and continue to the next step
    console.log('Saving manual sigil...');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manual Forge</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveText}>✓</Text>
        </TouchableOpacity>
      </View>

      {/* Instruction Text */}
      <View style={styles.instructionContainer}>
        <Text style={styles.instruction}>
          Draw your sigil using the letters: C L O S T H D
        </Text>
        <Text style={styles.subInstruction}>
          Merge and overlap the letters into a unique symbol
        </Text>
      </View>

      {/* Canvas Area */}
      <View style={styles.canvasContainer}>
        <View style={styles.canvas} {...panResponder.panHandlers}>
          <Svg height="100%" width="100%" style={styles.svg}>
            {/* Draw all completed paths */}
            {paths.map((pathData, index) => (
              <Path
                key={index}
                d={pointsToPath(pathData.points)}
                stroke={pathData.color}
                strokeWidth={pathData.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {/* Draw current path being drawn */}
            {currentPoints.length > 0 && (
              <Path
                d={pointsToPath(currentPoints)}
                stroke={isErasing ? COLORS.navy : selectedColor}
                strokeWidth={isErasing ? strokeWidth * 3 : strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </View>

        {/* Drawing Helper - Center Guide */}
        <View style={styles.gridOverlay} pointerEvents="none">
          <View style={styles.centerDot} />
        </View>
      </View>

      {/* Bottom Toolbar */}
      <View style={styles.toolbar}>
        {/* Stroke Width Selector */}
        <View style={styles.toolSection}>
          <Text style={styles.toolLabel}>Size</Text>
          <View style={styles.strokeWidthContainer}>
            {strokeWidths.map((width) => (
              <TouchableOpacity
                key={width}
                style={[
                  styles.strokeWidthButton,
                  strokeWidth === width && styles.strokeWidthButtonActive,
                ]}
                onPress={() => setStrokeWidth(width)}
              >
                <View
                  style={[
                    styles.strokeWidthIndicator,
                    {
                      width: width * 2,
                      height: width * 2,
                      backgroundColor: strokeWidth === width ? COLORS.gold : COLORS.silver,
                    },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color Palette */}
        <View style={styles.toolSection}>
          <Text style={styles.toolLabel}>Color</Text>
          <View style={styles.colorPalette}>
            {colors.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorButton,
                  selectedColor === color && !isErasing && styles.colorButtonActive,
                ]}
                onPress={() => {
                  setSelectedColor(color);
                  setIsErasing(false);
                }}
              >
                <View style={[styles.colorCircle, { backgroundColor: color }]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, isErasing && styles.actionButtonActive]}
            onPress={() => setIsErasing(!isErasing)}
          >
            <Text style={styles.actionIcon}>⌫</Text>
            <Text style={styles.actionLabel}>Erase</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleUndo}
            disabled={paths.length === 0}
          >
            <Text style={[styles.actionIcon, paths.length === 0 && styles.disabledIcon]}>
              ↶
            </Text>
            <Text style={[styles.actionLabel, paths.length === 0 && styles.disabledLabel]}>
              Undo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleClear}
            disabled={paths.length === 0}
          >
            <Text style={[styles.actionIcon, paths.length === 0 && styles.disabledIcon]}>
              ×
            </Text>
            <Text style={[styles.actionLabel, paths.length === 0 && styles.disabledLabel]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkBlue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 28,
    color: COLORS.bone,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.gold,
    fontFamily: 'Cinzel-SemiBold',
  },
  saveButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    borderRadius: 20,
  },
  saveText: {
    fontSize: 20,
    color: COLORS.navy,
    fontWeight: 'bold',
  },
  instructionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  instruction: {
    fontSize: 16,
    color: COLORS.bone,
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },
  subInstruction: {
    fontSize: 13,
    color: COLORS.silver,
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  canvasContainer: {
    flex: 1,
    margin: 16,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  canvas: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  svg: {
    backgroundColor: 'transparent',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.silver + '30',
  },
  toolbar: {
    backgroundColor: COLORS.charcoal,
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  toolSection: {
    marginBottom: 20,
  },
  toolLabel: {
    fontSize: 12,
    color: COLORS.silver,
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  strokeWidthContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  strokeWidthButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  strokeWidthButtonActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.deepPurple + '40',
  },
  strokeWidthIndicator: {
    borderRadius: 999,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.deepPurple + '40',
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  actionButton: {
    alignItems: 'center',
    padding: 8,
    minWidth: 70,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  actionButtonActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.deepPurple + '40',
  },
  actionIcon: {
    fontSize: 24,
    color: COLORS.bone,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 11,
    color: COLORS.bone,
    fontFamily: 'Inter-SemiBold',
  },
  disabledIcon: {
    color: COLORS.silver + '40',
  },
  disabledLabel: {
    color: COLORS.silver + '40',
  },
});

export default ManualForgeScreen;
