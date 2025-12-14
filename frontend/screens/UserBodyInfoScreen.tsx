import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import RNPickerSelect from "react-native-picker-select";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../types/navigation";
import { useWorkout } from "../context/WorkoutProvider";

type Props = NativeStackScreenProps<RootStackParamList, "UserBodyInfo">;

export default function UserBodyInfoScreen({ navigation }: Props) {
  const { profile, setProfile } = useWorkout();
  const [age, setAge] = useState<string>(String(profile.age ?? ""));
  const [weight, setWeight] = useState<string>(profile.weight ? String(profile.weight) : "");
  const [restingHr, setRestingHr] = useState<string>(String(profile.restingHr ?? ""));
  const [gender, setGender] = useState<string>(profile.gender ?? "Male");
  const [level, setLevel] = useState<string>(profile.level ?? "Beginner");

  const handleNext = () => {
    const ageNum = Number(age);
    const weightNum = weight ? Number(weight) : undefined;
    const rhrNum = Number(restingHr);

    // 최소한의 값만 채워도 다음 화면으로 진행
    setProfile({
      age: isNaN(ageNum) ? 0 : ageNum,
      restingHr: isNaN(rhrNum) ? 0 : rhrNum,
      weight: weightNum,
      gender,
      level,
    });

    navigation.navigate("WorkoutPurpose");
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.topBar}>


      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Illustration */}
        {/* <View style={styles.illustrationWrapper}>
          <Image
            source={{
              uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuDtS-feda6Stpa3NznCFBWC4tZ5lKO9EnoeH0iTp_xrkhvhlMIuJILanhpEyq6WV2TFlkjDYVKzoQJ9AoUcprAue4Zjm766Lzw3SVk9NOfa5glB4sWksUayoo11Kx2pN0N5UBtToFCzroxVigKyFnfEWiI129px1MqssJTIBX4MvRsOrG7U_LD5WaXd_0QY2Je4NRLxufk1B06wNYBS0VLbZmhTrZCfKnjuTTnYI_k8mKHGw3VJvJzmmzqo4hxXo-xHpfwLRKgdKZ4S",
            }}
            style={styles.illustration}
          />
        </View> */}
        <View style = {{height: 20}}/>
        {/* Header */}
        <View style={styles.headerText}>
          <Text style={styles.title}>개인 운동 프로필 생성</Text>
          <Text style={styles.subtitle}>
            안전하고 효율적인 운동을 위해 몇 가지 정보를 입력해주세요.
          </Text>
        </View>
          <View style = {{height: 20}}/>
        {/* Inputs */}
        <View style={styles.card}>

          {/* Age & Weight */}
          <View style={styles.row}>
            {/* Age */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>나이</Text>
              <View style={styles.inputWrapper}>
                <Icon name="cake" size={22} color="#9DA6B9" style={styles.inputIcon} />
                <TextInput
                  placeholder="25"
                  placeholderTextColor="#9DA6B9"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Weight */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>체중(kg)</Text>
              <View style={styles.inputWrapper}>
                <Icon name="scale" size={22} color="#9DA6B9" style={styles.inputIcon} />
                <TextInput
                  placeholder="70"
                  placeholderTextColor="#9DA6B9"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>
          </View>

          {/* Resting HR */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>안정 시 심박수(RHR)</Text>
            <View style={styles.inputWrapper}>
              <Icon name="favorite-border" size={22} color="#9DA6B9" style={styles.inputIcon} />
              <TextInput
                placeholder="60"
                placeholderTextColor="#9DA6B9"
                value={restingHr}
                onChangeText={setRestingHr}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          {/* Gender segmented control */}
          <Text style={styles.label}>성별</Text>
          <View style={styles.segment}>
            {["남성", "여성"].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.segmentOption, gender === g && styles.segmentOptionSelected]}
                onPress={() => setGender(g)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    gender === g && styles.segmentTextSelected,
                  ]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Fitness Level */}
          <Text style={styles.label}>운동 숙련도</Text>
          <View style={styles.pickerWrapper}>
            <Icon name="fitness-center" size={22} color="#9DA6B9" style={styles.pickerIcon} />
            <RNPickerSelect
              value={level}
              onValueChange={(v) => setLevel(v)}
              items={[
                { label: "초급자", value: "Beginner" },
                { label: "중급자", value: "Intermediate" },
                { label: "상급자", value: "Advanced" },
              ]}
              style={pickerSelectStyles}
            />
          </View>

        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>계속하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A2540",
  },
  topBar: {
    padding: 16,
    height: 28
  },
  content: {
    paddingHorizontal: 16,
  },
  illustrationWrapper: {
    alignItems: "center",
    paddingVertical: 20,
  },
  illustration: {
    width: 180,
    height: 160,
    resizeMode: "contain",
  },
  headerText: {
    alignItems: "center",
    paddingVertical: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: "#9DA6B9",
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },

  // Card
  card: {
    backgroundColor: "#101622",
    padding: 20,
    borderRadius: 14,
    gap: 16,
  },

  // Inputs
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  inputContainer: {
    flex: 1,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 14,
    marginBottom: 6,
  },
  inputWrapper: {
    backgroundColor: "#1C1F27",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3B4354",
    height: 48,
    justifyContent: "center",
  },
  inputIcon: {
    position: "absolute",
    left: 12,
  },
  input: {
    color: "#FFFFFF",
    paddingLeft: 40,
    fontSize: 16,
  },

  // Gender segmented control
  segment: {
    flexDirection: "row",
    backgroundColor: "#1C1F27",
    borderRadius: 10,
    height: 48,
    overflow: "hidden",
  },
  segmentOption: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentOptionSelected: {
    backgroundColor: "#32CD32",
  },
  segmentText: {
    color: "#9DA6B9",
    fontSize: 14,
  },
  segmentTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // Picker
  pickerWrapper: {
    backgroundColor: "#1C1F27",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3B4354",
    height: 48,
    justifyContent: "center",
    paddingLeft: 40,
  },
  pickerIcon: {
    position: "absolute",
    left: 12,
  },

  // Bottom button
  bottom: {
    padding: 16,
    paddingBottom: 32,
  },
  nextButton: {
    height: 56,
    backgroundColor: "#32CD32",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    color: "#FFFFFF",
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  inputAndroid: {
    color: "#FFFFFF",
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  placeholder: {
    color: "#9DA6B9",
  },
  iconContainer: {
    display: "none",
  },
});

