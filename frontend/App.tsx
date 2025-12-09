import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RootStackParamList } from "./types/navigation";
import { WorkoutProvider } from "./context/WorkoutProvider";
import ConnectDeviceScreen from "./screens/ConnectDeviceScreen";
import PurposeScreen from "./screens/PurposeScreen";
import SummaryScreen from "./screens/SummaryScreen";
import WorkoutDashboardScreen from "./screens/WorkoutDashboardScreen";
import UserBodyInfoScreen from "./screens/UserBodyInfoScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#0A0F1A",
  },
};

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <WorkoutProvider>
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              initialRouteName="UserBodyInfo"
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#0A0F1A" },
              }}
            >
              <Stack.Screen name="UserBodyInfo" component={UserBodyInfoScreen} />
              <Stack.Screen name="WorkoutPurpose" component={PurposeScreen} />
              <Stack.Screen name="BleConnection" component={ConnectDeviceScreen} />
              <Stack.Screen name="WorkoutDashboard" component={WorkoutDashboardScreen} />
              <Stack.Screen name="WorkoutSummary" component={SummaryScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </WorkoutProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;