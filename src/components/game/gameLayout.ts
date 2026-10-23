import { StyleSheet } from 'react-native';

export const gameLayout = StyleSheet.create({
  choices: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 560,
  },
  squareChoice: {
    flex: 1,
    minWidth: 0,
    maxWidth: 224,
    aspectRatio: 1,
  },
});
