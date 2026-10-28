import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';


export function useEditGroupScreen() {
  const [groupName, setGroupName] = useState('');
  
  return (
    { groupName, setGroupName }
  );
}
