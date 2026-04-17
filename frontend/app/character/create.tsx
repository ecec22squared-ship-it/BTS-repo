import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useGameStore } from '../../src/stores/gameStore';

// Bio-lab cloning chamber backgrounds – one per creation stage
const BIOLAB_STAGES = [
  {
    // Step 0: Designation / Naming terminal
    bg: 'https://images.unsplash.com/photo-1606206873764-fd15e242df52?w=1200&q=80',
    label: 'IDENTIFICATION TERMINAL',
    sub: 'Stage 01 • Genetic ID assignment',
    tint: 'rgba(6,18,40,0.78)',
    accent: '#5EC8FF',
  },
  {
    // Step 1: Genetic / Species selection
    bg: 'https://images.unsplash.com/photo-1606206605628-0a09580d44a1?w=1200&q=80',
    label: 'GENOME SELECTION',
    sub: 'Stage 02 • Species matrix calibration',
    tint: 'rgba(8,28,30,0.78)',
    accent: '#5DF7C3',
  },
  {
    // Step 2: Career / Growth chamber training
    bg: 'https://images.unsplash.com/photo-1645244593646-e03f0088e2d5?w=1200&q=80',
    label: 'GROWTH CHAMBER',
    sub: 'Stage 03 • Neural training protocol',
    tint: 'rgba(10,22,38,0.78)',
    accent: '#73E4FF',
  },
  {
    // Step 3: Specialization / Augmentation bay
    bg: 'https://images.unsplash.com/photo-1583870908969-89c2ea77dc34?w=1200&q=80',
    label: 'AUGMENTATION BAY',
    sub: 'Stage 04 • Combat specialization module',
    tint: 'rgba(32,14,8,0.78)',
    accent: '#FFB86C',
  },
  {
    // Step 4: Backstory / Memory imprint chamber
    bg: 'https://images.unsplash.com/photo-1637166185518-058f5896a2e9?w=1200&q=80',
    label: 'MEMORY IMPRINT',
    sub: 'Stage 05 • Activation & backstory upload',
    tint: 'rgba(20,10,40,0.78)',
    accent: '#C89BFF',
  },
];

