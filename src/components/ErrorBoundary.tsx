import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.emoji}>😅</Text>
            <Text style={styles.title}>エラーが発生しました</Text>
            <Text style={styles.message}>
              アプリで予期しないエラーが発生しました。
              {'\n'}
              もう一度お試しください。
            </Text>
            {__DEV__ && this.state.error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>デバッグ情報:</Text>
                <Text style={styles.debugText}>{this.state.error.toString()}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.resetButton}
              onPress={this.handleReset}
            >
              <Text style={styles.resetButtonText}>もう一度試す</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fce7f3',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: 400,
    width: '100%',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  message: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    fontFamily: MARU_GOTHIC_FONT,
  },
  debugContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#dc2626',
    marginBottom: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  debugText: {
    fontSize: 12,
    color: '#991b1b',
    fontFamily: 'monospace',
  },
  resetButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resetButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
});

export default ErrorBoundary;
