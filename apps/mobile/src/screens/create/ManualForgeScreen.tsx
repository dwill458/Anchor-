import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { PanResponder } from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { ZenBackground } from '@/components/common';
import { colors } from '@/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_ANDROID = Platform.OS === 'android';

// Canvas size - reduced height to ensure controls clear system navigation
const CANVAS_WIDTH = SCREEN_WIDTH - 24;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.58;

// Brush types
const BRUSH_TYPES = [
  { id: 'pen', name: 'Pen', icon: '✎', description: 'Solid, consistent line' },
  { id: 'brush', name: 'Brush', icon: '🖌', description: 'Organic, varied stroke' },
  { id: 'marker', name: 'Marker', icon: '🖍', description: 'Bold, semi-transparent' },
  { id: 'pencil', name: 'Pencil', icon: '✏️', description: 'Light, sketchy feel' },
  { id: 'calligraphy', name: 'Calligraphy', icon: '🖋', description: 'Elegant, angled tip' },
  { id: 'airbrush', name: 'Airbrush', icon: '💨', description: 'Soft, diffused edges' },
];

// Expanded color palette with mystical theme
const COLOR_PALETTE = [
  { id: 'gold', color: '#D4AF37', name: 'Sacred Gold' },
  { id: 'bone', color: '#F5F5DC', name: 'Moonlight Bone' },
  { id: 'silver', color: '#C0C0C0', name: 'Ethereal Silver' },
  { id: 'bronze', color: '#CD7F32', name: 'Ancient Bronze' },

  { id: 'purple', color: '#3E2C5B', name: 'Mystic Purple' },
  { id: 'violet', color: '#8B00FF', name: 'Cosmic Violet' },
  { id: 'indigo', color: '#4B0082', name: 'Deep Indigo' },
  { id: 'lavender', color: '#B57EDC', name: 'Spirit Lavender' },

  { id: 'cyan', color: '#00CED1', name: 'Crystal Cyan' },
  { id: 'turquoise', color: '#40E0D0', name: 'Azure Turquoise' },
  { id: 'teal', color: '#008080', name: 'Ocean Teal' },
  { id: 'mint', color: '#98D8C8', name: 'Healing Mint' },

  { id: 'coral', color: '#FF7F50', name: 'Warm Coral' },
  { id: 'rose', color: '#FF69B4', name: 'Love Rose' },
  { id: 'crimson', color: '#DC143C', name: 'Passion Crimson' },
  { id: 'amber', color: '#FFBF00', name: 'Solar Amber' },

  { id: 'emerald', color: '#50C878', name: 'Earth Emerald' },
  { id: 'jade', color: '#00A86B', name: 'Prosperity Jade' },
  { id: 'forest', color: '#228B22', name: 'Forest Green' },
  { id: 'sage', color: '#87AE73', name: 'Wisdom Sage' },

  { id: 'white', color: '#FFFFFF', name: 'Pure White' },
  { id: 'pearl', color: '#F0EAD6', name: 'Pearl White' },
  { id: 'ash', color: '#B2BEB5', name: 'Shadow Ash' },
  { id: 'onyx', color: '#353839', name: 'Onyx Black' },
];

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface Stroke {
  points: Point[];
  color: string;
  size: number;
  opacity: number;
  brushType: string;
}

type ManualForgeRouteProp = RouteProp<RootStackParamList, 'ManualForge'>;
type ManualForgeNavigationProp = StackNavigationProp<RootStackParamList, 'ManualForge'>;
type ToolTab = 'brush' | 'color' | 'effects' | 'layers';

