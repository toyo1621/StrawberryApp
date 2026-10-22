import React from 'react';
import policy from '../content/privacyPolicy.json';
import InfoScreen from './info/InfoScreen';

type PrivacyPolicyScreenProps = {
  onBack: () => void;
  darkMode?: boolean;
};

const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ onBack, darkMode = false }) => (
  <InfoScreen
    title={policy.title}
    updatedAt={policy.updatedAt}
    sections={policy.sections}
    onBack={onBack}
    darkMode={darkMode}
  />
);

export default PrivacyPolicyScreen;
