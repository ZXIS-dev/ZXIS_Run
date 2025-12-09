import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../types/navigation";
import { useWorkout } from "../context/WorkoutProvider";
import { WorkoutPurposeKey } from "../services/arduinoBridge";

type Props = NativeStackScreenProps<RootStackParamList, "WorkoutPurpose">;

export default function PurposeScreen({ navigation }: Props) {
  const { purpose, setPurpose } = useWorkout();
  const [selected, setSelected] = useState<string | null>(purpose);

  const items: {
    key: WorkoutPurposeKey;
    title: string;
    description: string;
    bpm: string;
    icon: string;
  }[] = [
    {
      key: "fatBurn",
      title: "지방 연소",
      description: "지속적인 중강도 운동에 집중합니다.",
      bpm: "~130 BPM",
      icon: "local-fire-department",
    },
    {
      key: "cardio",
      title: "심폐 지구력",
      description: "심폐 기능과 지구력을 향상시킵니다.",
      bpm: "~155 BPM",
      icon: "favorite", // cardiology icon 없음 → 가까운 걸로 사용
    },
    {
      key: "hiit",
      title: "HIIT 고강도",
      description: "최대 효율을 위한 고강도 인터벌 훈련입니다.",
      bpm: "~175 BPM",
      icon: "bolt",
    },
  ];

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-ios" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>운동 목적 선택</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {items.map((item) => {
          const isSelected = selected === item.key;

          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                setSelected(item.key);
                setPurpose(item.key);
              }}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
              ]}
            >
              {/* Icon + Text Row */}
              <View style={styles.row}>
                <View style={styles.iconWrapper}>
                  <Icon
                    name={item.icon}
                    size={32}
                    color={isSelected ? "#ffffff" : "#ffffff"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.cardTitle,
                      isSelected && styles.cardTitleSelected,
                    ]}
                  >
                    {item.title}
                  </Text>

                  <Text
                    style={[
                      styles.cardDescription,
                      isSelected && styles.cardDescriptionSelected,
                    ]}
                  >
                    {item.description}
                  </Text>
                </View>
              </View>

              {/* BPM Tag */}
              <View
                style={[
                  styles.bpmTag,
                  isSelected && styles.bpmTagSelected,
                ]}
              >
                <Text
                  style={[
                    styles.bpmText,
                    isSelected && styles.bpmTextSelected,
                  ]}
                >
                  {item.bpm}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Continue Button */}
        <TouchableOpacity
          disabled={!selected}
          style={[
            styles.continueButton,
            selected && styles.continueButtonActive,
          ]}
          onPress={() => navigation.navigate("BleConnection")}
        >
          <Text
            style={[
              styles.continueText,
              selected && styles.continueTextActive,
            ]}
          >
            계속하기
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101622",
  },

  /* Top bar */
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  topTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  /* Content */
  content: {
    padding: 16,
    gap: 16,
  },

  /* Workout Cards */
  card: {
    backgroundColor: "#1C2431",
    padding: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    gap: 12,
  },

  cardSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: "#32CD32",
    transform: [{ scale: 1.02 }],
    shadowColor: "#32CD32",
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },

  row: {
    flexDirection: "row",
    gap: 16,
  },

  iconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "#282E39",
    justifyContent: "center",
    alignItems: "center",
  },

  cardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cardTitleSelected: {
    color: "#0A2540",
  },

  cardDescription: {
    color: "#9DA6B9",
    fontSize: 13,
    marginTop: 4,
  },
  cardDescriptionSelected: {
    color: "#6B7280",
  },

  /* BPM Tag */
  bpmTag: {
    backgroundColor: "#282E39",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  bpmTagSelected: {
    backgroundColor: "#F0F4F8",
  },

  bpmText: {
    color: "#9DA6B9",
    fontSize: 15,
    fontWeight: "600",
  },
  bpmTextSelected: {
    color: "#6B7280",
  },

  /* Continue Button */
  continueButton: {
    marginTop: 24,
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#B0B8C5", // disabled
  },

  continueButtonActive: {
    backgroundColor: "#32CD32", // neon green
  },

  continueText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    opacity: 0.5,
  },

  continueTextActive: {
    opacity: 1,
  },
});