export default function ManualForgeScreen() {
  const navigation = useNavigation<ManualForgeNavigationProp>();
  const route = useRoute<ManualForgeRouteProp>();

  // Params
  const intentionText = route.params?.intentionText || (route.params as any)?.intention || 'Manifest destiny';
  const distilledLetters = route.params?.distilledLetters || ['M', 'N', 'F', 'S', 'T', 'D', 'S', 'T', 'N', 'Y'];
  const category = route.params?.category;

  // Drawing state
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

  // Tool state
  const [selectedBrush, setSelectedBrush] = useState('pen');
  const [selectedColor, setSelectedColor] = useState(colors.gold);
  const [brushSize, setBrushSize] = useState(4);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [symmetryMode, setSymmetryMode] = useState<'none' | 'horizontal' | 'vertical' | 'radial'>('none');

  // UI state
  const [activeToolTab, setActiveToolTab] = useState<ToolTab>('brush');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const toolsPanelAnim = useRef(new Animated.Value(1)).current;

  // Refs to store current values for panResponder (prevents stale closure issues)
  const currentStrokeRef = useRef<Point[]>([]);
  const selectedColorRef = useRef(selectedColor);
  const brushSizeRef = useRef(brushSize);
  const brushOpacityRef = useRef(brushOpacity);
  const selectedBrushRef = useRef(selectedBrush);

  // Update refs when state changes
  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);

  useEffect(() => {
    brushOpacityRef.current = brushOpacity;
  }, [brushOpacity]);

  useEffect(() => {
    selectedBrushRef.current = selectedBrush;
  }, [selectedBrush]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // Pan responder for drawing with symmetry support
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStrokeRef.current = [{ x: locationX, y: locationY }];
        setCurrentStroke([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStrokeRef.current = [...currentStrokeRef.current, { x: locationX, y: locationY }];
        setCurrentStroke((prev) => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
        if (currentStrokeRef.current.length > 0) {
          const newStroke: Stroke = {
            points: currentStrokeRef.current,
            color: selectedColorRef.current,
            size: brushSizeRef.current,
            opacity: brushOpacityRef.current / 100,
            brushType: selectedBrushRef.current,
          };
          setStrokes((prev) => [...prev, newStroke]);
          setCurrentStroke([]);
          currentStrokeRef.current = [];
          setRedoStack([]); // Clear redo stack on new stroke
        }
      },
      onPanResponderTerminate: () => {
        if (currentStrokeRef.current.length > 0) {
          const newStroke: Stroke = {
            points: currentStrokeRef.current,
            color: selectedColorRef.current,
            size: brushSizeRef.current,
            opacity: brushOpacityRef.current / 100,
            brushType: selectedBrushRef.current,
          };
          setStrokes((prev) => [...prev, newStroke]);
          setCurrentStroke([]);
          currentStrokeRef.current = [];
          setRedoStack([]);
        }
      }
    })
  ).current;

  const handleUndo = () => {
    if (strokes.length > 0) {
      const lastStroke = strokes[strokes.length - 1];
      setRedoStack((prev) => [...prev, [lastStroke]]);
      setStrokes((prev) => prev.slice(0, -1));
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const strokesToRedo = redoStack[redoStack.length - 1];
      setStrokes((prev) => [...prev, ...strokesToRedo]);
      setRedoStack((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setRedoStack([]);
  };

  const handleSave = () => {
    if (strokes.length === 0) {
      Alert.alert('Empty Forge', 'Please draw your symbol before saving.');
      return;
    }
    setShowSaveModal(true);
  };

  const handleBack = () => {
    if (strokes.length > 0) {
      // Show confirmation if there are unsaved changes
      Alert.alert(
        'Discard Changes?',
        'You have unsaved work. Are you sure you want to leave?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Convert points to SVG path with brush type consideration
  const pointsToPath = (points: Point[], brushType: string): string => {
    if (points.length === 0) return '';

    if (brushType === 'calligraphy') {
      // Calligraphy creates a "ribbon" to simulate a chisel-tip pen
      if (points.length < 2) return '';

      const width = 6; // Bolder chisel tip
      const angle = Math.PI / 4; // 45 degree angle for the chisel

      const offset = {
        x: Math.cos(angle) * width,
        y: Math.sin(angle) * width
      };

      let topPath = `M ${points[0].x + offset.x} ${points[0].y - offset.y}`;
      let bottomPath = `L ${points[0].x - offset.x} ${points[0].y + offset.y}`;

      for (let i = 1; i < points.length; i++) {
        topPath += ` L ${points[i].x + offset.x} ${points[i].y - offset.y}`;
        bottomPath = ` L ${points[i].x - offset.x} ${points[i].y + offset.y}` + bottomPath;
      }

      return topPath + bottomPath + ' Z';
    } else if (brushType === 'pencil') {
      // Pencil adds tiny jitter for a sketchy feel
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const jitterX = (Math.random() - 0.5) * 0.8;
        const jitterY = (Math.random() - 0.5) * 0.8;
        path += ` L ${points[i].x + jitterX} ${points[i].y + jitterY}`;
      }
      return path;
    } else {
      // Standard straight line segments
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
      }
      return path;
    }
  };

  // Get stroke properties based on brush type
  const getStrokeProperties = (brushType: string, size: number) => {
    switch (brushType) {
      case 'brush':
        return {
          strokeWidth: size * 1.5,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          strokeDasharray: undefined,
          opacityMultiplier: 0.9
        };
      case 'marker':
        return {
          strokeWidth: size * 2.5,
          strokeLinecap: 'square' as const,
          strokeLinejoin: 'bevel' as const,
          strokeDasharray: undefined,
          opacityMultiplier: 0.6
        };
      case 'pencil':
        return {
          strokeWidth: size * 0.6,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          strokeDasharray: "1, 2",
          opacityMultiplier: 0.8
        };
      case 'calligraphy':
        return {
          strokeWidth: 0.5, // Thin fallback stroke
          strokeLinecap: 'butt' as const,
          strokeLinejoin: 'miter' as const,
          strokeDasharray: undefined,
          opacityMultiplier: 1.0,
          useFill: true
        };
      case 'airbrush':
        return {
          strokeWidth: size * 4.0,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          strokeDasharray: "0.5, 4",
          opacityMultiplier: 0.4
        };
      default:
        return {
          strokeWidth: size,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          strokeDasharray: undefined,
          opacityMultiplier: 1.0
        };
    }
  };

  // Apply symmetry transformations
  const getSymmetryStrokes = (stroke: Stroke): Stroke[] => {
    if (symmetryMode === 'none') return [stroke];

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const result: Stroke[] = [stroke];

    if (symmetryMode === 'horizontal' || symmetryMode === 'radial') {
      result.push({ ...stroke, points: stroke.points.map(p => ({ ...p, x: centerX * 2 - p.x })) });
    }

    if (symmetryMode === 'vertical' || symmetryMode === 'radial') {
      result.push({ ...stroke, points: stroke.points.map(p => ({ ...p, y: centerY * 2 - p.y })) });
    }

    if (symmetryMode === 'radial') {
      result.push({ ...stroke, points: stroke.points.map(p => ({ x: centerX * 2 - p.x, y: centerY * 2 - p.y })) });
    }

    return result;
  };

  const confirmSave = () => {
    setShowSaveModal(false);

    try {
      // Generate SVG string from strokes + symmetry
      let pathsContent = '';

      strokes.forEach((stroke) => {
        // Get all symmetrical copies of the stroke
        const symmetryStrokes = getSymmetryStrokes(stroke);

        symmetryStrokes.forEach((symStroke) => {
          const props = getStrokeProperties(symStroke.brushType, symStroke.size);
          const d = pointsToPath(symStroke.points, symStroke.brushType);

          pathsContent += `<path d="${d}" stroke="${symStroke.color}" stroke-width="${props.strokeWidth}" fill="none" stroke-linecap="${props.strokeLinecap}" stroke-linejoin="${props.strokeLinejoin}" stroke-opacity="${symStroke.opacity}" />\n`;
        });
      });

      const sigilSvg = `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${pathsContent}
      </svg>`;

      // Navigate to PostForgeChoice (preserving existing flow)
      // This allows the user to decide if they want to enhance their manual drawing with AI or keep it as is.
      navigation.navigate('PostForgeChoice', {
        intentionText,
        distilledLetters,
        sigilSvg,
        category,
      });

    } catch (error) {
      console.error('Error saving manual sigil:', error);
      Alert.alert('Error', 'Failed to save your anchor.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ZenBackground orbOpacity={0.08} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Text style={styles.headerIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Manual Forge</Text>
            <Text style={styles.headerSubtitle}>Create Your Sacred Symbol</Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerButton, styles.saveButton]}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.gold, colors.bronze]}
              style={styles.saveButtonGradient}
            >
              <Text style={styles.saveIcon}>✓</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Instructions Card */}
        <Animated.View
          style={[styles.instructionsContainer, { opacity: fadeAnim }]}
        >
          {IS_ANDROID ? (
            <View style={[styles.instructionsCard, styles.cardAndroid]}>
              <View style={styles.instructionsContent}>
                <Text style={styles.instructionsTitle}>
                  Draw using: {distilledLetters.join(' ')}
                </Text>
                <Text style={styles.instructionsText}>
                  Merge and overlap into your unique symbol
                </Text>
              </View>
              <View style={styles.instructionsBorder} />
            </View>
          ) : (
            <BlurView intensity={12} tint="dark" style={styles.instructionsCard}>
              <View style={styles.instructionsContent}>
                <Text style={styles.instructionsTitle}>
                  Draw using: {distilledLetters.join(' ')}
                </Text>
                <Text style={styles.instructionsText}>
                  Merge and overlap into your unique symbol
                </Text>
              </View>
              <View style={styles.instructionsBorder} />
            </BlurView>
          )}
        </Animated.View>

        {/* Canvas */}
        <View style={styles.canvasContainer}>
          {IS_ANDROID ? (
            <View style={[styles.canvas, styles.canvasAndroid]}>
              {showGrid && <GridOverlay />}
              <View {...panResponder.panHandlers} style={styles.drawingArea}>
                <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                  {/* Render all strokes with symmetry */}
                  {strokes.map((stroke, index) => {
                    const symmetryStrokes = getSymmetryStrokes(stroke);
                    return symmetryStrokes.map((symStroke, symIndex) => {
                      const props = getStrokeProperties(symStroke.brushType, symStroke.size);
                      return (
                        <Path
                          key={`stroke-${index}-${symIndex}`}
                          d={pointsToPath(symStroke.points, symStroke.brushType)}
                          stroke={symStroke.color}
                          strokeWidth={props.strokeWidth}
                          fill="none"
                          strokeLinecap={props.strokeLinecap}
                          strokeLinejoin={props.strokeLinejoin}
                          strokeDasharray={props.strokeDasharray}
                          opacity={symStroke.opacity * props.opacityMultiplier}
                        />
                      );
                    });
                  })}
                  {/* Current stroke preview */}
                  {currentStroke.length > 0 && (() => {
                    const currentStrokeObj: Stroke = {
                      points: currentStroke,
                      color: selectedColor,
                      size: brushSize,
                      opacity: brushOpacity / 100,
                      brushType: selectedBrush,
                    };
                    const symmetryStrokes = getSymmetryStrokes(currentStrokeObj);
                    return symmetryStrokes.map((symStroke, symIndex) => {
                      const props = getStrokeProperties(symStroke.brushType, symStroke.size);
                      return (
                        <Path
                          key={`current-${symIndex}`}
                          d={pointsToPath(symStroke.points, symStroke.brushType)}
                          stroke={props.useFill ? "none" : symStroke.color}
                          strokeWidth={props.strokeWidth}
                          fill={props.useFill ? symStroke.color : "none"}
                          strokeLinecap={props.strokeLinecap}
                          strokeLinejoin={props.strokeLinejoin}
                          strokeDasharray={props.strokeDasharray}
                          opacity={symStroke.opacity * (props.opacityMultiplier || 1)}
                        />
                      );
                    });
                  })()}
                </Svg>
              </View>
              {showGrid && <View style={styles.centerDot} />}
            </View>
          ) : (
            <BlurView intensity={8} tint="dark" style={styles.canvas}>
              {showGrid && <GridOverlay />}
              <View {...panResponder.panHandlers} style={styles.drawingArea}>
                <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                  {strokes.map((stroke, index) => {
                    const symmetryStrokes = getSymmetryStrokes(stroke);
                    return symmetryStrokes.map((symStroke, symIndex) => {
                      const props = getStrokeProperties(symStroke.brushType, symStroke.size);
                      return (
                        <Path
                          key={`stroke-${index}-${symIndex}`}
                          d={pointsToPath(symStroke.points, symStroke.brushType)}
                          stroke={props.useFill ? "none" : symStroke.color}
                          strokeWidth={props.strokeWidth}
                          fill={props.useFill ? symStroke.color : "none"}
                          strokeLinecap={props.strokeLinecap}
                          strokeLinejoin={props.strokeLinejoin}
                          strokeDasharray={props.strokeDasharray}
                          opacity={symStroke.opacity * (props.opacityMultiplier || 1)}
                        />
                      );
                    });
                  })}
                  {currentStroke.length > 0 && (() => {
                    const currentStrokeObj: Stroke = {
                      points: currentStroke,
                      color: selectedColor,
                      size: brushSize,
                      opacity: brushOpacity / 100,
                      brushType: selectedBrush,
                    };
                    const symmetryStrokes = getSymmetryStrokes(currentStrokeObj);
                    return symmetryStrokes.map((symStroke, symIndex) => {
                      const props = getStrokeProperties(symStroke.brushType, symStroke.size);
                      return (
                        <Path
                          key={`current-${symIndex}`}
                          d={pointsToPath(symStroke.points, symStroke.brushType)}
                          stroke={props.useFill ? "none" : symStroke.color}
                          strokeWidth={props.strokeWidth}
                          fill={props.useFill ? symStroke.color : "none"}
                          strokeLinecap={props.strokeLinecap}
                          strokeLinejoin={props.strokeLinejoin}
                          strokeDasharray={props.strokeDasharray}
                          opacity={symStroke.opacity * (props.opacityMultiplier || 1)}
                        />
                      );
                    });
                  })()}
                </Svg>
              </View>
              {showGrid && <View style={styles.centerDot} />}
            </BlurView>
          )}

          {/* Quick Actions Bar */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              onPress={() => setShowGrid(!showGrid)}
              style={[styles.quickActionButton, showGrid && styles.quickActionActive]}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionIcon}>⊞</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleUndo}
              style={[styles.quickActionButton, strokes.length === 0 && styles.actionDisabled]}
              activeOpacity={0.7}
              disabled={strokes.length === 0}
            >
              <Text style={styles.quickActionIcon}>↶</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRedo}
              style={[styles.quickActionButton, redoStack.length === 0 && styles.actionDisabled]}
              activeOpacity={0.7}
              disabled={redoStack.length === 0}
            >
              <Text style={styles.quickActionIcon}>↷</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClear}
              style={[styles.quickActionButton, strokes.length === 0 && styles.actionDisabled]}
              activeOpacity={0.7}
              disabled={strokes.length === 0}
            >
              <Text style={styles.quickActionIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Floating Tools Button */}
        <TouchableOpacity
          onPress={() => setShowToolsModal(true)}
          style={styles.floatingToolsButton}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.gold, colors.bronze]}
            style={styles.floatingButtonGradient}
          >
            <Text style={styles.floatingButtonIcon}>🎨</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Save Confirmation Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={styles.modalBlur}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Save Your Anchor?</Text>
              <Text style={styles.modalText}>
                This will finalize your custom sigil and move to the next step.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowSaveModal(false)}
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalButtonTextSecondary}>Keep Drawing</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmSave}
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={[colors.gold, colors.bronze]}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Save & Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Tools Modal */}
      <Modal
        visible={showToolsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowToolsModal(false)}
      >
        <View style={styles.toolsModalOverlay}>
          <TouchableOpacity
            style={styles.toolsModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowToolsModal(false)}
          />
          <View style={styles.toolsModalContainer}>
            {IS_ANDROID ? (
              <View style={styles.toolsModalContent}>
                <ToolsModalContent
                  activeToolTab={activeToolTab}
                  setActiveToolTab={setActiveToolTab}
                  brushTypes={BRUSH_TYPES}
                  selectedBrush={selectedBrush}
                  setSelectedBrush={setSelectedBrush}
                  brushSize={brushSize}
                  setBrushSize={setBrushSize}
                  brushOpacity={brushOpacity}
                  setBrushOpacity={setBrushOpacity}
                  colorPalette={COLOR_PALETTE}
                  selectedColor={selectedColor}
                  setSelectedColor={setSelectedColor}
                  symmetryMode={symmetryMode}
                  setSymmetryMode={setSymmetryMode}
                  onClose={() => setShowToolsModal(false)}
                />
              </View>
            ) : (
              <BlurView intensity={30} tint="dark" style={styles.toolsModalContent}>
                <ToolsModalContent
                  activeToolTab={activeToolTab}
                  setActiveToolTab={setActiveToolTab}
                  brushTypes={BRUSH_TYPES}
                  selectedBrush={selectedBrush}
                  setSelectedBrush={setSelectedBrush}
                  brushSize={brushSize}
                  setBrushSize={setBrushSize}
                  brushOpacity={brushOpacity}
                  setBrushOpacity={setBrushOpacity}
                  colorPalette={COLOR_PALETTE}
                  selectedColor={selectedColor}
                  setSelectedColor={setSelectedColor}
                  symmetryMode={symmetryMode}
                  setSymmetryMode={setSymmetryMode}
                  onClose={() => setShowToolsModal(false)}
                />
              </BlurView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Tools Modal Content Component
function ToolsModalContent({
  activeToolTab,
  setActiveToolTab,
  brushTypes,
  selectedBrush,
  setSelectedBrush,
  brushSize,
  setBrushSize,
  brushOpacity,
  setBrushOpacity,
  colorPalette,
  selectedColor,
  setSelectedColor,
  symmetryMode,
  setSymmetryMode,
  onClose,
}: any) {
  return (
    <>
      {/* Header */}
      <View style={styles.toolsModalHeader}>
        <Text style={styles.toolsModalTitle}>Drawing Tools</Text>
        <TouchableOpacity onPress={onClose} style={styles.toolsModalCloseButton}>
          <Text style={styles.toolsModalCloseIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tool Tabs */}
      <View style={styles.toolTabs}>
        <TouchableOpacity
          onPress={() => setActiveToolTab('brush')}
          style={[styles.toolTab, activeToolTab === 'brush' && styles.toolTabActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.toolTabIcon, activeToolTab === 'brush' && styles.toolTabIconActive]}>
            ✎
          </Text>
          <Text style={[styles.toolTabText, activeToolTab === 'brush' && styles.toolTabTextActive]}>
            Brush
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveToolTab('color')}
          style={[styles.toolTab, activeToolTab === 'color' && styles.toolTabActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.toolTabIcon, activeToolTab === 'color' && styles.toolTabIconActive]}>
            🎨
          </Text>
          <Text style={[styles.toolTabText, activeToolTab === 'color' && styles.toolTabTextActive]}>
            Color
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveToolTab('effects')}
          style={[styles.toolTab, activeToolTab === 'effects' && styles.toolTabActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.toolTabIcon, activeToolTab === 'effects' && styles.toolTabIconActive]}>
            ✨
          </Text>
          <Text style={[styles.toolTabText, activeToolTab === 'effects' && styles.toolTabTextActive]}>
            Effects
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tool Content */}
      <ScrollView
        style={styles.toolsModalScrollView}
        contentContainerStyle={styles.toolContentInner}
        showsVerticalScrollIndicator={false}
      >
        {activeToolTab === 'brush' && (
          <BrushTab
            brushTypes={brushTypes}
            selectedBrush={selectedBrush}
            onSelectBrush={setSelectedBrush}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            brushOpacity={brushOpacity}
            onOpacityChange={setBrushOpacity}
          />
        )}

        {activeToolTab === 'color' && (
          <ColorTab
            colors={colorPalette}
            selectedColor={selectedColor}
            onSelectColor={setSelectedColor}
          />
        )}

        {activeToolTab === 'effects' && (
          <EffectsTab
            symmetryMode={symmetryMode}
            onSymmetryChange={setSymmetryMode}
          />
        )}
      </ScrollView>
    </>
  );
}