export default function CreateCharacter() {
  const { speciesData, careerData, fetchGameData, createCharacter } = useGameStore();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Character data
  const [name, setName] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [selectedCareer, setSelectedCareer] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [backstory, setBackstory] = useState('');

  useEffect(() => {
    if (Object.keys(speciesData).length === 0) {
      setIsLoading(true);
      fetchGameData().finally(() => setIsLoading(false));
    }
  }, []);

  const handleCreate = async () => {
    if (!name || !selectedSpecies || !selectedCareer || !selectedSpecialization) {
      Alert.alert('Error', 'Please complete all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const character = await createCharacter({
        name,
        species: selectedSpecies,
        career: selectedCareer,
        specialization: selectedSpecialization,
        backstory,
      });
      router.replace(`/character/${character.character_id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create character');
    } finally {
      setIsCreating(false);
    }
  };

  const speciesList = Object.keys(speciesData);
  const careerList = Object.keys(careerData);
  const specializationList = selectedCareer
    ? careerData[selectedCareer]?.specializations || []
    : [];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#05080f' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading game data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stage = BIOLAB_STAGES[Math.min(step, BIOLAB_STAGES.length - 1)];

  return (
    <View style={styles.root}>
      <ImageBackground
        source={{ uri: stage.bg }}
        style={StyleSheet.absoluteFillObject}
        imageStyle={styles.bgImage}
        resizeMode="cover"
      />
      <View style={[styles.bgOverlay, { backgroundColor: stage.tint }]} pointerEvents="none" />

      <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: `${stage.accent}40` }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={[styles.headerBadge, { borderColor: stage.accent }]}>
              <Ionicons name="flask" size={10} color={stage.accent} />
              <Text style={[styles.headerBadgeText, { color: stage.accent }]}>KYRMIRR GENETICS FACILITY</Text>
            </View>
            <Text style={[styles.headerTitle, { color: stage.accent }]}>{stage.label}</Text>
            <Text style={styles.headerSub}>{stage.sub}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          {['Name', 'Species', 'Career', 'Spec', 'Story'].map((label, i) => (
            <View key={i} style={styles.progressItem}>
              <View
                style={[
                  styles.progressDot,
                  step >= i && styles.progressDotActive,
                ]}
              >
                {step > i && <Ionicons name="checkmark" size={12} color="#000" />}
              </View>
              <Text style={[styles.progressLabel, step >= i && styles.progressLabelActive]}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Step 0: Name */}
          {step === 0 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>What is your character's name?</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter character name"
                placeholderTextColor="#666"
                autoFocus
              />
            </View>
          )}

          {/* Step 1: Species */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Choose your species</Text>
              {speciesList.map((species) => (
                <TouchableOpacity
                  key={species}
                  style={[
                    styles.optionCard,
                    selectedSpecies === species && styles.optionCardSelected,
                  ]}
                  onPress={() => setSelectedSpecies(species)}
                >
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionTitle}>{species}</Text>
                    {selectedSpecies === species && (
                      <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
                    )}
                  </View>
                  <Text style={styles.optionDescription}>
                    {speciesData[species]?.description}
                  </Text>
                  <Text style={styles.optionSpecial}>
                    Special: {speciesData[species]?.special}
                  </Text>
                  <Text style={styles.optionXP}>
                    Starting XP: {speciesData[species]?.starting_xp}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 2: Career */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Choose your career</Text>
              {careerList.map((career) => (
                <TouchableOpacity
                  key={career}
                  style={[
                    styles.optionCard,
                    selectedCareer === career && styles.optionCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedCareer(career);
                    setSelectedSpecialization('');
                  }}
                >
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionTitle}>{career}</Text>
                    {selectedCareer === career && (
                      <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
                    )}
                  </View>
                  <Text style={styles.optionDescription}>
                    {careerData[career]?.description}
                  </Text>
                  <Text style={styles.optionSkills}>
                    Skills: {careerData[career]?.career_skills?.slice(0, 4).join(', ')}...
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 3: Specialization */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Choose your specialization</Text>
              <Text style={styles.stepSubtitle}>Within {selectedCareer}</Text>
              {specializationList.map((spec) => (
                <TouchableOpacity
                  key={spec}
                  style={[
                    styles.optionCard,
                    selectedSpecialization === spec && styles.optionCardSelected,
                  ]}
                  onPress={() => setSelectedSpecialization(spec)}
                >
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionTitle}>{spec}</Text>
                    {selectedSpecialization === spec && (
                      <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 4: Backstory */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Tell your backstory</Text>
              <Text style={styles.stepSubtitle}>(Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={backstory}
                onChangeText={setBackstory}
                placeholder="What brought you to the edge of the galaxy?"
                placeholderTextColor="#666"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              {/* Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Character Summary</Text>
                <Text style={styles.summaryItem}>Name: {name}</Text>
                <Text style={styles.summaryItem}>Species: {selectedSpecies}</Text>
                <Text style={styles.summaryItem}>Career: {selectedCareer}</Text>
                <Text style={styles.summaryItem}>Specialization: {selectedSpecialization}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.navButtons}>
          {step > 0 && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setStep(step - 1)}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={styles.navButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {step < 4 ? (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonPrimary,
                !canProceed() && styles.navButtonDisabled,
              ]}
              onPress={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              <Text style={styles.navButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary]}
              onPress={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.navButtonText}>Create</Text>
                  <Ionicons name="checkmark" size={20} color="#000" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return name.trim().length > 0;
      case 1:
        return selectedSpecies.length > 0;
      case 2:
        return selectedCareer.length > 0;
      case 3:
        return selectedSpecialization.length > 0;
      default:
        return true;
    }
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05080f' },
  bgImage: { opacity: 0.55 },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFD700',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(4,10,22,0.55)',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, marginBottom: 3,
  },
  headerBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  headerSub: { color: '#8AA8C9', fontSize: 9, marginTop: 1, letterSpacing: 0.6 },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  progressItem: {
    alignItems: 'center',
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: '#FFD700',
  },
  progressLabel: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
  },
  progressLabelActive: {
    color: '#FFD700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'rgba(6,18,40,0.75)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 18,
    borderWidth: 1,
    borderColor: 'rgba(94,200,255,0.35)',
  },
  textArea: {
    height: 150,
    fontSize: 16,
  },
  optionCard: {
    backgroundColor: 'rgba(6,18,40,0.75)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionCardSelected: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.18)',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  optionDescription: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  optionSpecial: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 8,
  },
  optionXP: {
    color: '#FFD700',
    fontSize: 12,
    marginTop: 4,
  },
  optionSkills: {
    color: '#03A9F4',
    fontSize: 12,
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  summaryTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryItem: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  navButtons: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  navButtonPrimary: {
    backgroundColor: '#FFD700',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
  },
});