// Brush Tab Component
function BrushTab({
  brushTypes,
  selectedBrush,
  onSelectBrush,
  brushSize,
  onBrushSizeChange,
  brushOpacity,
  onOpacityChange,
}: any) {
  return (
    <View>
      {/* Brush Type Selection */}
      <Text style={styles.sectionLabel}>BRUSH TYPE</Text>
      <View style={styles.brushGrid}>
        {brushTypes.map((brush: any) => (
          <TouchableOpacity
            key={brush.id}
            onPress={() => onSelectBrush(brush.id)}
            style={[
              styles.brushCard,
              selectedBrush === brush.id && styles.brushCardSelected,
            ]}
            activeOpacity={0.7}
          >
            <Text style={styles.brushIcon}>{brush.icon}</Text>
            <Text style={styles.brushName}>{brush.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Brush Size */}
      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
        BRUSH SIZE: {brushSize}px
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={24}
        step={1}
        value={brushSize}
        onValueChange={onBrushSizeChange}
        minimumTrackTintColor={colors.gold}
        maximumTrackTintColor="rgba(192, 192, 192, 0.3)"
        thumbTintColor={colors.gold}
      />

      {/* Opacity */}
      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
        OPACITY: {brushOpacity}%
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={10}
        maximumValue={100}
        step={5}
        value={brushOpacity}
        onValueChange={onOpacityChange}
        minimumTrackTintColor={colors.gold}
        maximumTrackTintColor="rgba(192, 192, 192, 0.3)"
        thumbTintColor={colors.gold}
      />
    </View>
  );
}

// Color Tab Component
function ColorTab({ colors: colorPalette, selectedColor, onSelectColor }: any) {
  return (
    <View>
      <Text style={styles.sectionLabel}>COLOR PALETTE</Text>
      <View style={styles.colorGrid}>
        {colorPalette.map((colorItem: any) => (
          <TouchableOpacity
            key={colorItem.id}
            onPress={() => onSelectColor(colorItem.color)}
            style={[
              styles.colorOption,
              selectedColor === colorItem.color && styles.colorOptionSelected,
            ]}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.colorSwatch,
                { backgroundColor: colorItem.color },
              ]}
            />
            {selectedColor === colorItem.color && (
              <View style={styles.colorCheckmark}>
                <Text style={styles.colorCheckmarkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Color Name Display */}
      <View style={styles.colorInfo}>
        <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
        <Text style={styles.colorName}>
          {colorPalette.find((c: any) => c.color === selectedColor)?.name || 'Custom'}
        </Text>
      </View>
    </View>
  );
}

// Effects Tab Component
function EffectsTab({ symmetryMode, onSymmetryChange }: any) {
  return (
    <View>
      <Text style={styles.sectionLabel}>SYMMETRY MODE</Text>
      <View style={styles.effectsGrid}>
        <TouchableOpacity
          onPress={() => onSymmetryChange('none')}
          style={[
            styles.effectCard,
            symmetryMode === 'none' && styles.effectCardSelected,
          ]}
          activeOpacity={0.7}
        >
          <Text style={styles.effectIcon}>○</Text>
          <Text style={styles.effectName}>None</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSymmetryChange('horizontal')}
          style={[
            styles.effectCard,
            symmetryMode === 'horizontal' && styles.effectCardSelected,
          ]}
          activeOpacity={0.7}
        >
          <Text style={styles.effectIcon}>↔</Text>
          <Text style={styles.effectName}>Horizontal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSymmetryChange('vertical')}
          style={[
            styles.effectCard,
            symmetryMode === 'vertical' && styles.effectCardSelected,
          ]}
          activeOpacity={0.7}
        >
          <Text style={styles.effectIcon}>↕</Text>
          <Text style={styles.effectName}>Vertical</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSymmetryChange('radial')}
          style={[
            styles.effectCard,
            symmetryMode === 'radial' && styles.effectCardSelected,
          ]}
          activeOpacity={0.7}
        >
          <Text style={styles.effectIcon}>✦</Text>
          <Text style={styles.effectName}>Radial</Text>
        </TouchableOpacity>
      </View>

      {/* Tips */}
      <View style={styles.tipCard}>
        <Text style={styles.tipIcon}>💡</Text>
        <Text style={styles.tipText}>
          Symmetry creates perfect balance. Try radial mode for sacred geometry patterns!
        </Text>
      </View>
    </View>
  );
}

// Grid Overlay Component
function GridOverlay() {
  const gridSize = 30;
  const lines = [];

  // Horizontal lines
  for (let i = 0; i <= CANVAS_HEIGHT / gridSize; i++) {
    const pos = i * gridSize;
    lines.push(
      <View
        key={`h-${i}`}
        style={[styles.gridLine, styles.gridLineH, { top: pos }]}
      />
    );
  }

  // Vertical lines
  for (let i = 0; i <= CANVAS_WIDTH / gridSize; i++) {
    const pos = i * gridSize;
    lines.push(
      <View
        key={`v-${i}`}
        style={[styles.gridLine, styles.gridLineV, { left: pos }]}
      />
    );
  }

  return <View style={styles.gridOverlay}>{lines}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(26, 26, 29, 0.6)',
  },
  saveButton: {
    backgroundColor: 'transparent',
    padding: 0,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 22,
    color: colors.gold,
  },
  saveIcon: {
    fontSize: 24,
    color: colors.charcoal,
    fontWeight: '700',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.5,
    fontFamily: 'System', // Using System as reliable fallback
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.silver,
    opacity: 0.7,
    marginTop: 2,
  },
  instructionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 4,
  },
  instructionsCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(26, 26, 29, 0.4)',
    position: 'relative',
  },
  cardAndroid: {
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
  },
  instructionsContent: {
    padding: 12,
  },
  instructionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gold,
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  instructionsText: {
    fontSize: 11,
    color: colors.silver,
    opacity: 0.7,
  },
  instructionsBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
  },
  canvasContainer: {
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 4,
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(15, 20, 25, 0.95)',
    overflow: 'hidden',
    position: 'relative',
  },
  canvasAndroid: {
    backgroundColor: colors.charcoal,
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  gridLineH: {
    width: '100%',
    height: 1,
  },
  gridLineV: {
    height: '100%',
    width: 1,
  },
  drawingArea: {
    flex: 1,
  },
  centerDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    opacity: 0.4,
    marginLeft: -4,
    marginTop: -4,
    pointerEvents: 'none',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(26, 26, 29, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  actionDisabled: {
    opacity: 0.3,
  },
  quickActionIcon: {
    fontSize: 20,
    color: colors.gold,
  },
  toolsPanel: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    height: 360,
  },
  toolTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(26, 26, 29, 0.6)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  toolTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toolTabActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  toolTabIcon: {
    fontSize: 18,
    color: colors.silver,
    marginBottom: 2,
  },
  toolTabIconActive: {
    color: colors.gold,
  },
  toolTabText: {
    fontSize: 10,
    color: colors.silver,
    fontWeight: '600',
  },
  toolTabTextActive: {
    color: colors.gold,
  },
  toolContent: {
    marginTop: 12,
    height: 280,
  },
  toolContentInner: {
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 1,
    marginBottom: 12,
    opacity: 0.6,
  },
  sectionLabelSpaced: {
    marginTop: 20,
  },
  brushGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  brushCard: {
    width: (SCREEN_WIDTH - 56) / 3,
    aspectRatio: 1,
    backgroundColor: 'rgba(26, 26, 29, 0.6)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brushCardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  brushIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  brushName: {
    fontSize: 11,
    color: colors.silver,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(192, 192, 192, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  colorOptionSelected: {
    borderColor: colors.gold,
  },
  colorSwatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  colorCheckmark: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    bottom: -4,
    right: -4,
  },
  colorCheckmarkText: {
    fontSize: 12,
    color: colors.charcoal,
    fontWeight: '700',
  },
  colorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(26, 26, 29, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  colorName: {
    fontSize: 14,
    color: colors.gold,
    fontWeight: '600',
  },
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  effectCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    aspectRatio: 1.5,
    backgroundColor: 'rgba(26, 26, 29, 0.6)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  effectCardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  effectIcon: {
    fontSize: 32,
    color: colors.gold,
    marginBottom: 8,
  },
  effectName: {
    fontSize: 12,
    color: colors.silver,
    fontWeight: '600',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(62, 44, 91, 0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  tipIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: colors.silver,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBlur: {
    width: SCREEN_WIDTH - 64,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'System',
    color: colors.gold,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  modalText: {
    fontSize: 14,
    color: colors.silver,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonSecondary: {
    backgroundColor: 'rgba(26, 26, 29, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: 'transparent',
  },
  modalButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoal,
  },
  modalButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.silver,
  },
  // Floating Tools Button
  floatingToolsButton: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingButtonIcon: {
    fontSize: 28,
  },
  // Tools Modal
  toolsModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  toolsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  toolsModalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  toolsModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.charcoal,
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  toolsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  toolsModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.5,
  },
  toolsModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolsModalCloseIcon: {
    fontSize: 18,
    color: colors.silver,
    fontWeight: '600',
  },
  toolsModalScrollView: {
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
});
